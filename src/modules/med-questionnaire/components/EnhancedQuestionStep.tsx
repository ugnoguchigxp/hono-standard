/**
 * @fileoverview Enhanced Medical questionnaire question step with text correction
 * @description Integrates voice recognition error correction using quick-fix service
 */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { FaMicrophone, FaPlay, FaRedo, FaStop } from 'react-icons/fa';

import { createContextLogger } from '@/lib/logger';

import type { IMedicalQuestion } from '../types/medicalQuestionnaire';

const log = createContextLogger('EnhancedQuestionStep');

/**
 * Enhanced props interface with text correction support
 */
interface IEnhancedQuestionStepProps {
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
 * Enhanced Medical questionnaire question step with text correction
 */
export const EnhancedQuestionStep: React.FC<IEnhancedQuestionStepProps> = ({
  question,
  isRecording,
  isSending,
  speechTranscript = '',
  speechInterimTranscript = '',
  speechSupported,
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
  const [originalSpeechText, setOriginalSpeechText] = useState('');

  // Reset answer when new question arrives
  useEffect(() => {
    setAnswer('');
    setOriginalSpeechText('');
    log.debug('Text area reset for new question', { questionId: question.id });
  }, [question.id]);

  /**
   * Handle speech transcript updates
   */
  useEffect(() => {
    if (voiceModeEnabled && speechTranscript && speechTranscript !== originalSpeechText) {
      setOriginalSpeechText(speechTranscript);
      setAnswer(speechTranscript);

      log.debug('Answer updated from speech', {
        length: speechTranscript.length,
      });
    }
  }, [speechTranscript, voiceModeEnabled, originalSpeechText]);

  /**
   * Voice recording toggle
   */
  const handleMicToggle = useCallback(() => {
    if (isRecording) {
      onStopRecording();
      log.info('Voice recording stopped');
    } else {
      onStartRecording();
      log.info('Voice recording started');
    }
  }, [isRecording, onStopRecording, onStartRecording]);

  /**
   * Send answer
   */
  const handleSendAnswer = useCallback(async () => {
    if (!answer.trim()) return;

    log.info('Sending answer', {
      questionId: question.id,
      answerLength: answer.trim().length,
    });

    onSendAnswer(answer.trim());
    setAnswer('');
    setOriginalSpeechText('');
  }, [answer, question.id, onSendAnswer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to send
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (answer.trim() && !isSending) {
          handleSendAnswer();
        }
      }

      // Ctrl+Space or Cmd+Space for voice toggle
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
      {/* Question Display */}
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

            {/* Speech controls */}
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

      {/* Answer Input Area */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="mb-3">
          <textarea
            id="answer-input"
            placeholder={t('questionnaire.answer.placeholder')}
            value={displayAnswer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSending || (voiceModeEnabled && isRecording)}
          />
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          {/* Left side controls */}
          <div className="flex items-center space-x-2">
            {/* Voice recording button */}
            {voiceModeEnabled && speechSupported && (
              <button
                onClick={handleMicToggle}
                disabled={isSending || isAutoSpeechPlaying}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${
                  isRecording
                    ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isRecording ? '録音停止 (Ctrl+Space)' : '録音開始 (Ctrl+Space)'}
              >
                <FaMicrophone className="w-4 h-4" />
                <span className="text-sm">{isRecording ? '録音中...' : '音声入力'}</span>
                {isRecording && (
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </button>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSendAnswer}
            disabled={!canSend}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="回答送信 (Ctrl+Enter)"
          >
            {isSending ? '送信中...' : '回答を送信'}
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Status indicators */}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            {voiceModeEnabled && <span>音声モード: {speechSupported ? '有効' : '非対応'}</span>}
          </div>
          <div>Ctrl+Enter: 送信 | Ctrl+Space: 音声</div>
        </div>
      </div>
    </div>
  );
};
