/**
 * @fileoverview エラー表示コンポーネント
 * @description エラーメッセージと回復アクションを表示
 */

import { Button } from '@gxp/design-system';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle } from 'react-icons/fa';

interface IErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  retryText?: string;
}

/**
 * エラー表示コンポーネント
 * @description エラーメッセージと回復オプションを提供
 */
export const ErrorDisplay: React.FC<IErrorDisplayProps> = ({ error, onRetry, retryText }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <FaExclamationTriangle className="h-6 w-6 text-red-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">{t('questionnaire.error.title')}</h3>
          <div className="mt-2 text-sm text-red-700">{error}</div>
          {onRetry && (
            <div className="mt-4">
              <Button
                onClick={onRetry}
                className="border border-red-300 text-red-700 hover:bg-red-50 px-3 py-1 text-sm"
              >
                {retryText || t('questionnaire.error.retry')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
