/**
 * @fileoverview Medical questionnaire auto speech hook
 * @description Custom hook for automatic speech synthesis and playback of medical questionnaire questions using Azure Speech Service
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createContextLogger } from '@/lib/logger';
import { useAzureSpeech } from '../../speech/hooks/useAzureSpeech';

const log = createContextLogger('useQuestionnaireAutoSpeech');

type SpeechPlaybackState = 'idle' | 'playing' | 'paused' | 'completed';

interface IAutoSpeechState {
  isPlaying: boolean;
  isEnabled: boolean;
  playbackState: SpeechPlaybackState;
}

interface IAutoSpeechActions {
  playQuestion: (questionText: string) => Promise<void>;
  stopSpeech: () => void;
  repeatSpeech: () => Promise<void>;
  toggleAutoSpeech: () => void;
}

export const useQuestionnaireAutoSpeech = (
  voiceModeEnabled: boolean = true
): IAutoSpeechState & IAutoSpeechActions => {
  useTranslation();
  const azureSpeech = useAzureSpeech();

  // State
  const [isEnabled, setIsEnabled] = useState(true);
  const [playbackState, setPlaybackState] = useState<SpeechPlaybackState>('idle');

  // Current question text for repeat functionality
  const currentQuestionTextRef = useRef<string>('');

  // Use Azure Speech state for playing status
  const isPlaying = azureSpeech.isSpeaking;

  const playQuestion = useCallback(
    async (questionText: string): Promise<void> => {
      if (!voiceModeEnabled || !isEnabled || !questionText.trim()) {
        return;
      }

      try {
        currentQuestionTextRef.current = questionText;
        setPlaybackState('playing');

        await azureSpeech.speak(questionText);

        setPlaybackState('completed');
        log.info('Question speech completed');
      } catch (error) {
        log.error('Failed to play question speech', error);
        setPlaybackState('idle');
      }
    },
    [isEnabled, voiceModeEnabled, azureSpeech]
  );

  const stopSpeech = useCallback(() => {
    azureSpeech.stopSpeaking();
    setPlaybackState('paused');
    log.info('Speech playback stopped');
  }, [azureSpeech]);

  const repeatSpeech = useCallback(async (): Promise<void> => {
    if (!currentQuestionTextRef.current) return;
    azureSpeech.stopSpeaking();
    setPlaybackState('idle');
    setTimeout(() => {
      playQuestion(currentQuestionTextRef.current);
    }, 100);
  }, [playQuestion, azureSpeech]);

  const toggleAutoSpeech = useCallback(() => {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (!newEnabled && isPlaying) {
      azureSpeech.stopSpeaking();
      setPlaybackState('idle');
    }
    log.info('Auto speech toggled', { enabled: newEnabled });
  }, [isEnabled, isPlaying, azureSpeech]);

  return {
    isPlaying,
    isEnabled,
    playbackState,
    playQuestion,
    stopSpeech,
    repeatSpeech,
    toggleAutoSpeech,
  };
};
