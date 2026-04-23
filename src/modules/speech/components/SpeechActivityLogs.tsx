/**
 * 音声合成アクティビティログ表示コンポーネント
 */

import { motion } from 'framer-motion';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { FaHistory } from 'react-icons/fa';

export interface SynthesisLog {
  timestamp: Date;
  type: 'start' | 'end' | 'error' | 'config';
  message: string;
  textLength?: number;
  duration?: number;
  language?: string;
}

interface SpeechActivityLogsProps {
  logs: SynthesisLog[];
  showLogs: boolean;
  onToggleShow: () => void;
}

export const SpeechActivityLogs: React.FC<SpeechActivityLogsProps> = ({
  logs,
  showLogs,
  onToggleShow,
}) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showLogs]);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FaHistory className="text-indigo-500" />
          アクティビティログ
        </h3>
        <button
          onClick={onToggleShow}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          {showLogs ? '隠す' : '表示'}
        </button>
      </div>

      {showLogs && (
        <div className="max-h-64 overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-3">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm italic">ログはありません</p>
          ) : (
            logs.map((logEntry, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-xs p-2 rounded border-l-4 ${
                  logEntry.type === 'error'
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : logEntry.type === 'start'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : logEntry.type === 'end'
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : 'bg-gray-50 border-gray-500 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{logEntry.message}</span>
                  <span className="text-gray-500">{logEntry.timestamp.toLocaleTimeString()}</span>
                </div>
                {(logEntry.textLength || logEntry.duration || logEntry.language) && (
                  <div className="mt-1 text-gray-600">
                    {logEntry.textLength && <span>文字数: {logEntry.textLength}</span>}
                    {logEntry.duration && (
                      <span className="ml-3">時間: {Math.round(logEntry.duration / 1000)}秒</span>
                    )}
                    {logEntry.language && <span className="ml-3">言語: {logEntry.language}</span>}
                  </div>
                )}
              </motion.div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
};
