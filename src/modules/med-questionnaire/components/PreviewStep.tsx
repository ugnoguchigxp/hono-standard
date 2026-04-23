/**
 * @fileoverview プレビューステップコンポーネント
 * @description 問診履歴の確認と編集機能を提供
 */

import { Button, Textarea } from '@gxp/design-system';
import type React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createContextLogger } from '@/lib/logger';
import type { IInterviewHistoryItem, IPreviewStepProps } from '../types/medicalQuestionnaire';

const log = createContextLogger('PreviewStep');

/**
 * プレビューステップコンポーネント
 * @description 問診内容の最終確認と編集機能
 */
export const PreviewStep: React.FC<IPreviewStepProps> = ({
  history,
  diagnosis,
  onEditAnswer,
  onConfirm,
  onBack,
  possibleDiagnoses,
}) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  log.debug('🔍 PreviewStep received history:', history);
  log.debug('🔍 History length:', history.length);

  // 編集開始
  const startEditing = (item: IInterviewHistoryItem) => {
    setEditingId(item.questionId);
    setEditText(item.answerText);
    log.info('Started editing answer', { questionId: item.questionId });
  };

  // 編集キャンセル
  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
    log.info('Cancelled editing');
  };

  // 編集保存
  const saveEdit = (questionId: string) => {
    if (
      editText.trim() &&
      editText.trim() !== history.find((h) => h.questionId === questionId)?.answerText
    ) {
      onEditAnswer(questionId, editText.trim());
      log.info('Saved edited answer', { questionId, newLength: editText.trim().length });
    }
    setEditingId(null);
    setEditText('');
  };

  // 確定処理
  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      await onConfirm();
      log.info('Interview confirmed');
    } catch (error) {
      log.error('Failed to confirm interview', { error });
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('questionnaire.preview.title')}
        </h2>
        <p className="text-gray-600">{t('questionnaire.preview.description')}</p>
      </div>

      {/* 統計情報 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{history.length}</div>
            <div className="text-sm text-blue-800">{t('questionnaire.preview.totalQuestions')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(
                history.reduce((sum, item) => sum + item.answerText.length, 0) / history.length
              ) || 0}
            </div>
            <div className="text-sm text-blue-800">
              {t('questionnaire.preview.avgAnswerLength')}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round((Date.now() - new Date(history[0]?.timestamp || 0).getTime()) / 60000) ||
                0}
            </div>
            <div className="text-sm text-blue-800">{t('questionnaire.preview.duration')}</div>
          </div>
        </div>
      </div>

      {/* 問診履歴 */}
      <div className="space-y-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-800">
          {t('questionnaire.preview.interviewHistory')}
        </h3>

        {history.map((item, index) => (
          <div key={item.questionId} className="bg-white border border-gray-200 rounded-lg p-6">
            {/* 質問 */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                  Q{index + 1}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-800 font-medium">{item.questionText}</p>
            </div>

            {/* 回答 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {t('questionnaire.preview.answer')}
                </span>
                {editingId !== item.questionId && (
                  <Button
                    onClick={() => startEditing(item)}
                    className="text-blue-600 hover:text-blue-700 bg-transparent border-none px-2 py-1 text-sm"
                  >
                    {t('questionnaire.preview.edit')}
                  </Button>
                )}
              </div>

              {editingId === item.questionId ? (
                // 編集モード
                <div className="space-y-3">
                  <Textarea
                    id="edit-answer"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    placeholder={t('questionnaire.preview.editPlaceholder')}
                    className="w-full"
                  />
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => saveEdit(item.questionId)}
                      disabled={!editText.trim()}
                      className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {t('questionnaire.preview.save')}
                    </Button>
                    <Button
                      onClick={cancelEditing}
                      className="px-3 py-1 text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      {t('questionnaire.preview.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                // 表示モード
                <p className="text-gray-800 whitespace-pre-wrap">{item.answerText}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 予測される病名 */}
      {possibleDiagnoses && possibleDiagnoses.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            {t('questionnaire.preview.possibleDiagnoses')}
          </h3>
          <div className="space-y-2">
            <p className="text-sm text-blue-600 mb-3">
              {t('questionnaire.preview.possibleDiagnosesDescription')}
            </p>
            <div className="flex flex-wrap gap-2">
              {possibleDiagnoses.map((diagnosis, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span>
                  {diagnosis}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 診断結果（もしあれば） */}
      {diagnosis && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-green-800 mb-4">
            {t('questionnaire.preview.diagnosis')}
          </h3>
          <div className="space-y-3">
            <div>
              <span className="font-medium text-green-700">
                {t('questionnaire.preview.primaryDiagnosis')}:
              </span>
              <span className="ml-2 text-green-800">{diagnosis.primaryDiagnosis}</span>
            </div>
            <div>
              <span className="font-medium text-green-700">
                {t('questionnaire.preview.confidence')}:
              </span>
              <span className="ml-2 text-green-800">{Math.round(diagnosis.confidence * 100)}%</span>
            </div>
            <div>
              <span className="font-medium text-green-700">
                {t('questionnaire.preview.urgency')}:
              </span>
              <span
                className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
                  diagnosis.urgencyLevel === 'high' || diagnosis.urgencyLevel === 'emergency'
                    ? 'bg-red-100 text-red-800'
                    : diagnosis.urgencyLevel === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                }`}
              >
                {t(`questionnaire.urgency.${diagnosis.urgencyLevel}`)}
              </span>
            </div>
            <div>
              <span className="font-medium text-green-700">
                {t('questionnaire.preview.recommendations')}:
              </span>
              <p className="mt-1 text-green-800">{diagnosis.recommendations}</p>
            </div>
          </div>
        </div>
      )}

      {/* 確認と次へのアクション */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-3">{t('questionnaire.preview.nextSteps')}</h3>
        <p className="text-gray-600 mb-4">{t('questionnaire.preview.confirmDescription')}</p>

        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          {onBack && (
            <Button
              onClick={onBack}
              disabled={editingId !== null || isConfirming}
              className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t('questionnaire.preview.back')}
            </Button>
          )}

          <Button
            onClick={handleConfirm}
            disabled={editingId !== null || isConfirming}
            className={`flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 ${isConfirming ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isConfirming
              ? t('questionnaire.preview.confirming')
              : t('questionnaire.preview.confirm')}
          </Button>
        </div>
      </div>

      {/* 免責事項 */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>{t('questionnaire.preview.disclaimer.title')}</strong>{' '}
          {t('questionnaire.preview.disclaimer.description')}
        </p>
      </div>
    </div>
  );
};
