/**
 * 音声合成設定Drawer
 * 右側からスライドで表示される音声合成設定UI
 */

import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaGlobe,
  FaMusic,
  FaRedo,
  FaSave,
  FaTachometerAlt,
  FaTimes,
  FaUser,
  FaVolumeUp,
} from 'react-icons/fa';

import { createContextLogger } from '@/lib/logger';

// import { useSpeechSynthesisContext } from '../../../contexts/SpeechSynthesisContext';
const useSpeechSynthesisContext = undefined as any;

import { VOICE_AVATARS } from '../hooks/config';

/**
 * 型ガード: サポートされている言語かどうかを判定
 */
const isValidLanguage = (lang: string): lang is keyof typeof VOICE_AVATARS => {
  return lang in VOICE_AVATARS;
};

const log = createContextLogger('SpeechSynthesisSettingsDrawer');

/**
 * サポート言語設定
 */
const SUPPORTED_LANGUAGES = {
  'ja-JP': '日本語',
  'en-US': 'English (US)',
  'en-GB': 'English (GB)',
} as const;

/**
 * 音声合成設定Drawer Props
 */
interface SpeechSynthesisSettingsDrawerProps {
  /** カスタムクラス名 */
  className?: string;
}

/**
 * 音声合成設定Drawer コンポーネント
 *
 * React Contextベースの設定管理により、Propsやコールバックを使用せず
 * アプリケーション全体で設定を共有します。
 */
export const SpeechSynthesisSettingsDrawer: React.FC<SpeechSynthesisSettingsDrawerProps> = ({
  className = '',
}) => {
  const { config, updateConfig, resetConfig, isSettingsOpen, closeSettings } = (
    useSpeechSynthesisContext as any
  )?.() || {
    config: {
      language: 'ja-JP',
      voice: '',
      volume: 1,
      rate: 1,
      pitch: 1,
    },
    updateConfig: () => {},
    resetConfig: () => {},
    isSettingsOpen: false,
    closeSettings: () => {},
  };

  // ローカル編集状態（適用前の設定を保持）
  const [localConfig, setLocalConfig] = useState(config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // DOM参照
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);

  // Context設定が変更された時にローカル状態を同期
  useEffect(() => {
    setLocalConfig(config);
    setHasUnsavedChanges(false);
  }, [config]);

  // フォーカス管理とキーボードナビゲーション
  useEffect(() => {
    if (isSettingsOpen) {
      // Drawerが開いたときに最初の入力フィールドにフォーカス
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100); // アニメーション後にフォーカス

      return () => clearTimeout(timer);
    }
    return undefined; // 戻り値を明示
  }, [isSettingsOpen]);

  // Escapeキーで閉じる
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSettingsOpen) {
        // handleCloseは後で定義されるので直接closeSettingsを呼び出す
        if (hasUnsavedChanges) {
          if (window.confirm('未保存の変更があります。破棄しますか？')) {
            setLocalConfig(config);
            setHasUnsavedChanges(false);
            closeSettings();
          }
        } else {
          closeSettings();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, hasUnsavedChanges, config, closeSettings]);

  /**
   * ローカル設定を更新
   */
  const updateLocalConfig = useCallback((updates: Partial<typeof localConfig>): void => {
    setLocalConfig((prev: any) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
    log.debug('Local config updated', { updates });
  }, []); // setStateは安定なので依存配列不要

  /**
   * 設定を適用（Context に反映）
   */
  const applySettings = useCallback(() => {
    updateConfig(localConfig);
    setHasUnsavedChanges(false);
    log.info('Settings applied to context', { config: localConfig });
  }, [localConfig, updateConfig]);

  /**
   * 設定をリセット
   */
  const handleReset = useCallback(() => {
    resetConfig();
    setLocalConfig(config);
    setHasUnsavedChanges(false);
    log.info('Settings reset to default');
  }, [resetConfig, config]);

  /**
   * Drawer を閉じる
   */
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      // 未保存の変更がある場合は確認
      if (window.confirm('未保存の変更があります。破棄しますか？')) {
        setLocalConfig(config); // 元の設定に戻す
        setHasUnsavedChanges(false);
        closeSettings();
      }
    } else {
      closeSettings();
    }
  }, [hasUnsavedChanges, config, closeSettings]);

  // Drawer のアニメーション設定
  const drawerVariants: Variants = {
    closed: {
      x: '100%',
      opacity: 0,
    },
    open: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        damping: 25,
        stiffness: 200,
      },
    },
  };

  const backdropVariants = {
    closed: { opacity: 0 },
    open: { opacity: 1 },
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          {/* バックドロップ */}
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={backdropVariants}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={handleClose}
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial="closed"
            animate="open"
            exit="closed"
            variants={drawerVariants}
            className={`fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 ${className}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-drawer-title"
          >
            <div className="flex flex-col h-full">
              {/* ヘッダー */}
              <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center space-x-2">
                  <FaVolumeUp className="text-blue-600" />
                  <h2 id="settings-drawer-title" className="text-base font-semibold text-gray-800">
                    音声合成設定
                  </h2>
                </div>
                <button
                  ref={closeButtonRef}
                  onClick={handleClose}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="設定を閉じる"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>

              {/* 設定内容 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* 言語選択 */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <FaGlobe className="text-blue-500" />
                    <span>言語</span>
                  </label>
                  <select
                    ref={firstInputRef}
                    value={localConfig.language || 'ja-JP'}
                    onChange={(e) => updateLocalConfig({ language: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    aria-label="言語選択"
                  >
                    {Object.entries(SUPPORTED_LANGUAGES).map(([lang, displayName]) => (
                      <option key={lang} value={lang}>
                        {displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 音声選択 */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <FaUser className="text-purple-500" />
                    <span>音声アバター</span>
                  </label>
                  <select
                    value={localConfig.voice || ''}
                    onChange={(e) => updateLocalConfig({ voice: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {(() => {
                      const lang = localConfig.language || 'ja-JP';
                      if (!isValidLanguage(lang)) return null;
                      return VOICE_AVATARS[lang]?.map((avatar) => (
                        <option key={avatar.id} value={avatar.id}>
                          {avatar.name} ({avatar.gender === 'male' ? '男性' : '女性'}) -{' '}
                          {avatar.style}
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                {/* 音量 */}
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <div className="flex items-center space-x-1">
                      <FaVolumeUp className="text-green-500 w-3 h-3" />
                      <span>音量</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {Math.round((localConfig.volume || 1) * 100)}%
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localConfig.volume || 1}
                    onChange={(e) => updateLocalConfig({ volume: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer accent-green-500"
                  />
                </div>

                {/* 読み上げ速度 */}
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <div className="flex items-center space-x-1">
                      <FaTachometerAlt className="text-orange-500 w-3 h-3" />
                      <span>読み上げ速度</span>
                    </div>
                    <span className="text-xs text-gray-500">{localConfig.rate || 1}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={localConfig.rate || 1}
                    onChange={(e) => updateLocalConfig({ rate: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer accent-orange-500"
                  />
                </div>

                {/* 音の高さ */}
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <div className="flex items-center space-x-1">
                      <FaMusic className="text-pink-500 w-3 h-3" />
                      <span>音の高さ</span>
                    </div>
                    <span className="text-xs text-gray-500">{localConfig.pitch || 1}</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={localConfig.pitch || 1}
                    onChange={(e) => updateLocalConfig({ pitch: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer accent-pink-500"
                  />
                </div>
              </div>

              {/* フッター */}
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <div className="flex space-x-2">
                  <button
                    onClick={handleReset}
                    className="flex-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-200 hover:bg-gray-300 rounded transition-colors flex items-center justify-center space-x-1"
                  >
                    <FaRedo className="text-xs" />
                    <span>リセット</span>
                  </button>
                  <button
                    onClick={applySettings}
                    disabled={!hasUnsavedChanges}
                    className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors flex items-center justify-center space-x-1 ${
                      hasUnsavedChanges
                        ? 'text-white bg-blue-600 hover:bg-blue-700'
                        : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                    }`}
                  >
                    <FaSave className="text-xs" />
                    <span>適用</span>
                  </button>
                </div>
                {hasUnsavedChanges && (
                  <p className="text-xs text-amber-600 mt-1.5 text-center">
                    未保存の変更があります
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
