/**
 * @fileoverview マイクボタンコンポーネント
 * @description 音声認識の開始/停止を制御するボタン
 */

import type React from 'react';

import { useTranslation } from 'react-i18next';
import { FaMicrophone, FaStop } from 'react-icons/fa';

import type { IMicButtonProps } from '../types/medicalQuestionnaire';

/**
 * マイクボタンコンポーネント
 * @description 音声認識の状態を視覚的に表示し、録音を制御
 */
export const MicButton: React.FC<IMicButtonProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  disabled = false,
}) => {
  const { t } = useTranslation();

  const handleClick = () => {
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`
          relative w-16 h-16 rounded-full border-4 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-opacity-50
          ${
            isRecording
              ? 'bg-red-500 border-red-600 text-white shadow-lg transform scale-110 focus:ring-red-300'
              : disabled
                ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed focus:ring-gray-300'
                : 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600 hover:border-blue-700 hover:shadow-lg focus:ring-blue-300'
          }
        `}
        aria-label={
          isRecording ? t('questionnaire.mic.stopRecording') : t('questionnaire.mic.startRecording')
        }
        title={
          isRecording ? t('questionnaire.mic.stopRecording') : t('questionnaire.mic.startRecording')
        }
      >
        {/* マイクアイコン */}
        <div
          className={`w-8 h-8 mx-auto transition-transform duration-200 ${isRecording ? 'animate-pulse' : ''}`}
        >
          {isRecording ? <FaStop className="w-8 h-8" /> : <FaMicrophone className="w-8 h-8" />}
        </div>

        {/* 録音中のパルスエフェクト */}
        {isRecording && (
          <>
            <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30"></div>
            <div className="absolute inset-2 rounded-full bg-red-300 animate-pulse opacity-50"></div>
          </>
        )}
      </button>

      {/* ステータステキスト */}
      <div className="mt-3 text-center">
        <div
          className={`text-sm font-medium ${
            isRecording ? 'text-red-600' : disabled ? 'text-gray-500' : 'text-blue-600'
          }`}
        >
          {isRecording
            ? t('questionnaire.mic.recording')
            : disabled
              ? t('questionnaire.mic.disabled')
              : t('questionnaire.mic.ready')}
        </div>

        {!disabled && (
          <div className="text-xs text-gray-500 mt-1">
            {isRecording ? t('questionnaire.mic.tapToStop') : t('questionnaire.mic.tapToStart')}
          </div>
        )}
      </div>
    </div>
  );
};
