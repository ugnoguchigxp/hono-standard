/**
 * Speech Provider
 * Speech機能の初期化から利用開始までを管理する共通部品
 */

import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { createContextLogger } from '@/lib/logger';
import { useAzureSpeech } from '../hooks/useAzureSpeech';

const log = createContextLogger('SpeechProvider');

export interface SpeechContextValue {
  // 初期化状態
  isReady: boolean;
  isInitializing: boolean;
  initializationError: string | null;

  // Speech機能の状態
  isListening: boolean;
  isRecognizing: boolean;
  isSpeaking: boolean;
  isAutoPlaying: boolean;

  // 認識結果
  recognizedText: string;
  partialText: string;

  // 制御関数
  initializeSpeech: () => Promise<boolean>;
  startListening: () => Promise<void>;
  stopListening: () => void;
  speak: (text: string, options?: { stripMarkdown?: boolean; maxLength?: number }) => Promise<void>;
  stopSpeaking: () => void;
  clearRecognizedText: () => void;

  // Auto Speech
  playAutoSpeech: (speechData: {
    fileId: string;
    fileUrl: string;
    chunks?: number;
    textLength?: number;
  }) => Promise<void>;
  stopAutoSpeech: () => void;

  // 会話モード
  isConversationMode: boolean;
  startConversationMode: (callbacks?: {
    onMessageRecognized?: (text: string) => Promise<void>;
    onResponseReceived?: () => void;
  }) => Promise<void>;
  stopConversationMode: () => void;
}

const SpeechContext = createContext<SpeechContextValue | null>(null);

export interface SpeechProviderProps {
  children: React.ReactNode;
  /** trueの場合、マウント時に自動で初期化を試行 */
  autoInitialize?: boolean;
}

export const SpeechProvider: React.FC<SpeechProviderProps> = ({
  children,
  autoInitialize = false,
}) => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // useAzureSpeechフックを自動初期化なしで使用
  const speech = useAzureSpeech() as any;

  // Speech初期化関数
  const initializeSpeech = useCallback(async (): Promise<boolean> => {
    if (isReady || isInitializing) {
      return isReady;
    }

    if (!isAuthenticated) {
      const errorMsg = 'Speech機能を使用するにはログインが必要です';
      setInitializationError(errorMsg);
      log.debug('Cannot initialize Speech - user not authenticated');
      return false;
    }

    setIsInitializing(true);
    setInitializationError(null);

    try {
      log.info('Initializing Speech service for page');

      // speech.initialize が存在しない場合は成功とみなすか、何もしない
      const success = typeof speech.initialize === 'function' ? await speech.initialize() : true;

      if (success) {
        setIsReady(true);
        setInitializationError(null);
        log.info('Speech service initialized successfully');
        return true;
      } else {
        const errorMsg = speech.initializationError || 'Speech機能の初期化に失敗しました';
        setInitializationError(errorMsg);
        log.debug('Speech service initialization failed', { error: errorMsg });
        return false;
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Speech機能の初期化でエラーが発生しました';
      setInitializationError(errorMsg);
      log.debug('Speech service initialization error', { error });
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [isReady, isInitializing, isAuthenticated, speech]);

  // 自動初期化（オプション）
  useEffect(() => {
    if (autoInitialize && isAuthenticated) {
      log.debug('Auto-initializing Speech service');
      initializeSpeech();
    }
  }, [autoInitialize, isAuthenticated, initializeSpeech]);

  // ログアウト時のクリーンアップ
  useEffect(() => {
    if (!isAuthenticated && isReady) {
      log.debug('User logged out, resetting Speech state');
      setIsReady(false);
      setInitializationError(null);
    }
  }, [isAuthenticated, isReady]);

  const contextValue: SpeechContextValue = {
    // 初期化状態
    isReady,
    isInitializing,
    initializationError,

    // Speech機能の状態
    isListening: speech.isListening || false,
    isRecognizing: speech.isRecognizing || false,
    isSpeaking: speech.isSpeaking || false,
    isAutoPlaying: speech.isAutoPlaying || false,

    // 認識結果
    recognizedText: speech.recognizedText || '',
    partialText: speech.partialText || '',

    // 制御関数
    initializeSpeech,
    startListening: speech.startListening || (async () => {}),
    stopListening: speech.stopListening || (() => {}),
    speak: speech.speak || (async () => {}),
    stopSpeaking: speech.stopSpeaking || (() => {}),
    clearRecognizedText: speech.clearRecognizedText || (() => {}),

    // Auto Speech
    playAutoSpeech: speech.playAutoSpeech || (async () => {}),
    stopAutoSpeech: speech.stopAutoSpeech || (() => {}),

    // 会話モード
    isConversationMode: speech.isConversationMode || false,
    startConversationMode: speech.startConversationMode || (async () => {}),
    stopConversationMode: speech.stopConversationMode || (() => {}),
  };

  return <SpeechContext.Provider value={contextValue}>{children}</SpeechContext.Provider>;
};

/**
 * Speech機能を使用するためのフック
 * SpeechProvider内で使用する必要があります
 */
export const useSpeech = (): SpeechContextValue => {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error('useSpeech must be used within a SpeechProvider');
  }
  return context;
};

/**
 * Speech機能の初期化状態を確認するフック
 * 必要に応じて初期化を促すUIを表示するために使用
 */
export const useSpeechStatus = () => {
  const speech = useSpeech();

  return {
    isReady: speech.isReady,
    isInitializing: speech.isInitializing,
    error: speech.initializationError,
    canInitialize: !speech.isReady && !speech.isInitializing,
    initializeSpeech: speech.initializeSpeech,
  };
};

/**
 * 読み上げ専用フック
 * 読み上げ機能のみを使用したい場合に利用
 * SpeechProvider内で使用する必要があります
 */
export const useTextToSpeech = (options: { stripMarkdown?: boolean; maxLength?: number } = {}) => {
  const speech = useSpeech();
  const { stripMarkdown = true, maxLength = 900 } = options;

  // Markdownテキストをプレーンテキストに変換
  const stripMarkdownText = useCallback((text: string): string => {
    return (
      text
        // 見出し記号を削除 (# ## ### など)
        .replace(/^#{1,6}\s+/gm, '')
        // 太字・斜体記号を削除 (**text**, *text*, __text__, _text_)
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        // 取り消し線を削除 (~~text~~)
        .replace(/~~(.*?)~~/g, '$1')
        // インラインコードを削除 (`code`)
        .replace(/`([^`]*)`/g, '$1')
        // コードブロックを削除 (```code```)
        .replace(/```[\s\S]*?```/g, '')
        // リンクを削除 ([text](url) -> text)
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        // 画像を削除 (![alt](url))
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        // 引用記号を削除 (> text)
        .replace(/^>\s+/gm, '')
        // リスト記号を削除 (- item, * item, + item, 1. item)
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // 水平線を削除 (--- or ***)
        .replace(/^[\s]*[-*]{3,}[\s]*$/gm, '')
        // テーブル記号を削除
        .replace(/\|/g, ' ')
        // 連続する空白を1つにまとめる
        .replace(/\s+/g, ' ')
        // 前後の空白を削除
        .trim()
    );
  }, []);

  const playText = useCallback(
    async (text: string) => {
      if (!text?.trim()) {
        log.warn('Empty text provided for speech');
        return;
      }

      // 初期化されていない場合は先に初期化
      if (!speech.isReady) {
        const initialized = await speech.initializeSpeech();
        if (!initialized) {
          throw new Error('Speech機能の初期化に失敗しました');
        }
      }

      // 現在再生中の場合は停止
      if (speech.isSpeaking || speech.isAutoPlaying) {
        speech.stopSpeaking();
        speech.stopAutoSpeech();
      }

      // Markdownを除去してプレーンテキストに変換
      const processedText = stripMarkdown ? stripMarkdownText(text) : text;

      // テキストを指定された長さに制限
      const textToSpeak =
        processedText.length > maxLength
          ? `${processedText.substring(0, maxLength)}...`
          : processedText;

      // SpeechProviderのspeak関数を使用
      await speech.speak(textToSpeak, { stripMarkdown: false, maxLength });
    },
    [speech, stripMarkdown, stripMarkdownText, maxLength]
  );

  const stopSpeech = useCallback(() => {
    speech.stopSpeaking();
    speech.stopAutoSpeech();
  }, [speech]);

  return {
    // 状態
    isSpeaking: speech.isSpeaking,
    isAutoPlaying: speech.isAutoPlaying,
    isPlaying: speech.isSpeaking || speech.isAutoPlaying, // 互換性のため
    error: speech.initializationError,
    isReady: speech.isReady,

    // アクション
    playText,
    speak: speech.speak,
    stopSpeech,
    stopSpeaking: speech.stopSpeaking,
    playAutoSpeech: speech.playAutoSpeech,
    stopAutoSpeech: speech.stopAutoSpeech,
    initializeSpeech: speech.initializeSpeech,
  };
};
