/**
 * @fileoverview ありがとうございましたステップコンポーネント
 * @description 問診確定後のお礼画面と自動遷移機能
 */

import type React from 'react';
import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { FaCheck, FaExclamationTriangle, FaInfo } from 'react-icons/fa';

import { createContextLogger } from '@/lib/logger';

const log = createContextLogger('ThankYouStep');

interface IThankYouStepProps {
  onComplete: () => void;
  autoRedirectSeconds?: number;
}

/**
 * ありがとうございましたステップコンポーネント
 * @description 問診完了のお礼と自動遷移
 */
export const ThankYouStep: React.FC<IThankYouStepProps> = ({
  onComplete,
  autoRedirectSeconds = 5,
}) => {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(autoRedirectSeconds);

  useEffect(() => {
    log.info('ThankYou step started', { autoRedirectSeconds });

    const timer = setInterval(() => {
      setCountdown((prev) => {
        log.debug('Countdown tick', { current: prev, remaining: prev - 1 });
        if (prev <= 1) {
          log.info('Auto redirect triggered');
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      log.debug('Clearing countdown timer');
      clearInterval(timer);
    };
  }, [onComplete, autoRedirectSeconds]);

  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      {/* 完了アイコン */}
      <div className="mb-8">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <FaCheck className="w-12 h-12 text-green-600" />
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {t('questionnaire.thankYou.title')}
        </h2>
        <p className="text-lg text-gray-600 mb-6">{t('questionnaire.thankYou.message')}</p>
      </div>

      {/* 追加情報 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <FaInfo className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-blue-800 mb-2">
              {t('questionnaire.thankYou.nextSteps.title')}
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• {t('questionnaire.thankYou.nextSteps.step1')}</li>
              <li>• {t('questionnaire.thankYou.nextSteps.step2')}</li>
              <li>• {t('questionnaire.thankYou.nextSteps.step3')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* カウントダウン */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600 mb-2">
          {t('questionnaire.thankYou.autoRedirect', { seconds: countdown })}
        </p>

        {/* プログレスバー */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${((autoRedirectSeconds - countdown) / autoRedirectSeconds) * 100}%`,
            }}
          ></div>
        </div>

        <button
          onClick={onComplete}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          {t('questionnaire.thankYou.continueNow')}
        </button>
      </div>

      {/* 免責事項 */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <FaExclamationTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-yellow-800 mb-1">
              {t('questionnaire.thankYou.disclaimer.title')}
            </h4>
            <p className="text-sm text-yellow-700">
              {t('questionnaire.thankYou.disclaimer.description')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
