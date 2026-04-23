/**
 * Auto Speech Hook
 * サーバー生成音声ファイルの自動再生管理
 */

import { useCallback, useRef, useState } from 'react';

import { client } from '@/lib/api';

interface AutoSpeechFile {
  fileId: string;
  fileUrl: string;
  chunks: number;
  textLength: number;
}

export const useAutoSpeech = () => {
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [currentFile, setCurrentFile] = useState<AutoSpeechFile | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const apiClient = client as any;

  const playAutoSpeech = useCallback(async (speechData: AutoSpeechFile) => {
    try {
      // 既存の再生停止
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setCurrentFile(speechData);
      setIsAutoPlaying(true);

      const audio = new Audio();
      audio.crossOrigin = 'use-credentials'; // CORS対応
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const fullUrl = `${baseUrl}${speechData.fileUrl}`;
      audio.src = fullUrl;
      audio.preload = 'auto';

      audioRef.current = audio;

      // 再生完了時の処理
      audio.onended = async () => {
        setIsAutoPlaying(false);
        setCurrentFile(null);

        // サーバーに即座削除を要求
        try {
          await apiClient.post(`/api/speech/cleanup/${speechData.fileId}`, {}, { skipAuth: true });
        } catch {
          // Silent cleanup failure - non-critical
        }
      };

      // エラーハンドリング
      audio.onerror = () => {
        setIsAutoPlaying(false);
        setCurrentFile(null);
      };

      // 再生開始
      await audio.play();
    } catch {
      setIsAutoPlaying(false);
      setCurrentFile(null);
    }
  }, []);

  const stopAutoSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsAutoPlaying(false);
    setCurrentFile(null);
  }, []);

  return {
    isAutoPlaying,
    currentFile,
    playAutoSpeech,
    stopAutoSpeech,
  };
};
