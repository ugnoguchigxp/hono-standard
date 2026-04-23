/**
 * @fileoverview 問診開始ステップコンポーネント
 * @description 問診開始前の基本情報入力フォーム
 */

import { Mic, MicOff } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createContextLogger } from '@/lib/logger';
import '@/styles/slider.css';

const log = createContextLogger('StartStep');

interface IStartStepProps {
  onStart: (patientAge?: number, patientGender?: string) => void;
  isConnected: boolean;
  voiceModeEnabled: boolean;
  onToggleVoiceMode: () => void;
  error?: string;
  debugModeEnabled?: boolean;
  onToggleDebugMode?: () => void;
  onStartDebugInterview?: (patientAge?: number, patientGender?: string) => void;
}

/**
 * 問診開始ステップコンポーネント
 * @description 患者の基本情報を入力して問診を開始
 */
export const StartStep: React.FC<IStartStepProps> = ({
  onStart,
  isConnected,
  voiceModeEnabled,
  onToggleVoiceMode,
  error,
  debugModeEnabled = false,
  onToggleDebugMode,
  onStartDebugInterview,
}) => {
  const { t } = useTranslation();
  const [patientAge, setPatientAge] = useState<number>(50);
  const [patientGender, setPatientGender] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const [hasAttemptedStart, setHasAttemptedStart] = useState(false);

  const genderRadioRef = useRef<HTMLInputElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  const handleStart = async () => {
    setHasAttemptedStart(true);

    if (!canStart) {
      // 性別が未選択の場合、性別ラジオボタンにフォーカス
      if (patientGender === '' && genderRadioRef.current) {
        genderRadioRef.current.focus();
      }
      return;
    }

    try {
      setIsStarting(true);
      log.info('Starting medical interview', { age: patientAge, gender: patientGender });
      onStart(patientAge, patientGender || undefined);
    } catch (error) {
      log.error('Failed to start interview', { error });
    } finally {
      setIsStarting(false);
    }
  };

  const handleDebugStart = async () => {
    setHasAttemptedStart(true);

    if (!canStart) {
      // 性別が未選択の場合、性別ラジオボタンにフォーカス
      if (patientGender === '' && genderRadioRef.current) {
        genderRadioRef.current.focus();
      }
      return;
    }

    try {
      setIsStarting(true);
      log.info('Starting debug medical interview', { age: patientAge, gender: patientGender });
      onStartDebugInterview?.(patientAge, patientGender || undefined);
    } catch (error) {
      log.error('Failed to start debug interview', { error });
    } finally {
      setIsStarting(false);
    }
  };

  // 性別が選択されたら開始ボタンにフォーカス
  useEffect(() => {
    if (patientGender && startButtonRef.current) {
      startButtonRef.current.focus();
    }
  }, [patientGender]);

  const canStart = isConnected && patientGender !== '';

  return (
    <div className="max-w-lg mx-auto p-4">
      {/* タイトル */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-1">{t('questionnaire.start.title')}</h2>
        <p className="text-sm text-gray-600">{t('questionnaire.start.description')}</p>
      </div>

      {/* フォーム */}
      <div className="space-y-3">
        {/* 年齢スライダー */}
        <div>
          <label htmlFor="patient-age" className="block text-sm font-medium text-gray-700 mb-2">
            {t('questionnaire.start.age.label')}:{' '}
            <span className="text-lg font-semibold text-blue-600">
              {patientAge}
              {t('questionnaire.start.age.unit')}
            </span>
          </label>
          <input
            id="patient-age"
            type="range"
            min="0"
            max="125"
            value={patientAge}
            onChange={(e) => setPatientAge(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(patientAge / 125) * 100}%, #e5e7eb ${(patientAge / 125) * 100}%, #e5e7eb 100%)`,
            }}
          />
        </div>

        {/* 性別選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('questionnaire.start.gender.label')} <span className="text-red-500">*</span>
          </label>
          <div
            className={`p-3 border rounded-lg ${hasAttemptedStart && patientGender === '' ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
          >
            <div className="flex space-x-4">
              <label className="flex items-center cursor-pointer">
                <input
                  ref={genderRadioRef}
                  type="radio"
                  name="patient-gender"
                  value="male"
                  checked={patientGender === 'male'}
                  onChange={(e) => setPatientGender(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('questionnaire.start.gender.male')}
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="patient-gender"
                  value="female"
                  checked={patientGender === 'female'}
                  onChange={(e) => setPatientGender(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('questionnaire.start.gender.female')}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* 入力方法選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('questionnaire.start.inputMethod.label')}
          </label>
          <div className="flex space-x-2 mb-2">
            <button
              onClick={() => !voiceModeEnabled && onToggleVoiceMode()}
              className={`flex items-center px-3 py-2 rounded-md border transition-all ${
                voiceModeEnabled
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              <Mic
                className={`w-4 h-4 mr-2 ${voiceModeEnabled ? 'text-blue-600' : 'text-gray-500'}`}
              />
              <span className="text-sm font-medium">
                {t('questionnaire.start.inputMethod.voice')}
              </span>
            </button>

            <button
              onClick={() => voiceModeEnabled && onToggleVoiceMode()}
              className={`flex items-center px-3 py-2 rounded-md border transition-all ${
                !voiceModeEnabled
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              <MicOff
                className={`w-4 h-4 mr-2 ${!voiceModeEnabled ? 'text-green-600' : 'text-gray-500'}`}
              />
              <span className="text-sm font-medium">
                {t('questionnaire.start.inputMethod.silent')}
              </span>
            </button>

            {/* デバッグボタン */}
            <button
              onClick={() => onToggleDebugMode?.()}
              className={`flex items-center px-3 py-2 rounded-md border transition-all ${
                debugModeEnabled
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              <span
                className={`w-4 h-4 mr-2 text-center font-bold ${
                  debugModeEnabled ? 'text-orange-600' : 'text-gray-500'
                }`}
              >
                🐛
              </span>
              <span className="text-sm font-medium">デバッグ</span>
            </button>
          </div>

          {/* 選択状態に応じて説明文を表示 */}
          {voiceModeEnabled && !debugModeEnabled && (
            <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded border-l-4 border-gray-400">
              {t('questionnaire.start.voiceMode.enabled')}
            </p>
          )}
          {!voiceModeEnabled && !debugModeEnabled && (
            <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded border-l-4 border-gray-400">
              {t('questionnaire.start.voiceMode.disabled')}
            </p>
          )}
          {debugModeEnabled && (
            <p className="text-sm text-gray-700 bg-orange-50 px-3 py-2 rounded border-l-4 border-orange-400">
              デバッグモード:
              1問のみでテスト実行します。10問の履歴が表示されますが、実際には1問だけ回答して完了画面に進みます。
            </p>
          )}
        </div>

        {/* 開始ボタン */}
        <div className="pt-1">
          <button
            ref={startButtonRef}
            onClick={debugModeEnabled ? handleDebugStart : handleStart}
            disabled={!isConnected || isStarting}
            className={`w-full px-4 py-3 ${debugModeEnabled ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white disabled:opacity-50 rounded-md font-medium transition-colors ${isStarting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isStarting
              ? debugModeEnabled
                ? 'デバッグ開始中...'
                : t('questionnaire.start.button.starting')
              : debugModeEnabled
                ? 'デバッグ開始'
                : t('questionnaire.start.button.start')}
          </button>

          {/* エラー表示 - 統一されたエラー表示 */}
          {(error || (hasAttemptedStart && !canStart)) && (
            <p className="text-sm text-red-500 text-center mt-1">
              {error ||
                (!isConnected
                  ? t('questionnaire.start.errors.serverConnection')
                  : patientGender === ''
                    ? t('questionnaire.start.errors.genderRequired')
                    : '')}
            </p>
          )}
        </div>
      </div>

      {/* 免責事項 */}
      <div className="mt-3 pt-2 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">{t('questionnaire.start.disclaimer')}</p>
      </div>
    </div>
  );
};
