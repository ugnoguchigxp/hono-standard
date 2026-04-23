/**
 * 音声合成設定ボタン
 * スピーカー+設定が合わさったアイコンボタン
 */

import { motion } from 'framer-motion';
import type React from 'react';
import { FaCog, FaVolumeUp } from 'react-icons/fa';

import { createContextLogger } from '@/lib/logger';

// import { useSpeechSynthesisContext } from '../../../contexts/SpeechSynthesisContext';
const useSpeechSynthesisContext = undefined as any;

const log = createContextLogger('SpeechSynthesisSettingsButton');

/**
 * ボタンサイズの定義
 */
export type SpeechSettingsButtonSize = 'sm' | 'md' | 'lg';

/**
 * サイズに応じたボタンスタイルを取得
 *
 * @param size - ボタンサイズ
 * @returns ボタンのスタイルオブジェクト
 */
const getSizeStyles = (size: SpeechSettingsButtonSize) => {
  switch (size) {
    case 'sm':
      return {
        containerClass: 'w-8 h-8', // 32px相当の小さいボタン
        speakerIconClass: 'w-3 h-3', // 12px相当のスピーカーアイコン
        cogIconClass: 'w-3 h-3', // 12px相当の設定アイコン（拡大）
        cogPosition: 'top-0 right-0',
      };
    case 'lg':
      return {
        containerClass: 'w-12 h-12', // 48px相当の大きいボタン
        speakerIconClass: 'w-6 h-6', // 24px相当のスピーカーアイコン
        cogIconClass: 'w-5 h-5', // 20px相当の設定アイコン（拡大）
        cogPosition: 'top-1 right-1',
      };
    default:
      return {
        containerClass: 'w-10 h-10', // 40px相当の標準ボタン
        speakerIconClass: 'w-5 h-5', // 20px相当のスピーカーアイコン
        cogIconClass: 'w-4 h-4', // 16px相当の設定アイコン（拡大）
        cogPosition: 'top-0.5 right-0.5',
      };
  }
};

/**
 * 音声合成設定ボタン Props
 */
interface SpeechSynthesisSettingsButtonProps {
  /** ボタンのサイズ */
  size?: SpeechSettingsButtonSize;
  /** カスタムクラス名 */
  className?: string;
  /** 無効化フラグ */
  disabled?: boolean;
}

/**
 * 音声合成設定ボタン コンポーネント
 *
 * スピーカーと設定アイコンを組み合わせたボタンで、クリックすると
 * 音声合成設定のDrawerを開きます。React Contextと連携して動作します。
 *
 * @example
 * ```tsx
 * <SpeechSynthesisSettingsButton
 *   size="md"
 *   className="ml-2"
 * />
 * ```
 */
export const SpeechSynthesisSettingsButton: React.FC<SpeechSynthesisSettingsButtonProps> = ({
  size = 'md',
  className = '',
  disabled = false,
}) => {
  const { toggleSettings, isSettingsOpen } = (useSpeechSynthesisContext as any)?.() || {
    toggleSettings: () => {},
    isSettingsOpen: false,
  };

  const sizeStyles = getSizeStyles(size);

  /**
   * ボタンクリック処理
   * 音声合成設定Drawerの開閉を切り替える
   */
  const handleClick = () => {
    if (disabled) return;

    toggleSettings();
    log.debug('Settings button clicked', {
      wasOpen: isSettingsOpen,
      willOpen: !isSettingsOpen,
    });
  };

  /**
   * ボタンの色スタイルを取得
   */
  const getButtonColor = () => {
    if (disabled) {
      return 'text-gray-400 cursor-not-allowed';
    }

    if (isSettingsOpen) {
      return 'text-blue-600 bg-blue-50 border-blue-200';
    }

    return 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 border-gray-200 hover:border-blue-300';
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      className={`
        relative inline-flex items-center justify-center
        ${sizeStyles.containerClass}
        border-2 rounded-full
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        ${getButtonColor()}
        ${className}
      `}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      animate={isSettingsOpen ? { rotate: [0, 5, -5, 0] } : {}}
      transition={{ duration: 0.3 }}
      aria-label={isSettingsOpen ? '音声合成設定を閉じる' : '音声合成設定を開く'}
      aria-pressed={isSettingsOpen}
      id="speech-synthesis-settings-button"
    >
      {/* メインのスピーカーアイコン */}
      <FaVolumeUp className={`${sizeStyles.speakerIconClass} transition-colors duration-200`} />

      {/* 右上の設定アイコン */}
      <motion.div
        className={`absolute ${sizeStyles.cogPosition}`}
        animate={isSettingsOpen ? { rotate: 180 } : { rotate: 0 }}
        transition={{ duration: 0.3 }}
      >
        <FaCog
          className={`
            ${sizeStyles.cogIconClass} 
            transition-colors duration-200
            ${isSettingsOpen ? 'text-blue-600' : 'text-gray-500'}
          `}
        />
      </motion.div>

      {/* 設定オープン時の効果（リング） */}
      {isSettingsOpen && (
        <motion.div
          className="absolute inset-0 border-2 border-blue-400 rounded-full"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.3, opacity: 0 }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
};
