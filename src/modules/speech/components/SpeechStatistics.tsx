/**
 * 音声合成統計情報表示コンポーネント
 */

import type React from 'react';

import { FaChartBar } from 'react-icons/fa';

interface StatisticsData {
  totalSyntheses: number;
  totalCharacters: number;
  totalDuration: number;
  averageSpeed: number;
}

interface SpeechStatisticsProps {
  statistics: StatisticsData;
}

export const SpeechStatistics: React.FC<SpeechStatisticsProps> = ({ statistics }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <FaChartBar className="text-purple-500" />
        統計情報
      </h3>

      <div className="grid grid-cols-1 gap-3">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-xl font-bold text-blue-600">{statistics.totalSyntheses}</div>
          <div className="text-xs text-blue-800">合成回数</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-xl font-bold text-green-600">{statistics.totalCharacters}</div>
          <div className="text-xs text-green-800">合成文字数</div>
        </div>
      </div>
    </div>
  );
};
