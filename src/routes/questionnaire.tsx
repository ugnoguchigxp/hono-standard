import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { createContextLogger } from '@/lib/logger';
import {
  CompletionStep,
  ConnectionStatus,
  EnhancedQuestionStep,
  ErrorDisplay,
  PreviewStep,
  StartStep,
  ThankYouStep,
} from '@/modules/med-questionnaire';
import { useQuestionnaire } from '@/modules/med-questionnaire/hooks/useQuestionnaire';

const log = createContextLogger('MedicalQuestionnaire');

export const Route = createFileRoute('/questionnaire')({
  component: MedicalQuestionnairePage,
});

function MedicalQuestionnairePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const {
    interviewState,
    currentQuestion,
    history,
    isRecording,
    isConnected,
    isSending,
    error,
    diagnosis,
    possibleDiagnoses,
    patientAge,
    patientGender,
    speechTranscript,
    speechInterimTranscript,
    speechSupported,
    speechPaused,
    isAutoSpeechPlaying,
    autoSpeechPlaybackState,
    voiceModeEnabled,
    debugModeEnabled,
    connect,
    startInterview,
    sendAnswer,
    startRecording,
    stopRecording,
    editAnswer,
    confirmInterview,
    resetInterview,
    stopAutoSpeech,
    resumeAutoSpeech,
    repeatAutoSpeech,
    toggleVoiceMode,
    toggleDebugMode,
    startDebugInterview,
    sendDebugAnswer,
    completeThankYou,
  } = useQuestionnaire();

  // 接続を自動開始（認証済み時のみ）
  useEffect(() => {
    if (isAuthenticated && !isConnected) {
      log.info('Starting connection for medical questionnaire', {
        isAuthenticated,
        user: user?.id,
        isConnected,
      });
      // WebSocketの代わりにHTTPベースの初期化などが必要な場合はここで行う
      connect().catch((error) => {
        log.error('Failed to connect', { error });
      });
    }
  }, [connect, isConnected, isAuthenticated, user]);

  // 認証状態チェック
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t('questionnaire.auth.title', 'ログインが必要です')}
          </h1>
          <p className="text-gray-600 mb-6">
            {t('questionnaire.auth.message', '医療問診を利用するにはログインしてください。')}
          </p>
          <button
            onClick={() => (window.location.href = '/login')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('questionnaire.auth.loginButton', 'ログインページへ')}
          </button>
        </div>
      </div>
    );
  }

  const renderCurrentStep = () => {
    switch (interviewState) {
      case 'idle':
        return (
          <StartStep
            onStart={startInterview}
            isConnected={isConnected}
            voiceModeEnabled={voiceModeEnabled}
            onToggleVoiceMode={toggleVoiceMode}
            error={error || undefined}
            debugModeEnabled={debugModeEnabled}
            onToggleDebugMode={toggleDebugMode}
            onStartDebugInterview={startDebugInterview}
          />
        );

      case 'in_progress':
        if (!currentQuestion) {
          return (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">{t('questionnaire.loading.waitingForQuestion')}</p>
              </div>
            </div>
          );
        }

        return (
          <EnhancedQuestionStep
            question={currentQuestion}
            isRecording={isRecording}
            isSending={isSending}
            speechTranscript={speechTranscript}
            speechInterimTranscript={speechInterimTranscript}
            speechSupported={speechSupported}
            speechPaused={speechPaused}
            isAutoSpeechPlaying={isAutoSpeechPlaying}
            autoSpeechPlaybackState={autoSpeechPlaybackState}
            voiceModeEnabled={voiceModeEnabled}
            error={error || undefined}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onSendAnswer={debugModeEnabled ? sendDebugAnswer : sendAnswer}
            onStopAutoSpeech={stopAutoSpeech}
            onResumeAutoSpeech={resumeAutoSpeech}
            onRepeatAutoSpeech={repeatAutoSpeech}
          />
        );

      case 'preview':
        return (
          <PreviewStep
            history={history}
            diagnosis={diagnosis || undefined}
            possibleDiagnoses={possibleDiagnoses}
            onEditAnswer={editAnswer}
            onConfirm={confirmInterview}
            onBack={resetInterview}
          />
        );

      case 'thankyou':
        return <ThankYouStep onComplete={completeThankYou} />;

      case 'completed':
        return (
          <CompletionStep
            history={history}
            diagnosis={diagnosis || undefined}
            possibleDiagnoses={possibleDiagnoses}
            patientAge={patientAge}
            patientGender={patientGender}
            onRestart={resetInterview}
          />
        );

      default:
        return (
          <ErrorDisplay error={t('questionnaire.errors.unknownState')} onRetry={resetInterview} />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{t('questionnaire.header.title')}</h1>
            <ConnectionStatus isConnected={isConnected} interviewState={interviewState} />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm">{renderCurrentStep()}</div>
      </div>
    </div>
  );
}
