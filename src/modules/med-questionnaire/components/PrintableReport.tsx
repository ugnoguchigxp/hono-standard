/**
 * @fileoverview 印刷可能な問診レポートコンポーネント
 * @description 質問・回答履歴と診断結果を含む印刷専用レポート
 */

import type React from 'react';

import { useTranslation } from 'react-i18next';

import type { IInterviewHistoryItem, IMedicalDiagnosis } from '../types/medicalQuestionnaire';

interface IPrintableReportProps {
  history: IInterviewHistoryItem[];
  diagnosis?: IMedicalDiagnosis | null;
  possibleDiagnoses?: string[];
  patientAge?: number;
  patientGender?: string;
}

/**
 * 印刷可能な問診レポートコンポーネント
 * @description 印刷時に質問・回答履歴と診断結果を表示
 */
export const PrintableReport: React.FC<IPrintableReportProps> = ({
  history,
  diagnosis,
  possibleDiagnoses = [],
  patientAge,
  patientGender,
}) => {
  const { t } = useTranslation();

  const currentDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="print-report max-w-4xl mx-auto p-8 bg-white text-black">
      {/* ヘッダー */}
      <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
        <h1 className="text-2xl font-bold mb-2">{t('questionnaire.report.title')}</h1>
        <div className="text-sm text-gray-600">
          <p>
            {t('questionnaire.report.generatedAt')}: {currentDate}
          </p>
          {patientAge && (
            <p>
              {t('questionnaire.report.age')}: {patientAge}
              {t('questionnaire.report.ageUnit')}{' '}
              {patientGender &&
                `/ ${t('questionnaire.report.gender')}: ${t(`questionnaire.form.${patientGender}`)}`}
            </p>
          )}
        </div>
      </div>

      {/* 問診概要 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">
          {t('questionnaire.report.summary')}
        </h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div
            className="border border-gray-200 rounded p-3"
            style={{ border: '1px solid #000', backgroundColor: '#f8f8f8' }}
          >
            <div
              className="text-2xl font-bold text-blue-600"
              style={{ color: '#000', fontSize: '18pt' }}
            >
              {history.length}
            </div>
            <div className="text-sm text-gray-600" style={{ color: '#000', fontSize: '10pt' }}>
              {t('questionnaire.report.questionsCount')}
            </div>
          </div>
          <div
            className="border border-gray-200 rounded p-3"
            style={{ border: '1px solid #000', backgroundColor: '#f8f8f8' }}
          >
            <div
              className="text-2xl font-bold text-blue-600"
              style={{ color: '#000', fontSize: '18pt' }}
            >
              {history.reduce((sum, item) => sum + (item.answerText?.length || 0), 0)}
            </div>
            <div className="text-sm text-gray-600" style={{ color: '#000', fontSize: '10pt' }}>
              {t('questionnaire.report.totalCharacters')}
            </div>
          </div>
          <div
            className="border border-gray-200 rounded p-3"
            style={{ border: '1px solid #000', backgroundColor: '#f8f8f8' }}
          >
            <div
              className="text-2xl font-bold text-blue-600"
              style={{ color: '#000', fontSize: '18pt' }}
            >
              {history.length > 0
                ? Math.round(
                    (new Date(history[history.length - 1]?.timestamp || 0).getTime() -
                      new Date(history[0]?.timestamp || 0).getTime()) /
                      60000
                  )
                : 0}
            </div>
            <div className="text-sm text-gray-600" style={{ color: '#000', fontSize: '10pt' }}>
              {t('questionnaire.report.timeMinutes')}
            </div>
          </div>
        </div>
      </div>

      {/* 質問・回答履歴 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">
          {t('questionnaire.report.interviewHistory')}
        </h2>
        <div className="space-y-4">
          {history.map((item, index) => (
            <div
              key={item.questionId}
              className="question-item border border-gray-200 rounded-lg p-4"
            >
              <div className="mb-3">
                <div className="flex items-center mb-2">
                  <div
                    className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full mr-3"
                    style={{ backgroundColor: '#f0f0f0', color: '#000', border: '1px solid #666' }}
                  >
                    {t('questionnaire.report.questionNumber', { number: index + 1 })}
                  </div>
                  <div className="text-xs text-gray-500" style={{ color: '#000' }}>
                    {new Date(item.timestamp).toLocaleString('ja-JP')}
                  </div>
                </div>
                <div
                  className="font-medium text-gray-800 mb-2"
                  style={{ color: '#000', fontSize: '12pt', fontWeight: 'bold' }}
                >
                  Q: {item.questionText}
                </div>
              </div>
              <div
                className="bg-gray-50 rounded p-3"
                style={{ backgroundColor: '#f8f8f8', border: '1px solid #ccc' }}
              >
                <div
                  className="text-sm text-gray-600 mb-1"
                  style={{ color: '#000', fontWeight: 'bold' }}
                >
                  {t('questionnaire.report.answer')}:
                </div>
                <div className="text-gray-800" style={{ color: '#000', lineHeight: '1.5' }}>
                  {item.answerText || ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 予測される病名 */}
      {possibleDiagnoses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">
            {t('questionnaire.report.possibleDiagnoses')}
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 mb-3">
              {t('questionnaire.report.possibleDiagnosesDescription')}
            </p>
            <div className="flex flex-wrap gap-2">
              {possibleDiagnoses.map((diagnosis, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border"
                >
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span>
                  {diagnosis}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 診断結果 */}
      {diagnosis && (
        <div className="mb-8 diagnosis-section">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">
            {t('questionnaire.report.diagnosisResults')}
          </h2>
          <div className="space-y-4">
            <div
              className="border border-green-200 rounded-lg p-4 bg-green-50"
              style={{ border: '2px solid #000', backgroundColor: '#f5f5f5', padding: '15px' }}
            >
              <h3
                className="font-semibold text-green-800 mb-2"
                style={{ color: '#000', fontSize: '13pt', fontWeight: 'bold' }}
              >
                {t('questionnaire.report.primaryDiagnosisLabel')}
              </h3>
              <p
                className="text-green-700 mb-2"
                style={{ color: '#000', fontSize: '12pt', lineHeight: '1.5' }}
              >
                {diagnosis.primaryDiagnosis}
              </p>
              <div className="text-sm text-green-600" style={{ color: '#000', fontSize: '11pt' }}>
                {t('questionnaire.report.confidenceLevel')}:{' '}
                {Math.round(diagnosis.confidence * 100)}%
              </div>
            </div>

            <div
              className="border border-yellow-200 rounded-lg p-4 bg-yellow-50"
              style={{ border: '2px solid #000', backgroundColor: '#f9f9f9', padding: '15px' }}
            >
              <h3
                className="font-semibold text-yellow-800 mb-2"
                style={{ color: '#000', fontSize: '13pt', fontWeight: 'bold' }}
              >
                {t('questionnaire.report.recommendationsLabel')}
              </h3>
              <p
                className="text-yellow-700"
                style={{ color: '#000', fontSize: '12pt', lineHeight: '1.5' }}
              >
                {diagnosis.recommendations}
              </p>
            </div>

            <div
              className="rounded-lg p-4 border bg-gray-50"
              style={{ border: '2px solid #000', backgroundColor: '#f7f7f7', padding: '15px' }}
            >
              <h3
                className="font-semibold mb-2"
                style={{ color: '#000', fontSize: '13pt', fontWeight: 'bold' }}
              >
                {t('questionnaire.report.urgencyLevelLabel')}
              </h3>
              <div
                style={{
                  color: '#000',
                  fontSize: '12pt',
                  padding: '8px',
                  border: '1px solid #666',
                  backgroundColor: '#fff',
                  display: 'inline-block',
                }}
              >
                【{t(`questionnaire.urgency.${diagnosis.urgencyLevel}`)}】
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重要な注意事項 */}
      <div
        className="border-2 border-red-200 rounded-lg p-4 bg-red-50"
        style={{ border: '3px solid #000', backgroundColor: '#f0f0f0', padding: '20px' }}
      >
        <h3
          className="font-semibold text-red-800 mb-2 flex items-center"
          style={{ color: '#000', fontSize: '14pt', fontWeight: 'bold' }}
        >
          {t('questionnaire.report.importantNotice')}
        </h3>
        <div
          className="text-sm text-red-700 space-y-1"
          style={{ color: '#000', fontSize: '11pt', lineHeight: '1.6' }}
        >
          <p style={{ margin: '8px 0' }}>{t('questionnaire.report.disclaimer.line1')}</p>
          <p style={{ margin: '8px 0' }}>{t('questionnaire.report.disclaimer.line2')}</p>
          <p style={{ margin: '8px 0' }}>{t('questionnaire.report.disclaimer.line3')}</p>
          <p style={{ margin: '8px 0' }}>{t('questionnaire.report.disclaimer.line4')}</p>
        </div>
      </div>

      {/* フッター */}
      <div
        className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500"
        style={{
          marginTop: '30px',
          paddingTop: '15px',
          borderTop: '2px solid #000',
          textAlign: 'center',
          color: '#000',
          fontSize: '10pt',
        }}
      >
        <p style={{ margin: '5px 0', fontWeight: 'bold' }}>
          {t('questionnaire.report.footer.systemName')}
        </p>
        <p style={{ margin: '5px 0' }}>
          {t('questionnaire.report.footer.generatedTime', { time: currentDate })}
        </p>
      </div>
    </div>
  );
};
