/**
 * Azure Speech Hook (SDK Version)
 *
 * Azure Speech SDKを使用して、フロントエンドで直接音声認識・合成を行います。
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { useCallback, useRef, useState } from 'react';
import { client } from '@/lib/api';
import { createContextLogger } from '@/lib/logger';

const log = createContextLogger('AzureSpeech');

export const useAzureSpeech = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const synthesizerRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);

  // トークンを取得してSDKを初期化
  const getSpeechConfig = useCallback(async () => {
    const res = await client.speech.token.$get();
    if (!res.ok) throw new Error('Failed to get speech token');
    const { token, region } = await res.json();

    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = 'ja-JP';
    speechConfig.speechSynthesisLanguage = 'ja-JP';
    speechConfig.speechSynthesisVoiceName = 'ja-JP-NanamiNeural';
    return speechConfig;
  }, []);

  // 音声認識開始
  const startListening = useCallback(async () => {
    try {
      const speechConfig = await getSpeechConfig();
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

      recognizer.recognized = (_s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          setRecognizedText((prev) => prev + e.result.text);
          log.info('Recognized:', e.result.text);
        }
      };

      recognizerRef.current = recognizer;
      await new Promise<void>((resolve, reject) => {
        recognizer.startContinuousRecognitionAsync(
          () => resolve(),
          (err) => reject(err)
        );
      });

      setIsListening(true);
      log.info('Started listening');
    } catch (err) {
      log.error('Failed to start listening', err);
    }
  }, [getSpeechConfig]);

  // 音声認識停止
  const stopListening = useCallback(async () => {
    if (recognizerRef.current) {
      await new Promise<void>((resolve) => {
        recognizerRef.current?.stopContinuousRecognitionAsync(() => resolve());
      });
      recognizerRef.current.close();
      recognizerRef.current = null;
    }
    setIsListening(false);
    log.info('Stopped listening');
  }, []);

  // 音声読み上げ
  const speak = useCallback(
    async (text: string) => {
      try {
        setIsSpeaking(true);
        const speechConfig = await getSpeechConfig();
        const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
        synthesizerRef.current = synthesizer;

        await new Promise<void>((resolve, reject) => {
          synthesizer.speakTextAsync(
            text,
            (_result) => {
              synthesizer.close();
              synthesizerRef.current = null;
              resolve();
            },
            (err) => {
              synthesizer.close();
              synthesizerRef.current = null;
              reject(err);
            }
          );
        });
      } catch (err) {
        log.error('Speech synthesis failed', err);
      } finally {
        setIsSpeaking(false);
      }
    },
    [getSpeechConfig]
  );

  // 読み上げ停止
  const stopSpeaking = useCallback(() => {
    if (synthesizerRef.current) {
      synthesizerRef.current.close();
      synthesizerRef.current = null;
    }
    setIsSpeaking(false);
    log.info('Stopped speaking');
  }, []);

  return {
    isListening,
    isSpeaking,
    recognizedText,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearRecognizedText: () => setRecognizedText(''),
  };
};
