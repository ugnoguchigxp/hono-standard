/**
 * 統一Speech設定
 * 音声認識・合成音声の設定値を一元管理
 */

import type { SpeechConfig, SpeechRecognitionConfig, SpeechSynthesisConfig } from './types';

// 基本設定
export const DEFAULT_SPEECH_CONFIG: Required<SpeechConfig> = {
  language: 'ja-JP',
  maxLength: 1000,
  stripMarkdown: true,
  autoStart: false,
} as const;

// 音声認識設定
export const DEFAULT_RECOGNITION_CONFIG: Required<SpeechRecognitionConfig> = {
  ...DEFAULT_SPEECH_CONFIG,
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  onResult: () => {},
  onError: () => {},
  onStart: () => {},
  onEnd: () => {},
  onSilenceTimeout: () => {},
  silenceTimeoutMs: 2000,
} as const;

// 音声合成設定（Azure Speech Service対応）
export const DEFAULT_SYNTHESIS_CONFIG: Required<SpeechSynthesisConfig> = {
  ...DEFAULT_SPEECH_CONFIG,
  voice: 'ja-JP-NanamiNeural', // Azure Speech Service音声名
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  onStart: () => {},
  onEnd: () => {},
  onError: () => {},
} as const;

// API エンドポイント
export const SPEECH_API_ENDPOINTS = {
  CONFIG: '/api/speech/config',
  SYNTHESIZE: '/api/speech/synthesize',
  RECOGNIZE: '/api/speech/recognize',
  TEST: '/api/speech/test',
} as const;

// エラーメッセージ
export const SPEECH_ERROR_MESSAGES = {
  NOT_SUPPORTED: 'お使いのブラウザは音声機能をサポートしていません',
  MICROPHONE_DENIED: 'マイクへのアクセスが拒否されました',
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  SYNTHESIS_FAILED: '音声合成に失敗しました',
  RECOGNITION_FAILED: '音声認識に失敗しました',
  CONFIG_ERROR: '音声設定の取得に失敗しました',
  AUTHENTICATION_REQUIRED: '認証が必要です',
} as const;

// パフォーマンス設定
export const SPEECH_PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 300,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  TIMEOUT_MS: 30000,
  MAX_AUDIO_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// 音声アバター定義（Azure Speech Service対応）
export const VOICE_AVATARS = {
  'ja-JP': [
    { id: 'ja-JP-NanamiNeural', name: 'ななみ (女性・標準)', gender: 'female', style: 'neutral' },
    { id: 'ja-JP-AoiNeural', name: 'あおい (女性・標準)', gender: 'female', style: 'neutral' },
    { id: 'ja-JP-MayuNeural', name: 'まゆ (女性・標準)', gender: 'female', style: 'neutral' },
    { id: 'ja-JP-ShioriNeural', name: 'しおり (女性・標準)', gender: 'female', style: 'neutral' },
    { id: 'ja-JP-KeitaNeural', name: 'けいた (男性・標準)', gender: 'male', style: 'neutral' },
    { id: 'ja-JP-DaichiNeural', name: 'だいち (男性・標準)', gender: 'male', style: 'neutral' },
    { id: 'ja-JP-NaokiNeural', name: 'なおき (男性・標準)', gender: 'male', style: 'neutral' },
  ],
  'en-US': [
    { id: 'en-US-AriaNeural', name: 'Aria (Female, Standard)', gender: 'female', style: 'neutral' },
    { id: 'en-US-DavisNeural', name: 'Davis (Male, Standard)', gender: 'male', style: 'neutral' },
    {
      id: 'en-US-JennyNeural',
      name: 'Jenny (Female, Friendly)',
      gender: 'female',
      style: 'friendly',
    },
    {
      id: 'en-US-GuyNeural',
      name: 'Guy (Male, Professional)',
      gender: 'male',
      style: 'professional',
    },
    { id: 'en-US-SaraNeural', name: 'Sara (Female, Young)', gender: 'female', style: 'young' },
    { id: 'en-US-TonyNeural', name: 'Tony (Male, Energetic)', gender: 'male', style: 'energetic' },
  ],
  'en-GB': [
    {
      id: 'en-GB-SoniaNeural',
      name: 'Sonia (Female, Standard)',
      gender: 'female',
      style: 'neutral',
    },
    { id: 'en-GB-RyanNeural', name: 'Ryan (Male, Standard)', gender: 'male', style: 'neutral' },
    {
      id: 'en-GB-LibbyNeural',
      name: 'Libby (Female, Friendly)',
      gender: 'female',
      style: 'friendly',
    },
    {
      id: 'en-GB-ElliotNeural',
      name: 'Elliot (Male, Professional)',
      gender: 'male',
      style: 'professional',
    },
  ],
} as const;

// サポートされている言語（Azure Speech Service対応）
export const SUPPORTED_LANGUAGES = [
  { code: 'ja-JP', name: '日本語', voice: 'ja-JP-NanamiNeural' },
  { code: 'en-US', name: 'English (US)', voice: 'en-US-AriaNeural' },
  { code: 'en-GB', name: 'English (GB)', voice: 'en-GB-SoniaNeural' },
] as const;

// ブラウザサポート検出
export const detectSpeechSupport = () => {
  const hasWebSpeechAPI = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const hasSpeechSynthesis = 'speechSynthesis' in window;
  const hasMediaDevices = navigator?.mediaDevices?.getUserMedia !== undefined;

  return {
    recognition: hasWebSpeechAPI && hasMediaDevices,
    synthesis: hasSpeechSynthesis,
    overall: hasWebSpeechAPI && hasSpeechSynthesis && hasMediaDevices,
  };
};
