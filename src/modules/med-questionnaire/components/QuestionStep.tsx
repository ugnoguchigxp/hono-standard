/**
 * @fileoverview Medical questionnaire question step component
 * @description Displays medical interview questions and handles voice/text input for answers
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { FaMicrophone, FaPlay, FaRedo, FaStop } from 'react-icons/fa';

import { createContextLogger } from '@/lib/logger';

import type { IMedicalQuestion } from '../types/medicalQuestionnaire';

const log = createContextLogger('QuestionStep');

/**
 * Props interface for QuestionStep component
 * @interface IQuestionStepProps
 */
interface IQuestionStepProps {
  /** Current medical interview question */
  question: IMedicalQuestion;
  /** Whether speech recognition is actively recording */
  isRecording: boolean;
  /** Whether the answer is being sent to server */
  isSending: boolean;
  /** Final speech recognition transcript */
  speechTranscript?: string;
  /** Interim speech recognition results */
  speechInterimTranscript?: string;
  /** Whether speech recognition is supported in browser */
  speechSupported: boolean;
  /** Whether speech recognition is paused */
  speechPaused?: boolean;
  /** Whether auto speech is currently playing */
  isAutoSpeechPlaying: boolean;
  /** Current auto speech playback state */
  autoSpeechPlaybackState: 'idle' | 'playing' | 'paused' | 'completed';
  /** Whether voice mode is enabled globally */
  voiceModeEnabled: boolean;
  /** Error message to display */
  error?: string;
  /** Callback to start voice recording */
  onStartRecording: () => void;
  /** Callback to stop voice recording */
  onStopRecording: () => void;
  /** Callback to send answer text */
  onSendAnswer: (answer: string) => void;
  /** Callback to stop auto speech */
  onStopAutoSpeech: () => void;
  /** Callback to resume auto speech */
  onResumeAutoSpeech: () => void;
  /** Callback to repeat auto speech */
  onRepeatAutoSpeech: () => Promise<void>;
}

/**
 * Medical questionnaire question step component
 * @description Displays interview questions with voice and text input capabilities
 * @param props - Component props containing question data and callback functions
 * @returns JSX element for the question step
 * @example
 * ```tsx
 * <QuestionStep
 *   question={currentQuestion}
 *   isRecording={isRecording}
 *   isSending={isSending}
 *   speechTranscript={transcript}
 *   voiceModeEnabled={voiceModeEnabled}
 *   onStartRecording={startRecording}
 *   onStopRecording={stopRecording}
 *   onSendAnswer={sendAnswer}
 * />
 * ```
 */
export const QuestionStep: React.FC<IQuestionStepProps> = ({
  question,
  isRecording,
  isSending,
  speechTranscript = '',
  speechInterimTranscript = '',
  speechSupported,
  speechPaused = false,
  isAutoSpeechPlaying,
  autoSpeechPlaybackState,
  voiceModeEnabled,
  error,
  onStartRecording,
  onStopRecording,
  onSendAnswer,
  onStopAutoSpeech,
  onResumeAutoSpeech,
  onRepeatAutoSpeech,
}) => {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState('');

  // 新しい質問が来たときにテキストエリアをリセット
  useEffect(() => {
    setAnswer('');
    log.debug('Text area reset for new question', { questionId: question.id });
  }, [question.id]);

  // 音声認識結果をテキストエリアに反映 - 音声モードが有効な場合のみ
  useEffect(() => {
    if (voiceModeEnabled && speechTranscript) {
      setAnswer(speechTranscript);
      log.debug('Answer updated from speech recognition', {
        transcriptLength: speechTranscript.length,
      });
    }
  }, [speechTranscript, voiceModeEnabled]);

  // 音声認識の開始/停止制御
  const handleMicToggle = useCallback(() => {
    if (isRecording) {
      onStopRecording();
      log.info('Voice recording stopped');
    } else {
      onStartRecording();
      log.info('Voice recording started');
    }
  }, [isRecording, onStopRecording, onStartRecording]);

  // 回答送信処理
  const handleSendAnswer = useCallback(async () => {
    if (!answer.trim()) {
      return;
    }

    log.info('Sending answer', {
      questionId: question.id,
      answerLength: answer.trim().length,
    });

    onSendAnswer(answer.trim());
    setAnswer('');
  }, [answer, question.id, onSendAnswer]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Enter または Cmd+Enter で送信
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (answer.trim() && !isSending) {
          handleSendAnswer();
        }
      }

      // Cmd+Space（Mac）/ Ctrl+Space（Windows/Linux）で音声認識トグル（音声モード有効時のみ）
      if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
        event.preventDefault();
        if (voiceModeEnabled && speechSupported && !isSending && !isAutoSpeechPlaying) {
          handleMicToggle();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    answer,
    isSending,
    speechSupported,
    voiceModeEnabled,
    isAutoSpeechPlaying,
    handleSendAnswer,
    handleMicToggle,
  ]);

  const displayAnswer =
    answer + (voiceModeEnabled && speechInterimTranscript ? ` ${speechInterimTranscript}` : '');
  const canSend = answer.trim() && !isSending && (!voiceModeEnabled || !isRecording);

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* 質問表示 */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-3">
          <div className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded-full">
            Q{question.questionOrder}
          </div>
          {question.isFirstQuestion && (
            <div className="bg-green-100 text-green-800 text-sm font-medium px-2 py-1 rounded-full">
              {t('questionnaire.question.firstQuestion')}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{question.questionText}</h2>
              {voiceModeEnabled && (
                <div className="text-xs text-gray-600">
                  {t('questionnaire.question.answerPrompt')}
                </div>
              )}
            </div>

            {/* 読み上げ制御 - 音声モードが有効な場合のみ表示 */}
            {voiceModeEnabled && (
              <div className="flex items-center space-x-1 ml-3">
                {autoSpeechPlaybackState === 'playing' ? (
                  <>
                    <div className="flex items-center text-xs text-gray-600 mr-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1"></div>
                      {t('questionnaire.question.speech.playing')}
                    </div>
                    <button
                      onClick={onStopAutoSpeech}
                      className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                      title={t('questionnaire.question.speech.stop')}
                    >
                      <FaStop className="w-4 h-4" />
                    </button>
                  </>
                ) : autoSpeechPlaybackState === 'paused' ? (
                  <>
                    <div className="flex items-center text-xs text-gray-600 mr-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                      {t('questionnaire.question.speech.paused')}
                    </div>
                    <button
                      onClick={onResumeAutoSpeech}
                      className="text-green-600 hover:text-green-700 p-1 rounded-full hover:bg-green-50"
                      title={t('questionnaire.question.speech.resume')}
                    >
                      <FaPlay className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onRepeatAutoSpeech}
                    className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"
                    title={t('questionnaire.question.speech.repeat')}
                  >
                    <FaRedo className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 統合された回答入力エリア */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {/* テキスト入力エリア */}
        <div className="mb-3">
          <textarea
            id="answer-input"
            placeholder={t('questionnaire.answer.placeholder')}
            value={displayAnswer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />

          {voiceModeEnabled && speechInterimTranscript && (
            <div className="mt-1 text-sm text-gray-500">
              <span className="font-medium">{t('questionnaire.question.recognizing')}:</span>
              <span className="italic ml-1">{speechInterimTranscript}</span>
            </div>
          )}
        </div>

        {/* 統合されたコントロールバー */}
        <div className="flex items-center justify-between">
          {/* 左側: 音声録音状態表示 */}
          <div className="flex items-center space-x-3">
            {/* マイクボタン - 音声モードが有効な場合のみ表示 */}
            {voiceModeEnabled && speechSupported && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleMicToggle}
                  disabled={isSending || isAutoSpeechPlaying}
                  className={`p-2 rounded-full transition-all ${
                    isRecording
                      ? 'bg-red-500 text-white shadow-lg transform scale-110'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FaMicrophone className="w-5 h-5" />
                </button>

                {/* 録音状態表示 */}
                <div className="text-sm text-gray-500">
                  {isRecording ? (
                    <span className="flex items-center text-red-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1"></div>
                      {t('questionnaire.question.recording.active')}
                    </span>
                  ) : speechPaused ? (
                    <span className="flex items-center text-yellow-600">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                      {t('questionnaire.question.recording.paused')}
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      {t('questionnaire.question.recording.mic')}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 右側: 文字数カウントと送信ボタン */}
          <div className="flex items-center space-x-3">
            {answer.trim().length > 0 && (
              <span className="text-sm text-gray-500">
                {answer.trim().length}
                {t('questionnaire.question.charCount')}
              </span>
            )}

            <button
              onClick={() => setAnswer('')}
              disabled={!answer.trim() || isSending || isRecording}
              className="px-3 py-1 text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 rounded-md"
            >
              {t('questionnaire.question.buttons.clear')}
            </button>

            <button
              onClick={handleSendAnswer}
              disabled={!canSend}
              className={`px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 rounded-md font-medium ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center space-x-2">
                {isSending && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>
                  {isSending
                    ? t('questionnaire.question.buttons.sending')
                    : t('questionnaire.question.buttons.send')}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* ヒント */}
        <div className="mt-2 text-xs text-gray-500 text-center">
          {t('questionnaire.question.shortcuts.send')}
          {voiceModeEnabled && ` • ${t('questionnaire.question.shortcuts.voice')}`}
        </div>

        {/* エラー表示 */}
        {error && <div className="mt-2 text-sm text-red-500 text-center">{error}</div>}
      </div>
    </div>
  );
};
