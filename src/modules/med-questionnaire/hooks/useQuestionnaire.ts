/**
 * @fileoverview 医療問診カスタムフック (HTTP版)
 * @description 問診状態管理とHTTP通信のロジック
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client } from '@/lib/api';
import { createContextLogger } from '@/lib/logger';
import { useSpeechRecognition } from '../../speech/hooks/useSpeechRecognition';
import type {
  IInterviewHistoryItem,
  IMedicalDiagnosis,
  IMedicalQuestion,
  InterviewStatus,
  IQuestionnaireActions,
  IQuestionnaireState,
} from '../types/medicalQuestionnaire';
import { useQuestionnaireAutoSpeech } from './useQuestionnaireAutoSpeech';

const log = createContextLogger('useQuestionnaire');

export const useQuestionnaire = (): IQuestionnaireState & IQuestionnaireActions => {
  const { t } = useTranslation();

  // State management
  const [interviewState, setInterviewState] = useState<InterviewStatus>('idle');
  const [currentQuestion, setCurrentQuestion] = useState<IMedicalQuestion | null>(null);
  const [history, setHistory] = useState<IInterviewHistoryItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<IMedicalDiagnosis | null>(null);
  const [possibleDiagnoses, _setPossibleDiagnoses] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [patientAge, setPatientAge] = useState<number | undefined>(undefined);
  const [patientGender, setPatientGender] = useState<string | undefined>(undefined);
  const [isSending, setIsSending] = useState(false);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(true);
  const voiceModeEnabledRef = useRef(true);
  const [debugModeEnabled, setDebugModeEnabled] = useState(false);

  // Speech recognition integration
  const speechRecognition = useSpeechRecognition();
  const speechRecognitionRef = useRef(speechRecognition);
  useEffect(() => {
    speechRecognitionRef.current = speechRecognition;
  }, [speechRecognition]);

  // Auto speech integration
  const autoSpeech = useQuestionnaireAutoSpeech(voiceModeEnabled);
  const autoSpeechRef = useRef(autoSpeech);
  useEffect(() => {
    autoSpeechRef.current = autoSpeech;
  }, [autoSpeech]);

  useEffect(() => {
    voiceModeEnabledRef.current = voiceModeEnabled;
  }, [voiceModeEnabled]);

  const connect = useCallback(async () => {
    setIsConnected(true);
    setSessionId(crypto.randomUUID());
    log.info('Interview session initialized');
  }, []);

  const startInterview = useCallback(
    async (age?: number, gender?: string) => {
      setIsSending(true);
      setError(null);
      setPatientAge(age);
      setPatientGender(gender);
      setHistory([]);

      try {
        const sid = sessionId || crypto.randomUUID();
        if (!sessionId) setSessionId(sid);

        const res = await (client as any)['med-questionnaire'].start.$post({
          json: { sessionId: sid, patientAge: age, patientGender: gender },
        });

        if (!res.ok) throw new Error('Failed to start interview');

        const data = await res.json();
        const firstQ = data.firstQuestion;

        setCurrentQuestion(firstQ);
        setInterviewState('in_progress');

        if (voiceModeEnabledRef.current) {
          autoSpeechRef.current.playQuestion(firstQ.questionText);
        }
      } catch (err) {
        setError(t('questionnaire.errors.connectionError'));
        log.error('Failed to start interview', { err });
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, t]
  );

  const sendAnswer = useCallback(
    async (answerText: string) => {
      if (!currentQuestion || isSending) return;

      setIsSending(true);
      setError(null);

      try {
        const res = await (client as any)['med-questionnaire'].response.$post({
          json: {
            sessionId: sessionId!,
            questionId: currentQuestion.id,
            answerText,
          },
        });

        if (!res.ok) throw new Error('Failed to send answer');

        const data = await res.json();

        // Update history
        const newHistoryItem: IInterviewHistoryItem = {
          questionId: currentQuestion.id,
          questionText: currentQuestion.questionText,
          answerText: answerText,
          timestamp: new Date(),
        };
        setHistory((prev) => [...prev, newHistoryItem]);

        if (data.analysis.shouldContinue) {
          setCurrentQuestion(data.nextQuestion);
          if (voiceModeEnabledRef.current) {
            autoSpeechRef.current.playQuestion(data.nextQuestion.questionText);
          }
        } else {
          setDiagnosis(data.diagnosis);
          setInterviewState('completed');
          setCurrentQuestion(null);
        }
      } catch (err) {
        setError(t('questionnaire.errors.sendFailed'));
        log.error('Failed to send answer', { err });
      } finally {
        setIsSending(false);
      }
    },
    [currentQuestion, isSending, sessionId, t]
  );

  const startRecording = useCallback(() => {
    speechRecognitionRef.current.resetTranscript();
    speechRecognitionRef.current.startListening();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    speechRecognitionRef.current.stopListening();
    setIsRecording(false);
  }, []);

  const resetInterview = useCallback(() => {
    setInterviewState('idle');
    setCurrentQuestion(null);
    setHistory([]);
    setError(null);
    setDiagnosis(null);
  }, []);

  const toggleVoiceMode = useCallback(() => {
    setVoiceModeEnabled(!voiceModeEnabled);
  }, [voiceModeEnabled]);

  // Dummy actions
  const editAnswer = useCallback(() => {}, []);
  const confirmInterview = useCallback(() => {
    setInterviewState('completed');
  }, []);
  const stopAutoSpeech = useCallback(() => autoSpeechRef.current.stopSpeech(), []);
  const resumeAutoSpeech = useCallback(() => {}, []);
  const repeatAutoSpeech = useCallback(
    () => autoSpeechRef.current.playQuestion(currentQuestion?.questionText || ''),
    [currentQuestion]
  );
  const toggleDebugMode = useCallback(
    () => setDebugModeEnabled(!debugModeEnabled),
    [debugModeEnabled]
  );
  const startDebugInterview = useCallback(() => {}, []);
  const sendDebugAnswer = useCallback(() => {}, []);
  const completeThankYou = useCallback(() => setInterviewState('completed'), []);

  return {
    interviewState,
    currentQuestion,
    history,
    isRecording,
    isConnected,
    isSending,
    error,
    diagnosis,
    possibleDiagnoses,
    sessionId,
    patientAge,
    patientGender,
    speechTranscript: speechRecognition.transcript,
    speechInterimTranscript: '',
    speechSupported: speechRecognition.isSupported,
    speechPaused: false,
    isAutoSpeechPlaying: autoSpeech.isPlaying,
    autoSpeechEnabled: autoSpeech.isEnabled,
    autoSpeechPlaybackState: 'idle',
    voiceModeEnabled,
    debugModeEnabled,
    originalText: '',
    correctedText: '',
    hasTextCorrections: false,
    connect,
    startInterview,
    sendAnswer,
    startRecording,
    stopRecording,
    editAnswer,
    confirmInterview,
    resetInterview,
    toggleAutoSpeech: () => {},
    stopAutoSpeech,
    resumeAutoSpeech,
    repeatAutoSpeech,
    toggleVoiceMode,
    toggleDebugMode,
    startDebugInterview,
    sendDebugAnswer,
    completeThankYou,
  };
};
