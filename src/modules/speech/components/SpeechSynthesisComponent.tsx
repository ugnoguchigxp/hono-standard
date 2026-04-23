/**
 * 統一音声合成コンポーネント（簡潔版）
 * スピーカーボタンでの完全な音声合成制御UI
 *
 * このコンポーネントは音声合成のためのシンプルなスピーカーボタンを提供します。
 * クリックにより音声の再生、一時停止、再開、リスタートの完全制御が可能です。
 *
 * 主な機能:
 * - テキストの動的変更対応
 * - 完全な再生制御（再生/一時停止/再開/リスタート）
 * - アクセシビリティ対応（ARIA属性、キーボードナビゲーション）
 * - エラーハンドリングと状態管理
 * - 3段階のサイズ調整（sm/md/lg）
 *
 * @fileoverview 音声合成コンポーネント - シンプルなスピーカーボタンUI
 * @version 1.2.0
 * @author Development Team
 * @since 1.0.0
 *
 * @example
 * ```tsx
 * <SpeechSynthesisComponent
 *   text="読み上げるテキストです"
 *   size="md"
 *   afterSpeakout={() => console.log('完了')}
 * />
 * ```
 */

import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaPause, FaPlay, FaRedo, FaSpinner, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';

import { createContextLogger } from '@/lib/logger';

import type { SpeechSynthesisConfig } from '../hooks/types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

/**
 * ボタンサイズの定義
 */
export type SpeechButtonSize = 'sm' | 'md' | 'lg';

/**
 * 音声合成の状態定義
 */
type SynthesisState = 'idle' | 'playing' | 'paused' | 'completed';

/**
 * サイズに応じたアイコンのスタイルを取得
 *
 * @param size - アイコンサイズ
 * @returns アイコンのスタイルオブジェクト
 */
const log = createContextLogger('SpeechSynthesisComponent');

const getSizeStyles = (size: SpeechButtonSize) => {
  switch (size) {
    case 'sm':
      return {
        iconClass: 'w-4 h-4', // 16px相当の小さいアイコン
      };
    case 'lg':
      return {
        iconClass: 'w-8 h-8', // 32px相当の大きいアイコン
      };
    default:
      return {
        iconClass: 'w-6 h-6', // 24px相当の標準アイコン
      };
  }
};

/**
 * 音声合成コンポーネントのプロパティ定義
 *
 * このインターフェースは音声合成コンポーネントで使用可能な全てのプロパティを定義します。
 * テキストの動的変更、完全な再生制御、コールバック処理をサポートしています。
 *
 * @interface SpeechSynthesisComponentProps
 * @since v1.0.0
 *
 * @example
 * ```tsx
 * <SpeechSynthesisComponent
 *   text="こんにちは、世界！"
 *   size="md"
 *   afterSpeakout={() => console.log('読み上げ完了')}
 *   onError={(error) => console.error('エラー:', error)}
 * />
 * ```
 */
export interface SpeechSynthesisComponentProps {
  /**
   * 読み上げるテキスト
   *
   * 動的な変更に対応しており、テキストの追加が検出された場合は
   * 自動的に状態がリセットされ、新しいテキストでの読み上げが可能になります。
   *
   * @type {string}
   * @required
   * @example "こんにちは、世界！この文章を読み上げます。"
   */
  text: string;

  /**
   * 音声合成設定オプション
   *
   * 音声、言語、速度、音量などの詳細設定を指定できます。
   * 未指定の場合はデフォルト設定が使用されます。
   *
   * @type {Partial<SpeechSynthesisConfig>}
   * @optional
   * @see {@link SpeechSynthesisConfig}
   */
  config?: Partial<SpeechSynthesisConfig>;

  /**
   * 音声読み上げ開始時に実行されるコールバック
   *
   * @type {() => void}
   * @optional
   * @example () => console.log('読み上げ開始')
   */
  onStart?: () => void;

  /**
   * 音声読み上げ終了時に実行されるコールバック
   *
   * 正常終了、エラー終了の両方で呼び出されます。
   *
   * @type {() => void}
   * @optional
   * @example () => console.log('読み上げ終了')
   */
  onEnd?: () => void;

  /**
   * 音声読み上げ完全完了時に実行されるコールバック
   *
   * onEndとは異なり、正常に最後まで読み上げが完了した場合のみ呼び出されます。
   * エラーや中断による終了では呼び出されません。
   *
   * @type {() => void}
   * @optional
   * @since v1.2.0
   * @example () => triggerNextAction()
   */
  afterSpeakout?: () => void;

  /**
   * エラー発生時に実行されるコールバック
   *
   * @type {(error: string) => void}
   * @optional
   * @param error - エラーメッセージ
   * @example (error) => showNotification('エラー: ' + error)
   */
  onError?: (error: string) => void;

  /**
   * ボタンのサイズ指定
   *
   * 3つのサイズオプションから選択できます：
   * - 'sm': 小サイズ (16px)
   * - 'md': 標準サイズ (24px) - デフォルト
   * - 'lg': 大サイズ (32px)
   *
   * @type {SpeechButtonSize}
   * @optional
   * @default 'md'
   * @see {@link SpeechButtonSize}
   */
  size?: SpeechButtonSize;

  /**
   * 追加のCSSクラス名
   *
   * コンポーネントのルートdiv要素に適用されます。
   * Tailwind CSSクラスやカスタムCSSクラスを指定できます。
   *
   * @type {string}
   * @optional
   * @default ''
   * @example "mt-4 border border-gray-200"
   */
  className?: string;
}

export const SpeechSynthesisComponent: React.FC<SpeechSynthesisComponentProps> = ({
  text,
  config = {},
  onStart,
  onEnd,
  afterSpeakout,
  onError,
  size = 'md',
  className = '',
}) => {
  // コンポーネントのマウントを追跡
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9));
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  log.info('SpeechSynthesisComponent render', {
    componentId: componentIdRef.current,
    renderCount: renderCountRef.current,
    textLength: text.length,
    configKeys: Object.keys(config),
  });
  // propsの設定をそのまま使用（シンプル化）
  const localConfig = useMemo(() => {
    log.debug('SpeechSynthesisComponent: Config setup', {
      componentId: componentIdRef.current,
      renderCount: renderCountRef.current,
      propsConfig: config,
      configKeys: Object.keys(config),
    });
    return config;
  }, [config]);
  const [currentState, setCurrentState] = useState<SynthesisState>(() => {
    log.debug('SpeechSynthesisComponent: Initial state set to idle', {
      componentId: componentIdRef.current,
    });
    return 'idle';
  });

  // 状態変更をログ出力するラッパー関数
  const updateCurrentState = useCallback((newState: SynthesisState, reason: string) => {
    setCurrentState((prev) => {
      log.debug('SpeechSynthesisComponent: State change', {
        componentId: componentIdRef.current,
        from: prev,
        to: newState,
        reason,
      });
      return newState;
    });
  }, []); // 依存配列を空にして安定した関数にする
  const previousTextRef = useRef<string>(text);
  const isTextAddedRef = useRef<boolean>(false);

  // テキストの動的変更を監視（主に追加を想定）
  useEffect(() => {
    const previousText = previousTextRef.current;
    const currentText = text;

    // テキストが追加された場合（前のテキストが現在のテキストの先頭部分と一致）
    if (
      currentText.length > previousText.length &&
      currentText.startsWith(previousText) &&
      previousText.trim() !== ''
    ) {
      isTextAddedRef.current = true;
      // テキストが追加された場合は状態をリセット
      if (currentState === 'completed') {
        updateCurrentState('idle', 'text added - reset from completed');
      }
    } else if (currentText !== previousText) {
      isTextAddedRef.current = false;
      // テキストが変更された場合は状態をリセット
      updateCurrentState('idle', 'text changed - reset to idle');
    }

    previousTextRef.current = currentText;
  }, [text, currentState, updateCurrentState]);

  // useSpeechSynthesisに渡す設定をメモ化して再初期化を防ぐ
  const synthesisConfig = useMemo(() => {
    const handleStart = () => {
      try {
        updateCurrentState('playing', 'onStart callback');
        onStart?.();
      } catch (error) {
        log.error('SpeechSynthesisComponent: onStart callback failed', error);
      }
    };

    const handleEnd = () => {
      try {
        updateCurrentState('completed', 'onEnd callback');
        onEnd?.();
        // 読み上げ完了後のコールバック実行
        afterSpeakout?.();
      } catch (error) {
        log.error('SpeechSynthesisComponent: onEnd callback failed', error);
        // コールバックエラーでもコンポーネント状態は正常に保つ
        updateCurrentState('completed', 'onEnd callback error fallback');
      }
    };

    const handleError = (error: string) => {
      try {
        updateCurrentState('idle', 'onError callback');
        onError?.(error);
      } catch (callbackError) {
        log.error('SpeechSynthesisComponent: onError callback failed', callbackError);
        // エラーコールバック自体がエラーでも状態はリセット
        updateCurrentState('idle', 'onError callback error fallback');
      }
    };

    return {
      ...localConfig,
      onStart: handleStart,
      onEnd: handleEnd,
      onError: handleError,
    };
  }, [localConfig, onStart, onEnd, afterSpeakout, onError, updateCurrentState]);

  const synthesis = useSpeechSynthesis(synthesisConfig);

  // synthesis.isPausedの状態変更を監視してローカル状態を同期
  useEffect(() => {
    log.debug('SpeechSynthesisComponent: State sync check', {
      componentId: componentIdRef.current,
      synthesisPaused: synthesis?.isPaused,
      synthesisLoading: synthesis?.isLoading,
      synthesisSpeaking: synthesis?.isSpeaking,
      synthesisSupported: synthesis?.isSupported,
      synthesisError: synthesis?.error,
      currentState,
    });

    // 音声再生開始時: synthesis.isSpeaking = true になったら playing 状態に変更
    if (synthesis?.isSpeaking && !synthesis?.isPaused && currentState !== 'playing') {
      updateCurrentState('playing', 'synthesis isSpeaking detected');
    }
    // 一時停止時: synthesis.isPaused = true になったら paused 状態に変更
    else if (synthesis?.isPaused && currentState === 'playing') {
      updateCurrentState('paused', 'synthesis isPaused detected');
    }
    // 再開時: synthesis.isPaused = false かつ isSpeaking = true になったら playing 状態に変更
    else if (!synthesis?.isPaused && currentState === 'paused' && synthesis?.isSpeaking) {
      updateCurrentState('playing', 'synthesis resumed detected');
    }
    // 音声停止時: synthesis.isSpeaking = false かつ isPaused = false になったら completed 状態に変更
    else if (!synthesis?.isSpeaking && !synthesis?.isPaused && currentState === 'playing') {
      updateCurrentState('completed', 'synthesis stopped detected');
    }
  }, [
    synthesis?.isPaused,
    synthesis?.isSpeaking,
    currentState,
    updateCurrentState,
    synthesis?.error,
    synthesis?.isSupported,
    synthesis?.isLoading,
  ]);

  // コンポーネントのアンマウントを追跡
  useEffect(() => {
    log.info('SpeechSynthesisComponent mounted', {
      componentId: componentIdRef.current,
    });

    return () => {
      log.info('SpeechSynthesisComponent unmounted', {
        componentId: componentIdRef.current,
        finalState: currentState,
      });
    };
  }, [currentState]); // 空の依存配列でマウント/アンマウントのみを監視

  /**
   * 音声読み上げを開始する関数
   *
   * テキストが空でない場合にのみ音声合成を実行します。
   * 実行時に状態は自動的に'playing'に変更され、完了時には'completed'状態になります。
   *
   * @function handleSpeak
   * @description 現在のtextプロパティを使用して音声読み上げを開始
   * @returns {void} 戻り値なし
   * @throws {Error} テキストが空の場合やサポートされていない場合はエラーをスロー
   * @see {@link useSpeechSynthesis} - 実際の音声合成処理を担当するカスタムフック
   * @since v1.0.0
   */
  const handleSpeak = useCallback(() => {
    log.info('SpeechSynthesisComponent: handleSpeak called', {
      componentId: componentIdRef.current,
      textLength: text.trim().length,
      hasText: !!text.trim(),
      synthesisSupported: synthesis?.isSupported,
      synthesisLoading: synthesis?.isLoading,
      synthesisSpeaking: synthesis?.isSpeaking,
      currentState,
      localConfigKeys: Object.keys(localConfig),
    });

    try {
      if (!text.trim()) {
        throw new Error('読み上げるテキストが空です');
      }
      if (!synthesis?.isSupported) {
        throw new Error('このブラウザでは音声合成がサポートされていません');
      }

      log.info('SpeechSynthesisComponent: Calling synthesis.speak', {
        componentId: componentIdRef.current,
        text: `${text.trim().substring(0, 50)}...`,
        config: localConfig,
      });

      synthesis?.speak(text.trim(), localConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '音声合成の開始に失敗しました';
      onError?.(errorMessage);
      log.error('SpeechSynthesisComponent: handleSpeak failed', error);
    }
  }, [text, synthesis, localConfig, onError, currentState]);

  const handlePause = useCallback(() => {
    log.info('SpeechSynthesisComponent: handlePause called', {
      componentId: componentIdRef.current,
      synthesisSpeaking: synthesis?.isSpeaking,
      synthesisPaused: synthesis?.isPaused,
    });
    synthesis?.pauseSpeaking();
    updateCurrentState('paused', 'handlePause called');
  }, [synthesis, updateCurrentState]);

  const handleResume = useCallback(() => {
    log.info('SpeechSynthesisComponent: handleResume called', {
      componentId: componentIdRef.current,
      synthesisSpeaking: synthesis?.isSpeaking,
      synthesisPaused: synthesis?.isPaused,
    });
    synthesis?.resumeSpeaking();
    // 状態同期useEffectに依存せず明示的に状態変更
    updateCurrentState('playing', 'handleResume called');
  }, [synthesis, updateCurrentState]);

  const handleRestart = useCallback(() => {
    log.info('SpeechSynthesisComponent: handleRestart called', {
      componentId: componentIdRef.current,
    });
    updateCurrentState('idle', 'handleRestart called');
    handleSpeak();
  }, [handleSpeak, updateCurrentState]);

  /**
   * ボタンクリック時の状態別動作制御関数
   *
   * 現在の音声合成状態に基づいて適切なアクションを実行します：
   * - idle: 読み上げ開始
   * - playing: 一時停止
   * - paused: 再生再開
   * - completed: 最初から再開
   *
   * @function handleButtonClick
   * @description 音声合成コンポーネントのメインボタンクリックハンドラー
   * @returns {void} 戻り値なし
   * @example
   * // ボタンクリック時の動作例
   * // 状態が'idle'の場合 → handleSpeak()を実行
   * // 状態が'playing'の場合 → handlePause()を実行
   * handleButtonClick();
   *
   * @see {@link SynthesisState} - 音声合成の状態定義
   * @since v1.0.0
   */
  const handleButtonClick = useCallback(() => {
    log.info('SpeechSynthesisComponent: Button clicked', {
      componentId: componentIdRef.current,
      currentState,
      synthesisLoading: synthesis?.isLoading,
      synthesisSpeaking: synthesis?.isSpeaking,
      synthesisPaused: synthesis?.isPaused,
      textLength: text.length,
    });

    if (synthesis?.isLoading) {
      log.warn('SpeechSynthesisComponent: Button click ignored - synthesis is loading');
      return;
    }

    switch (currentState) {
      case 'idle':
        log.info('SpeechSynthesisComponent: Starting speech from idle');
        handleSpeak();
        break;
      case 'playing':
        log.info('SpeechSynthesisComponent: Pausing speech from playing');
        handlePause();
        break;
      case 'paused':
        log.info('SpeechSynthesisComponent: Resuming speech from paused');
        handleResume();
        break;
      case 'completed':
        log.info('SpeechSynthesisComponent: Restarting speech from completed');
        handleRestart();
        break;
    }
  }, [
    currentState,
    synthesis?.isLoading,
    synthesis?.isSpeaking,
    synthesis?.isPaused,
    handleSpeak,
    handlePause,
    handleResume,
    handleRestart,
    text.length,
  ]);

  // Speaker Button
  const SpeakerButton = () => {
    const sizeStyles = getSizeStyles(size);

    // アイコンの選択ロジック
    const getIcon = () => {
      if (synthesis?.isLoading) {
        return <FaSpinner className={`${sizeStyles.iconClass} animate-spin`} />;
      }

      if (!synthesis?.isSupported) {
        return <FaVolumeMute className={sizeStyles.iconClass} />;
      }

      switch (currentState) {
        case 'idle':
          return <FaVolumeUp className={sizeStyles.iconClass} />;
        case 'playing':
          return <FaPause className={sizeStyles.iconClass} />;
        case 'paused':
          return <FaPlay className={sizeStyles.iconClass} />;
        case 'completed':
          return <FaRedo className={sizeStyles.iconClass} />;
        default:
          return <FaVolumeUp className={sizeStyles.iconClass} />;
      }
    };

    // ボタンの色の選択ロジック
    const getButtonColor = () => {
      if (!synthesis?.isSupported) {
        return 'text-gray-400';
      }

      switch (currentState) {
        case 'idle':
          return 'text-blue-600 hover:text-blue-700';
        case 'playing':
          return 'text-green-600 hover:text-green-700';
        case 'paused':
          return 'text-orange-600 hover:text-orange-700';
        case 'completed':
          return 'text-purple-600 hover:text-purple-700';
        default:
          return 'text-blue-600 hover:text-blue-700';
      }
    };

    // ツールチップテキスト
    const getTooltip = () => {
      if (synthesis?.isLoading) return '処理中...';
      if (!synthesis?.isSupported) return '音声合成がサポートされていません';
      if (!text.trim()) return 'テキストが空です';

      switch (currentState) {
        case 'idle':
          return 'テキストを読み上げ';
        case 'playing':
          return '一時停止';
        case 'paused':
          return '再生再開';
        case 'completed':
          return '最初から読み直し';
        default:
          return 'テキストを読み上げ';
      }
    };

    return (
      <motion.button
        onClick={handleButtonClick}
        disabled={!text.trim() || synthesis?.isLoading || !synthesis?.isSupported}
        className={`rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${getButtonColor()} hover:bg-gray-100 focus:outline-none`}
        animate={currentState === 'playing' ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        title={getTooltip()}
        aria-label={getTooltip()}
        aria-pressed={currentState === 'playing'}
        aria-disabled={!text.trim() || synthesis?.isLoading || !synthesis?.isSupported}
        role="button"
        tabIndex={0}
        id="speech-synthesis-button"
        data-state={currentState}
        data-loading={synthesis?.isLoading}
      >
        {getIcon()}
      </motion.button>
    );
  };

  return (
    <div
      className={`inline-flex relative ${className}`}
      role="region"
      aria-label="音声合成コントロール"
      id="speech-synthesis-component"
    >
      <SpeakerButton />

      {/* Error Display - Positioned tooltip-style */}
      <AnimatePresence>
        {synthesis?.error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute z-10 mt-12 p-2 bg-red-100 border border-red-300 rounded-md shadow-lg"
            role="alert"
            aria-live="polite"
            id="speech-synthesis-error"
          >
            <div className="text-red-700 text-sm">エラー: {synthesis?.error}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
