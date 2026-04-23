/**
 * 音声合成設定コンポーネント
 * 音声合成の詳細設定を行うためのUIコンポーネント
 */

import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { useState } from 'react';
import { FaCog } from 'react-icons/fa';

import { SUPPORTED_LANGUAGES, VOICE_AVATARS } from '../hooks/config';
import type { SpeechSynthesisConfig } from '../hooks/types';

export interface SpeechSynthesisSettingsProps {
  /** 現在の設定 */
  config: Partial<SpeechSynthesisConfig>;
  /** 設定変更コールバック */
  onConfigChange: (config: Partial<SpeechSynthesisConfig>) => void;
  /** 初期表示状態 */
  defaultOpen?: boolean;
  /** カスタムクラス名 */
  className?: string;
}

export const SpeechSynthesisSettings: React.FC<SpeechSynthesisSettingsProps> = ({
  config,
  onConfigChange,
  defaultOpen = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleConfigUpdate = (newConfig: Partial<SpeechSynthesisConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    onConfigChange(updatedConfig);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Settings Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <FaCog className="text-sm" />
        <span>音声合成設定</span>
      </button>

      {/* Settings Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-gray-50 rounded-lg space-y-4"
          >
            <h4 className="font-medium text-gray-900">音声合成設定</h4>

            <div className="space-y-4">
              {/* 言語と音声アバター */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">言語</label>
                  <select
                    value={config.language || 'ja-JP'}
                    onChange={(e) => {
                      const selectedLang = SUPPORTED_LANGUAGES.find(
                        (lang) => lang.code === e.target.value
                      );
                      handleConfigUpdate({
                        language: e.target.value,
                        voice: selectedLang?.voice,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    音声アバター
                  </label>
                  <select
                    value={config.voice || 'nanami'}
                    onChange={(e) => handleConfigUpdate({ voice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {VOICE_AVATARS[config.language as keyof typeof VOICE_AVATARS]?.map((avatar) => (
                      <option key={avatar.id} value={avatar.id}>
                        {avatar.name}
                      </option>
                    )) ||
                      VOICE_AVATARS['ja-JP'].map((avatar) => (
                        <option key={avatar.id} value={avatar.id}>
                          {avatar.name}
                        </option>
                      ))}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    現在選択中:{' '}
                    {VOICE_AVATARS[config.language as keyof typeof VOICE_AVATARS]?.find(
                      (a) => a.id === config.voice
                    )?.name || 'ななみ (女性・標準)'}
                    <br />
                    <span className="text-blue-600">※ ブラウザ標準音声を使用</span>
                  </div>
                </div>
              </div>

              {/* 音声設定 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    音量: {Math.round((config.volume ?? 1.0) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.volume ?? 1.0}
                    onChange={(e) => handleConfigUpdate({ volume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    速度: {Math.round((config.rate ?? 1.0) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={config.rate ?? 1.0}
                    onChange={(e) => handleConfigUpdate({ rate: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ピッチ: {Math.round((config.pitch ?? 1.0) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.pitch ?? 1.0}
                    onChange={(e) => handleConfigUpdate({ pitch: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* その他の設定 */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">最大文字数</label>
                  <input
                    type="number"
                    min="100"
                    max="2000"
                    value={config.maxLength || 1000}
                    onChange={(e) =>
                      handleConfigUpdate({ maxLength: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="stripMarkdown"
                    checked={config.stripMarkdown ?? true}
                    onChange={(e) => handleConfigUpdate({ stripMarkdown: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="stripMarkdown" className="ml-2 text-sm text-gray-700">
                    Markdownを除去
                  </label>
                </div>
              </div>

              {/* プリセット */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">プリセット</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleConfigUpdate({ volume: 1.0, rate: 1.0, pitch: 1.0 })}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    標準
                  </button>
                  <button
                    onClick={() => handleConfigUpdate({ volume: 0.8, rate: 0.8, pitch: 1.1 })}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                  >
                    ゆっくり
                  </button>
                  <button
                    onClick={() => handleConfigUpdate({ volume: 1.0, rate: 1.3, pitch: 0.9 })}
                    className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
                  >
                    高速
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
