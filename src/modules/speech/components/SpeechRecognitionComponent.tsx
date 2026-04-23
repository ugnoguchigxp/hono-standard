/**
 * 統一音声認識コンポーネント
 *
 * Azure Speech Service を使用したリアルタイム音声認識機能を提供するコンポーネント。
 * シンプルなアイコンボタンUIで音声の録音・認識を制御し、認識結果をリアルタイムで取得できます。
 *
 * @features
 * - リアルタイム音声認識（3秒間隔のチャンク処理）
 * - WebAudio API による高品質音声録音
 * - WAV PCM形式でのAzure Speech API互換性
 * - 部分認識結果と最終認識結果の区別
 * - マイクアクセス許可とエラーハンドリング
 * - シンプルな色付きアイコンUI（背景なし）
 *
 * @technical
 * - WebAudio API + ScriptProcessorNode で16kHz/16bit/mono録音
 * - 3秒間隔でのチャンク認識によるリアルタイム処理
 * - Azure Speech Service REST API (japaneast region)
 * - Framer Motion によるアニメーション
 *
 * @dependencies
 * - useAzureSpeech フック（音声認識ロジック）
 * - Framer Motion（アニメーション）
 * - React Icons（UIアイコン）
 *
 * @example
 * ```tsx
 * <SpeechRecognitionComponent
 *   onResult={(transcript, isFinal) => {
 *     if (isFinal) {
 *       console.log('Final:', transcript);
 *     } else {
 *       console.log('Partial:', transcript);
 *     }
 *   }}
 *   onError={(error) => console.error('Speech error:', error)}
 *   size="md"
 *   className="ml-4"
 * />
 * ```
 *
 * @author Claude Code
 * @version 2.0.0
 * @since 2025-01-19
 */

import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { FaCommentDots } from 'react-icons/fa';

import { createContextLogger } from '@/lib/logger';

import { useAzureSpeech } from '../hooks/useAzureSpeech';

const log = createContextLogger('SpeechRecognitionComponent');

/**
 * サイズに応じたアイコンのスタイルを取得
 *
 * @param size - アイコンサイズ
 * @returns アイコンのスタイルオブジェクト
 */
const getSizeStyles = (size: SpeechButtonSize) => {
  switch (size) {
    case 'sm':
      return {
        iconClass: 'text-xs', // 12px相当の小さいアイコン
      };
    case 'lg':
      return {
        iconClass: 'text-2xl', // 36px相当の大きいアイコン
      };
    default:
      return {
        iconClass: 'text-lg', // 24px相当の標準アイコン
      };
  }
};

/**
 * ボタンサイズの定義
 */
export type SpeechButtonSize = 'sm' | 'md' | 'lg';

/**
 * SpeechRecognitionComponent のプロパティ定義
 *
 * @interface SpeechRecognitionComponentProps
 */
export interface SpeechRecognitionComponentProps {
  /**
   * 音声認識結果のコールバック関数
   *
   * @param transcript - 認識されたテキスト
   * @param isFinal - true: 最終結果, false: 部分結果（リアルタイム）
   *
   * @example
   * ```tsx
   * onResult={(text, final) => {
   *   if (final) {
   *     setFinalText(prev => prev + ' ' + text);
   *   } else {
   *     setPartialText(text);
   *   }
   * }}
   * ```
   */
  onResult?: (transcript: string, isFinal: boolean) => void;

  /**
   * エラー発生時のコールバック関数
   *
   * @param error - エラーメッセージ
   *
   * @example
   * ```tsx
   * onError={(error) => {
   *   console.error('Speech recognition error:', error);
   *   setErrorMessage(error);
   * }}
   * ```
   */
  onError?: (error: string) => void;

  /**
   * ボタンのサイズ
   *
   * @default 'md'
   * @example
   * - 'sm': 12px x 12px (小サイズ)
   * - 'md': 24px x 24px (中サイズ - デフォルト)
   * - 'lg': 36px x 36px (大サイズ)
   */
  size?: SpeechButtonSize;

  /**
   * コンポーネントのカスタムCSS クラス名
   *
   * @default ''
   * @example 'ml-4 mb-2'
   */
  className?: string;
}

/**
 * Azure Speech Service を使用したリアルタイム音声認識コンポーネント
 *
 * このコンポーネントは、色付きの吹き出しアイコンとして表示され、クリックで音声録音を開始/停止します。
 * 音声はリアルタイムで認識され、部分結果と最終結果を区別してコールバックで通知します。
 *
 * @component
 * @param props - コンポーネントのプロパティ
 * @param props.onResult - 音声認識結果のコールバック
 * @param props.onError - エラー発生時のコールバック
 * @param props.size - ボタンサイズ ('sm' | 'md' | 'lg')
 * @param props.className - カスタムCSSクラス名
 *
 * @returns 音声認識ボタンコンポーネント
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [text, setText] = useState('');
 *   const [partial, setPartial] = useState('');
 *
 *   return (
 *     <div>
 *       <SpeechRecognitionComponent
 *         onResult={(transcript, isFinal) => {
 *           if (isFinal) {
 *             setText(prev => prev + ' ' + transcript);
 *             setPartial('');
 *           } else {
 *             setPartial(transcript);
 *           }
 *         }}
 *         onError={console.error}
 *         size="md"
 *         className="mx-auto"
 *       />
 *       <div>確定テキスト: {text}</div>
 *       <div>認識中: {partial}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export const SpeechRecognitionComponent: React.FC<SpeechRecognitionComponentProps> = ({
  onResult,
  onError,
  size = 'md',
  className = '',
}) => {
  const {
    isListening,
    isRecognizing,
    recognizedText,
    partialText,
    startListening,
    stopListening,
    clearRecognizedText,
    isConfigured,
    isBackendConfigured,
    isConfigLoading,
    configError,
    initializationError: error,
  } = useAzureSpeech() as any;

  // Note: Speech service initialization is handled internally by the hook

  // Handle real-time partial results with throttling
  const throttledPartialResult = React.useMemo(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    return (text: string) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        onResult?.(text, false); // false = interim result
        log.debug('Partial speech result passed to parent', { text });
      }, 100); // 100ms throttling for smooth UI
    };
  }, [onResult]);

  React.useEffect(() => {
    if (partialText) {
      throttledPartialResult(partialText);
    }
  }, [partialText, throttledPartialResult]);

  // Handle final speech recognition result
  React.useEffect(() => {
    if (recognizedText && onResult) {
      onResult(recognizedText, true); // true = final result
      log.info('Final speech recognized and passed to parent', { text: recognizedText });
      clearRecognizedText();
    }
  }, [recognizedText, onResult, clearRecognizedText]);

  // Handle errors
  React.useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Prevent multiple rapid clicks with debouncing
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle button click with enhanced error handling
  const handleClick = useCallback(async () => {
    // Prevent multiple simultaneous clicks and rapid clicking
    if (isProcessing || (isRecognizing && !isListening)) {
      log.debug('Speech recognition in progress or processing, ignoring click');
      return;
    }

    setIsProcessing(true);

    log.debug('Speech button clicked', {
      isListening,
      isRecognizing,
      isConfigured,
      error,
    });

    try {
      if (isListening) {
        log.debug('Stopping listening...');
        stopListening();
      } else {
        log.debug('Starting listening...');
        await startListening();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Speech button action failed', { error, errorMessage });

      // Provide comprehensive user-friendly error messages
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('NotAllowedError') || errorMessage.includes('denied')) {
        userFriendlyMessage =
          'マイクアクセスが拒否されました。ブラウザの設定でマイクを許可してください。';
      } else if (errorMessage.includes('NotFoundError')) {
        userFriendlyMessage = 'マイクが見つかりません。マイクが接続されているか確認してください。';
      } else if (errorMessage.includes('NotSupportedError')) {
        userFriendlyMessage =
          'このブラウザは音声認識をサポートしていません。Chrome等をお試しください。';
      } else if (errorMessage.includes('AbortError')) {
        userFriendlyMessage = '音声認識がキャンセルされました。再度お試しください。';
      } else if (errorMessage.includes('NetworkError') || errorMessage.includes('network')) {
        userFriendlyMessage = 'ネットワークエラーが発生しました。接続を確認してください。';
      } else if (errorMessage.includes('ServiceUnavailableError')) {
        userFriendlyMessage =
          '音声認識サービスが利用できません。しばらく待ってからお試しください。';
      }

      onError?.(userFriendlyMessage);
    } finally {
      // Reset processing flag after a short delay
      setTimeout(() => setIsProcessing(false), 300);
    }
  }, [
    isListening,
    isRecognizing,
    startListening,
    stopListening,
    onError,
    isConfigured,
    error,
    isProcessing,
  ]);

  // サイズに応じたスタイルを取得（メモ化）
  const sizeStyles = React.useMemo(() => getSizeStyles(size), [size]);

  // 音声機能が利用可能かチェック（ローディング中は利用可能として表示）
  const speechAvailable = isConfigLoading || isConfigured || isBackendConfigured;

  if (!speechAvailable && !isConfigLoading) {
    return (
      <div className={`inline-flex ${className}`}>
        <button
          disabled
          className={`cursor-not-allowed opacity-50 rounded-sm`}
          title="Azure Speech設定が必要です（サーバー管理者にお問い合わせください）"
          aria-label="音声認識（無効）"
          aria-describedby="speech-config-required"
          tabIndex={-1}
        >
          <FaCommentDots className={`${sizeStyles.iconClass} text-gray-400`} />
          <span id="speech-config-required" className="sr-only">
            Azure Speech設定が必要です
          </span>
        </button>
      </div>
    );
  }

  // シンプルな色付き吹き出しアイコンのみのUI
  return (
    <div className={`inline-flex ${className}`}>
      <motion.button
        onClick={handleClick}
        disabled={!speechAvailable || isProcessing}
        className={`
          transition-all duration-200 hover:scale-105 
          disabled:opacity-50 disabled:cursor-not-allowed 
          focus:outline-none 
          rounded-sm
          ${isProcessing ? 'animate-pulse' : ''}
        `}
        whileHover={!isProcessing ? { scale: 1.05 } : {}}
        whileTap={!isProcessing ? { scale: 0.95 } : {}}
        title={isListening ? '音声認識を停止' : '音声認識を開始'}
        aria-label={isListening ? '音声認識を停止' : '音声認識を開始'}
        aria-pressed={isListening}
        role="button"
      >
        {isListening ? (
          <Mic
            className={`${sizeStyles.iconClass} ${
              isRecognizing ? 'animate-pulse text-red-500' : 'text-red-500'
            }`}
          />
        ) : (
          <FaCommentDots className={`${sizeStyles.iconClass} text-blue-500`} />
        )}
      </motion.button>

      {/* Debug info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="ml-2 text-xs text-gray-500">
          <div>Listening: {isListening ? 'Yes' : 'No'}</div>
          <div>Recognizing: {isRecognizing ? 'Yes' : 'No'}</div>
          <div>Configured: {isConfigured ? 'Yes' : 'No'}</div>
          <div>Backend Configured: {isBackendConfigured ? 'Yes' : 'No'}</div>
          <div>Loading: {isConfigLoading ? 'Yes' : 'No'}</div>
          <div>Available: {speechAvailable ? 'Yes' : 'No'}</div>
          {error && <div className="text-red-500">Init Error: {error}</div>}
          {configError && <div className="text-red-500">Config Error: {configError.message}</div>}
        </div>
      )}
    </div>
  );
};
