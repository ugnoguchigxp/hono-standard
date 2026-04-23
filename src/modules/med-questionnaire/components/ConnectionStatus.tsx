/**
 * @fileoverview 接続状態表示コンポーネント
 * @description WebSocket接続状態とインタビュー状態を表示
 */

import type React from 'react';

import { useTranslation } from 'react-i18next';

import type { InterviewStatus } from '../types/medicalQuestionnaire';

interface IConnectionStatusProps {
  isConnected: boolean;
  interviewState: InterviewStatus;
}

/**
 * 接続状態表示コンポーネント
 * @description WebSocket接続状態を視覚的に表示
 */
export const ConnectionStatus: React.FC<IConnectionStatusProps> = ({
  isConnected,
  interviewState,
}) => {
  const { t } = useTranslation();

  const getStatusColor = () => {
    if (!isConnected) return 'text-red-500';
    if (interviewState === 'in_progress') return 'text-green-500';
    return 'text-blue-500';
  };

  const getStatusText = () => {
    if (!isConnected) return t('questionnaire.connection.disconnected');
    if (interviewState === 'in_progress') return t('questionnaire.connection.active');
    return t('questionnaire.connection.connected');
  };

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`w-3 h-3 rounded-full ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
      ></div>
      <span className={`text-sm font-medium ${getStatusColor()}`}>{getStatusText()}</span>
    </div>
  );
};
