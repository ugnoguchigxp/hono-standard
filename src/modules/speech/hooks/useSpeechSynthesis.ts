/**
 * 統一音声合成Hook
 * Azure Speech Service統合の音声合成機能
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { client } from '@/lib/api';

import { useAuth } from '@/lib/auth';
import { createContextLogger } from '@/lib/logger';

import {
  DEFAULT_SYNTHESIS_CONFIG,
  detectSpeechSupport,
  SPEECH_API_ENDPOINTS,
  SPEECH_ERROR_MESSAGES,
  SPEECH_PERFORMANCE_CONFIG,
} from './config';
import type { SpeechSynthesisConfig, SpeechSynthesisMethods, SpeechSynthesisState } from './types';

const log = createContextLogger('SpeechSynthesis');

export const useSpeechSynthesis = (
  config: Partial<SpeechSynthesisConfig> = {}
): SpeechSynthesisState & SpeechSynthesisMethods => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const apiClient = client as any; // Temporary cast to avoid rewriting all RPC calls in this session
  const finalConfig = useMemo(() => ({ ...DEFAULT_SYNTHESIS_CONFIG, ...config }), [config]);

  // State
  const [state, setState] = useState<SpeechSynthesisState>({
    isSpeaking: false,
    isLoading: false,
    error: null,
    isSupported: detectSpeechSupport().synthesis,
    duration: 0,
    isPaused: false,
  });

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 共通のmarkdownテキスト除去関数
  const stripMarkdownText = useCallback(
    (text: string): string => {
      if (!finalConfig.stripMarkdown) return text;

      return (
        text
          // Remove headers
          .replace(/^#{1,6}\s+/gm, '')
          // Remove bold/italic
          .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
          .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
          // Remove links
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          // Remove code blocks
          .replace(/```[\s\S]*?```/g, '')
          .replace(/`([^`]+)`/g, '$1')
          // Remove lists
          .replace(/^\s*[-*+]\s+/gm, '')
          .replace(/^\s*\d+\.\s+/gm, '')
          // Remove blockquotes
          .replace(/^>\s+/gm, '')
          // Clean up whitespace
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      );
    },
    [finalConfig.stripMarkdown]
  );

  // Check if speech synthesis is available
  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState((prev) => ({ ...prev, error: SPEECH_ERROR_MESSAGES.NOT_SUPPORTED }));
      return false;
    }

    if (!isAuthenticated) {
      setState((prev) => ({ ...prev, error: SPEECH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED }));
      return false;
    }

    try {
      const response = await apiClient.get(SPEECH_API_ENDPOINTS.CONFIG);

      if (!response?.success || !response.isConnected) {
        setState((prev) => ({ ...prev, error: SPEECH_ERROR_MESSAGES.CONFIG_ERROR }));
        return false;
      }

      return true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // 401認証エラーの場合は適切にエラー処理を行う
      if (error?.status === 401 || error?.response?.status === 401) {
        setState((prev) => ({ ...prev, error: SPEECH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED }));
        log.warn('Speech configuration requires authentication', { error });
        return false;
      }

      log.debug('Speech configuration not available (optional feature)', { error });
      setState((prev) => ({ ...prev, error: SPEECH_ERROR_MESSAGES.CONFIG_ERROR }));
      return false;
    }
  }, [state.isSupported, isAuthenticated]);

  // Speak text
  const speak = useCallback(
    async (text: string, options: Partial<SpeechSynthesisConfig> = {}) => {
      log.info('useSpeechSynthesis: speak function called', {
        textLength: text.length,
        isSpeaking: state.isSpeaking,
        isLoading: state.isLoading,
        isSupported: state.isSupported,
        hasOptions: Object.keys(options).length > 0,
        optionsKeys: Object.keys(options),
      });

      if (state.isSpeaking || state.isLoading) {
        log.warn('Speech synthesis already in progress', {
          isSpeaking: state.isSpeaking,
          isLoading: state.isLoading,
        });
        return;
      }

      if (!text.trim()) {
        log.warn('Empty text provided for speech synthesis');
        return;
      }

      const mergedConfig = { ...finalConfig, ...options };
      log.debug('useSpeechSynthesis: Merged config', { mergedConfig });

      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // Check availability
        const isAvailable = await checkAvailability();
        if (!isAvailable) {
          return;
        }

        // Stop current audio if playing
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
        setState((prev) => ({ ...prev, isPaused: false })); // 新しい音声開始時は一時停止状態をリセット

        // Process text
        let processedText = stripMarkdownText(text);
        if (processedText.length > mergedConfig.maxLength) {
          processedText = `${processedText.substring(0, mergedConfig.maxLength)}...`;
          log.info('Text truncated for speech synthesis', {
            original: text.length,
            processed: processedText.length,
            maxLength: mergedConfig.maxLength,
          });
        }

        setState((prev) => ({ ...prev, isSpeaking: true, isLoading: false }));
        log.info('useSpeechSynthesis: State set to speaking, calling onStart callback');
        mergedConfig.onStart?.();

        // Request speech synthesis from backend
        const response = await apiClient.post(
          SPEECH_API_ENDPOINTS.SYNTHESIZE,
          {
            text: processedText,
            language: mergedConfig.language,
            voice: mergedConfig.voice,
          },
          {
            timeout: SPEECH_PERFORMANCE_CONFIG.TIMEOUT_MS,
          }
        );

        // Validate response
        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response format from speech synthesis API');
        }

        if (!response.success) {
          throw new Error(response.error || SPEECH_ERROR_MESSAGES.SYNTHESIS_FAILED);
        }

        if (!response.audioData) {
          throw new Error('No audio data received from speech service');
        }

        // Convert base64 to audio and play
        const audioData = atob(response.audioData);
        const uint8Array = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          uint8Array[i] = audioData.charCodeAt(i);
        }

        const audioBlob = new Blob([uint8Array], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.volume = mergedConfig.volume;

        audio.onended = () => {
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            isPaused: false,
            duration: response.duration || 0,
          }));
          audioRef.current = null;
          URL.revokeObjectURL(audioUrl);
          mergedConfig.onEnd?.();

          log.info('Speech synthesis completed successfully', {
            textLength: processedText.length,
            language: mergedConfig.language,
            duration: response.duration,
          });
        };

        audio.onerror = (err) => {
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            isLoading: false,
            error: 'Audio playback failed',
            isPaused: false,
          }));
          audioRef.current = null;
          URL.revokeObjectURL(audioUrl);
          mergedConfig.onError?.('Audio playback failed');
          log.error('Audio playback failed', { error: err });
        };

        audioRef.current = audio;
        await audio.play();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // 統一エラーハンドリング
        const errorMessage =
          error?.status === 401 || error?.response?.status === 401
            ? '音声合成サービスの認証が必要です。ログインし直してください。'
            : error instanceof Error
              ? error.message
              : SPEECH_ERROR_MESSAGES.SYNTHESIS_FAILED;

        setState((prev) => ({
          ...prev,
          isSpeaking: false,
          isLoading: false,
          error: errorMessage,
          isPaused: false,
        }));
        mergedConfig.onError?.(errorMessage);
        log.error('Speech synthesis failed', { error, text: text.substring(0, 100) });
      }
    },
    [
      state.isSpeaking,
      state.isLoading,
      finalConfig,
      checkAvailability,
      stripMarkdownText,
      state.isSupported,
    ]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0; // 再生位置をリセット
      audioRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isSpeaking: false,
      isLoading: false,
      isPaused: false,
    }));

    log.info('Speech synthesis stopped');
  }, []);

  // Pause speaking
  const pauseSpeaking = useCallback(() => {
    log.info('useSpeechSynthesis: pauseSpeaking called', {
      hasAudio: !!audioRef.current,
      audioPaused: audioRef.current?.paused,
      currentState: state,
    });

    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isSpeaking: true, isPaused: true }));
      log.info('Speech synthesis paused at position:', audioRef.current.currentTime);
    } else {
      log.warn('pauseSpeaking called but audio not available or already paused', {
        hasAudio: !!audioRef.current,
        audioPaused: audioRef.current?.paused,
      });
    }
  }, [state]);

  // Resume speaking
  const resumeSpeaking = useCallback(() => {
    log.info('useSpeechSynthesis: resumeSpeaking called', {
      hasAudio: !!audioRef.current,
      audioPaused: audioRef.current?.paused,
      isPausedState: state.isPaused,
      currentState: state,
    });

    if (audioRef.current?.paused && state.isPaused) {
      audioRef.current
        .play()
        .then(() => {
          setState((prev) => ({ ...prev, isSpeaking: true, isPaused: false }));
          log.info('Speech synthesis resumed from position:', audioRef.current?.currentTime);
        })
        .catch((error) => {
          log.error('Failed to resume audio playback:', error);
          setState((prev) => ({ ...prev, error: '音声の再開に失敗しました' }));
        });
    } else {
      log.warn('No audio to resume or audio not paused', {
        hasAudio: !!audioRef.current,
        audioPaused: audioRef.current?.paused,
        isPausedState: state.isPaused,
      });
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return {
    // State
    ...state,

    // Methods
    speak,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
  };
};
