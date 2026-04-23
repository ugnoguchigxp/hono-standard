/**
 * @fileoverview 音声認識結果表示コンポーネント
 * @description リアルタイムの音声認識結果と中間結果を表示
 */

import type React from 'react';

import { useTranslation } from 'react-i18next';
import { FaMicrophone, FaTimes } from 'react-icons/fa';

interface ISpeechTranscriptProps {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  className?: string;
}

/**
 * 音声認識結果表示コンポーネント
 * @description 確定されたテキストと認識中のテキストを区別して表示
 */
export const SpeechTranscript: React.FC<ISpeechTranscriptProps> = ({
  transcript,
  interimTranscript,
  isListening,
  isSupported,
  className = '',
}) => {
  const { t } = useTranslation();

  if (!isSupported) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg border ${className}`}>
        <div className="flex items-center justify-center text-gray-500">
          <FaTimes className="w-5 h-5 mr-2" />
          <span className="text-sm">{t('questionnaire.errors.speechNotSupported')}</span>
        </div>
      </div>
    );
  }

  const hasContent = transcript || interimTranscript;

  return (
    <div
      className={`relative p-4 bg-white rounded-lg border transition-all duration-300 ${
        isListening ? 'border-blue-300 shadow-lg' : 'border-gray-200'
      } ${className}`}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <FaMicrophone
            className={`w-4 h-4 mr-2 transition-colors duration-300 ${
              isListening ? 'text-blue-500' : 'text-gray-400'
            }`}
          />
          <h3 className="text-sm font-medium text-gray-700">
            {t('questionnaire.speechTranscript.title')}
          </h3>
        </div>

        {isListening && (
          <div className="flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
            <span className="text-xs text-red-600 font-medium">
              {t('questionnaire.speechTranscript.listening')}
            </span>
          </div>
        )}
      </div>

      {/* 音声認識結果表示エリア */}
      <div className="min-h-[60px] max-h-[200px] overflow-y-auto">
        {hasContent ? (
          <div className="space-y-2">
            {/* 確定されたテキスト */}
            {transcript && <div className="text-gray-900 leading-relaxed">{transcript}</div>}

            {/* 認識中のテキスト（グレーアウト） */}
            {interimTranscript && (
              <div className="text-gray-500 italic leading-relaxed">
                {interimTranscript}
                <span className="animate-pulse ml-1">|</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[60px] text-gray-400">
            {isListening ? (
              <div className="flex items-center">
                <div className="flex space-x-1 mr-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
                <span className="text-sm">
                  {t('questionnaire.speechTranscript.waitingForSpeech')}
                </span>
              </div>
            ) : (
              <span className="text-sm">{t('questionnaire.speechTranscript.notListening')}</span>
            )}
          </div>
        )}
      </div>

      {/* フッター情報 */}
      {hasContent && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {t('questionnaire.speechTranscript.charactersCount', {
                count: (transcript + interimTranscript).length,
              })}
            </span>
            {isListening && <span>{t('questionnaire.speechTranscript.speakClearly')}</span>}
          </div>
        </div>
      )}
    </div>
  );
};
