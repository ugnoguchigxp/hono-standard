/**
 * 音声合成サンプルテキスト選択コンポーネント
 */

import { motion } from 'framer-motion';
import type React from 'react';
import { FaBookOpen, FaFileAlt } from 'react-icons/fa';

interface SampleText {
  title: string;
  text: string;
  category: string;
}

interface SpeechSampleSelectorProps {
  samples: SampleText[];
  selectedIndex: number;
  onSampleSelect: (index: number) => void;
  onFileLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SpeechSampleSelector: React.FC<SpeechSampleSelectorProps> = ({
  samples,
  selectedIndex,
  onSampleSelect,
  onFileLoad,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FaBookOpen className="text-green-500" />
          サンプルテキスト
        </h2>

        <div className="space-y-3">
          {samples.map((sample, index) => (
            <button
              key={index}
              onClick={() => onSampleSelect(index)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedIndex === index
                  ? 'bg-blue-50 border-blue-300 shadow-sm'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium text-gray-900">{sample.title}</div>
              <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                {sample.text.substring(0, 80)}...
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {sample.text.length} 文字 • {sample.category}
              </div>
            </button>
          ))}
        </div>

        {/* File Upload */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <label className="block">
            <input type="file" accept=".txt" onChange={onFileLoad} className="hidden" />
            <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 cursor-pointer transition-colors">
              <FaFileAlt className="text-gray-400 mr-2" />
              <span className="text-sm text-gray-600">テキストファイル読み込み</span>
            </div>
          </label>
        </div>
      </div>
    </motion.div>
  );
};
