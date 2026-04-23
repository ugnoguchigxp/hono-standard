/**
 * @fileoverview 完了ステップコンポーネント
 * @description 問診完了後の結果表示と次のアクション
 */

import { Button } from '@gxp/design-system';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaCheck,
  FaClock,
  FaExclamationTriangle,
  FaFileAlt,
  FaInfo,
  FaPlus,
  FaPrint,
} from 'react-icons/fa';
import { openPrintWindow } from '../../../utils/printUtils';
import type { IInterviewHistoryItem, IMedicalDiagnosis } from '../types/medicalQuestionnaire';

interface ICompletionStepProps {
  history: IInterviewHistoryItem[];
  diagnosis?: IMedicalDiagnosis | null;
  possibleDiagnoses?: string[];
  patientAge?: number;
  patientGender?: string;
  onRestart: () => void;
}

/**
 * 完了ステップコンポーネント
 * @description 問診完了画面と結果表示
 */
export const CompletionStep: React.FC<ICompletionStepProps> = ({
  history,
  diagnosis,
  possibleDiagnoses = [],
  patientAge,
  patientGender,
  onRestart,
}) => {
  const { t } = useTranslation();

  const handlePrint = () => {
    // 新しいウィンドウで印刷レポートを開く
    openPrintWindow({
      history,
      diagnosis,
      possibleDiagnoses,
      patientAge,
      patientGender,
    });
  };

  const totalTime =
    history.length > 0
      ? Math.round(
          (new Date(history[history.length - 1]?.timestamp || 0).getTime() -
            new Date(history[0]?.timestamp || 0).getTime()) /
            60000
        )
      : 0;

  const totalWords = history.reduce(
    (sum, item) => sum + (item.answerText?.split(/\s+/).length || 0),
    0
  );

  return (
    <div className="max-w-3xl mx-auto p-8 text-center">
      {/* 完了メッセージ */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaCheck className="w-10 h-10 text-green-600" />
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {t('questionnaire.completion.title')}
        </h2>
        <p className="text-lg text-gray-600">{t('questionnaire.completion.description')}</p>
      </div>

      {/* 統計サマリー */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-800 mb-4">
          {t('questionnaire.completion.summary')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">{history.length}</div>
            <div className="text-sm text-blue-700">
              {t('questionnaire.completion.questionsAnswered')}
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">{totalTime}</div>
            <div className="text-sm text-blue-700">{t('questionnaire.completion.totalTime')}</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">{totalWords}</div>
            <div className="text-sm text-blue-700">{t('questionnaire.completion.totalWords')}</div>
          </div>
        </div>
      </div>

      {/* 診断結果 */}
      {diagnosis && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 text-left">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            {t('questionnaire.completion.diagnosis')}
          </h3>

          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <FaFileAlt className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-green-800 mb-1">
                    {t('questionnaire.completion.primaryDiagnosis')}
                  </h4>
                  <p className="text-green-700">{diagnosis.primaryDiagnosis}</p>
                  <div className="mt-2 text-sm text-green-600">
                    {t('questionnaire.completion.confidence')}:{' '}
                    {Math.round(diagnosis.confidence * 100)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <FaInfo className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-yellow-800 mb-1">
                    {t('questionnaire.completion.recommendations')}
                  </h4>
                  <p className="text-yellow-700">{diagnosis.recommendations}</p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-lg p-4 ${
                diagnosis.urgencyLevel === 'high' || diagnosis.urgencyLevel === 'emergency'
                  ? 'bg-red-50 border border-red-200'
                  : diagnosis.urgencyLevel === 'medium'
                    ? 'bg-orange-50 border border-orange-200'
                    : 'bg-green-50 border border-green-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <FaClock
                    className={`w-6 h-6 ${
                      diagnosis.urgencyLevel === 'high' || diagnosis.urgencyLevel === 'emergency'
                        ? 'text-red-600'
                        : diagnosis.urgencyLevel === 'medium'
                          ? 'text-orange-600'
                          : 'text-green-600'
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <h4
                    className={`font-medium mb-1 ${
                      diagnosis.urgencyLevel === 'high' || diagnosis.urgencyLevel === 'emergency'
                        ? 'text-red-800'
                        : diagnosis.urgencyLevel === 'medium'
                          ? 'text-orange-800'
                          : 'text-green-800'
                    }`}
                  >
                    {t('questionnaire.completion.urgencyLevel')}
                  </h4>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                      diagnosis.urgencyLevel === 'high' || diagnosis.urgencyLevel === 'emergency'
                        ? 'bg-red-100 text-red-800'
                        : diagnosis.urgencyLevel === 'medium'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {t(`questionnaire.urgency.${diagnosis.urgencyLevel}`)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 次のアクション */}
      <div className="space-y-4">
        <div className="text-left bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">
            {t('questionnaire.completion.nextSteps.title')}
          </h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></span>
              <span>{t('questionnaire.completion.nextSteps.step1')}</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></span>
              <span>{t('questionnaire.completion.nextSteps.step2')}</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></span>
              <span>{t('questionnaire.completion.nextSteps.step3')}</span>
            </li>
          </ul>
        </div>

        {/* メインアクションボタン */}
        <div className="mb-4">
          <Button
            onClick={onRestart}
            className="w-full py-4 px-8 bg-green-600 text-white text-lg font-semibold hover:bg-green-700 transition-colors duration-200 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-center space-x-3">
              <FaPlus className="w-6 h-6" />
              <span>{t('questionnaire.completion.startNew')}</span>
            </div>
          </Button>
        </div>

        {/* サブアクションボタン */}
        <div>
          <Button
            onClick={handlePrint}
            className="w-full py-3 px-6 bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200 rounded-lg print-button"
          >
            <div className="flex items-center justify-center space-x-2">
              <FaPrint className="w-5 h-5" />
              <span>{t('questionnaire.completion.printResults')}</span>
            </div>
          </Button>
        </div>
      </div>

      {/* 免責事項 */}
      <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <FaExclamationTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-red-800 mb-1">
              {t('questionnaire.completion.disclaimer.title')}
            </h4>
            <p className="text-sm text-red-700">
              {t('questionnaire.completion.disclaimer.description')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
