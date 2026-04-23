/**
 * @fileoverview 音声認識カスタムフック
 * @description Web Speech APIを使用した音声認識機能
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { createContextLogger } from '@/lib/logger';

import type {
  ISpeechRecognition,
  ISpeechRecognitionEvent,
} from '../../med-questionnaire/types/medicalQuestionnaire';

const log = createContextLogger('useSpeechRecognition');

interface ISpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  isPaused: boolean;
}

interface ISpeechRecognitionActions {
  startListening: () => void;
  stopListening: () => void;
  pauseListening: () => void;
  resumeListening: () => void;
  resetTranscript: () => void;
}

/**
 * 音声認識管理フック
 * @description Web Speech APIによる音声認識の管理
 * @returns 音声認識状態とアクション
 */
export const useSpeechRecognition = (): ISpeechRecognitionState & ISpeechRecognitionActions => {
  const { t, i18n } = useTranslation();

  // State management
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Speech recognition reference
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);

  /**
   * 音声認識を初期化
   */
  const initializeSpeechRecognition = useCallback(() => {
    try {
      // ブラウザサポートチェック
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        log.warn('Speech Recognition API not supported');
        setIsSupported(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // 基本設定
      recognition.continuous = true;
      recognition.interimResults = true;

      // 言語設定（i18nextの現在の言語に基づく）
      const currentLang = i18n.language;
      const langMap: Record<string, string> = {
        ja: 'ja-JP',
        en: 'en-US',
        ko: 'ko-KR',
        zh: 'zh-CN',
        de: 'de-DE',
        fr: 'fr-FR',
        es: 'es-ES',
        nl: 'nl-NL',
        pt: 'pt-BR',
      };

      recognition.lang = langMap[currentLang] || 'ja-JP';

      log.info('Speech recognition initialized', {
        language: recognition.lang,
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
      });

      // イベントハンドラ設定
      recognition.onstart = () => {
        log.info('Speech recognition started');
        setIsListening(true);
        setError(null);
        isListeningRef.current = true;
      };

      recognition.onend = () => {
        log.info('Speech recognition ended');
        setIsListening(false);
        setInterimTranscript('');
        isListeningRef.current = false;
      };

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interim = '';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (let i = event.resultIndex; i < (event.results as any).length; i++) {
          const result = event.results[i];
          if (result?.isFinal) {
            finalTranscript += result[0]?.transcript || '';
          } else if (result) {
            interim += result[0]?.transcript || '';
          }
        }

        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript);
          log.debug('Final transcript updated', {
            text: finalTranscript,
            confidence: event.results[event.resultIndex]?.[0]?.confidence || 0,
          });
        }

        setInterimTranscript(interim);

        // 自動停止タイマーをリセット
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // 3秒間無音状態が続いたら自動停止（医療問診では短時間で区切る）
        timeoutRef.current = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            log.info('Auto-stopping speech recognition due to silence');
            recognitionRef.current.stop();
          }
        }, 3000);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        log.error('Speech recognition error', { error: event.error });

        // "aborted" エラーは通常操作なので、エラーとして扱わない
        if (event.error === 'aborted') {
          log.debug('Speech recognition aborted (normal operation)');
          setIsListening(false);
          isListeningRef.current = false;
          return;
        }

        const errorMessages: Record<string, string> = {
          'no-speech': t('speechRecognition.errors.noSpeech'),
          'audio-capture': t('speechRecognition.errors.audioCapture'),
          'not-allowed': t('speechRecognition.errors.notAllowed'),
          network: t('speechRecognition.errors.network'),
          'service-not-allowed': t('speechRecognition.errors.serviceNotAllowed'),
          'bad-grammar': t('speechRecognition.errors.badGrammar'),
          'language-not-supported': t('speechRecognition.errors.languageNotSupported'),
        };

        const errorMessage = errorMessages[event.error] || t('speechRecognition.errors.unknown');
        setError(errorMessage);
        setIsListening(false);
        isListeningRef.current = false;
      };

      setIsSupported(true);
      log.info('Speech recognition setup completed');
    } catch (error) {
      log.error('Failed to initialize speech recognition', { error });
      setIsSupported(false);
      setError(t('speechRecognition.errors.initializationFailed'));
    }
  }, [i18n.language, t]);

  /**
   * 音声認識を開始
   */
  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError(t('speechRecognition.errors.notSupported'));
      return;
    }

    if (isListeningRef.current) {
      log.warn('Speech recognition already active');
      return;
    }

    try {
      // 既存のエラー状態をクリア
      setError(null);
      recognitionRef.current.start();
      log.info('Speech recognition start requested');
    } catch (error) {
      log.error('Failed to start speech recognition', { error });

      // "InvalidStateError" は既に実行中の場合なので、無視する
      if (error instanceof Error && error.name === 'InvalidStateError') {
        log.debug('Speech recognition already running, ignoring start request');
        return;
      }

      setError(t('speechRecognition.errors.startFailed'));
    }
  }, [isSupported, t]);

  /**
   * 音声認識を停止
   */
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListeningRef.current) {
      return;
    }

    try {
      recognitionRef.current.stop();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 状態を即座に更新
      setIsListening(false);
      isListeningRef.current = false;

      log.info('Speech recognition stop requested');
    } catch (error) {
      log.error('Failed to stop speech recognition', { error });
      setError(t('speechRecognition.errors.stopFailed'));
    }
  }, [t]);

  /**
   * 音声認識を一時停止
   */
  const pauseListening = useCallback(() => {
    if (!recognitionRef.current || !isListeningRef.current) {
      return;
    }

    try {
      recognitionRef.current.stop();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 一時停止状態にする
      setIsPaused(true);
      setIsListening(false);
      isListeningRef.current = false;

      log.info('Speech recognition paused');
    } catch (error) {
      log.error('Failed to pause speech recognition', { error });
    }
  }, []);

  /**
   * 音声認識を再開
   */
  const resumeListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current || !isPaused) {
      return;
    }

    try {
      // 既存のエラー状態をクリア
      setError(null);
      setIsPaused(false);
      recognitionRef.current.start();
      log.info('Speech recognition resumed');
    } catch (error) {
      log.error('Failed to resume speech recognition', { error });

      // "InvalidStateError" は既に実行中の場合なので、無視する
      if (error instanceof Error && error.name === 'InvalidStateError') {
        log.debug('Speech recognition already running, ignoring resume request');
        setIsPaused(false);
        return;
      }

      setError(t('speechRecognition.errors.startFailed'));
    }
  }, [isSupported, isPaused, t]);

  /**
   * トランスクリプトをリセット
   */
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    log.info('Transcript reset');
  }, []);

  /**
   * 初期化
   */
  useEffect(() => {
    initializeSpeechRecognition();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (recognitionRef.current && isListeningRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [initializeSpeechRecognition]);

  /**
   * 言語変更時の再初期化
   */
  useEffect(() => {
    if (isSupported) {
      initializeSpeechRecognition();
    }
  }, [initializeSpeechRecognition, isSupported]);

  /**
   * エラーを自動的にクリア
   */
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => {
        setError(null);
      }, 5000); // 5秒後にエラーをクリア

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [error]);

  return {
    // State
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    isPaused,

    // Actions
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    resetTranscript,
  };
};
