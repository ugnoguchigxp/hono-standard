/**
 * Speech Initializer Component
 * Speech機能の初期化状態を表示し、必要に応じて初期化ボタンを提供
 */

import React from 'react';

import { FaExclamationTriangle, FaMicrophone, FaSpinner } from 'react-icons/fa';

import { useSpeechStatus } from './SpeechProvider';

export interface SpeechInitializerProps {
  /** 初期化ボタンのスタイルクラス */
  className?: string;
  /** コンパクト表示（小さいボタン） */
  compact?: boolean;
  /** 自動初期化（マウント時に自動で初期化を試行） */
  autoInitialize?: boolean;
}

export const SpeechInitializer: React.FC<SpeechInitializerProps> = ({
  className = '',
  compact = false,
  autoInitialize = false,
}) => {
  const { isReady, isInitializing, error, canInitialize, initializeSpeech } = useSpeechStatus();

  // 自動初期化
  React.useEffect(() => {
    if (autoInitialize && canInitialize) {
      initializeSpeech();
    }
  }, [autoInitialize, canInitialize, initializeSpeech]);

  // 既に準備完了の場合は何も表示しない
  if (isReady) {
    return null;
  }

  // 初期化中
  if (isInitializing) {
    return (
      <div className={`flex items-center gap-2 text-blue-600 ${className}`}>
        <FaSpinner className="animate-spin" />
        <span className={compact ? 'text-sm' : ''}>Speech機能を初期化中...</span>
      </div>
    );
  }

  // エラー状態
  if (error) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-2 text-orange-600">
          <FaExclamationTriangle />
          <span className={compact ? 'text-sm' : ''}>Speech機能を利用できません</span>
        </div>
        {!compact && <p className="text-sm text-gray-600">{error}</p>}
        {canInitialize && (
          <button
            onClick={initializeSpeech}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            再試行
          </button>
        )}
      </div>
    );
  }

  // 初期化可能状態
  if (canInitialize) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-2 text-gray-600">
          <FaMicrophone />
          <span className={compact ? 'text-sm' : ''}>Speech機能を使用できます</span>
        </div>
        <button
          onClick={initializeSpeech}
          className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2 ${
            compact ? 'text-sm px-3 py-1' : ''
          }`}
        >
          <FaMicrophone />
          Speech機能を有効化
        </button>
      </div>
    );
  }

  return null;
};

/**
 * Speech機能の状態表示用のシンプルなインジケーター
 */
export const SpeechStatusIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isReady, isInitializing, error } = useSpeechStatus();

  if (isReady) {
    return (
      <div className={`flex items-center gap-1 text-green-600 ${className}`}>
        <FaMicrophone className="text-sm" />
        <span className="text-xs">Speech準備完了</span>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className={`flex items-center gap-1 text-blue-600 ${className}`}>
        <FaSpinner className="animate-spin text-sm" />
        <span className="text-xs">Speech初期化中</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-1 text-orange-600 ${className}`}>
        <FaExclamationTriangle className="text-sm" />
        <span className="text-xs">Speech無効</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-gray-400 ${className}`}>
      <FaMicrophone className="text-sm" />
      <span className="text-xs">Speech未初期化</span>
    </div>
  );
};
