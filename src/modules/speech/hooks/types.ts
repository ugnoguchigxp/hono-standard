/**
 * 統一Speech型定義
 * 音声認識・合成音声の共通型定義
 */

// 共通設定
export interface SpeechConfig {
  language?: string;
  maxLength?: number;
  stripMarkdown?: boolean;
  autoStart?: boolean;
}

// 音声認識関連
export interface SpeechRecognitionState {
  isListening: boolean;
  isRecognizing: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  isPaused: boolean;
  error: string | null;
  confidence?: number;
}

export interface SpeechRecognitionConfig extends SpeechConfig {
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  /** 2秒間の無音後に実行されるコールバック（チャット送信などに使用） */
  onSilenceTimeout?: () => void;
  /** 無音検知のタイムアウト時間（ミリ秒、デフォルト：2000） */
  silenceTimeoutMs?: number;
}

export interface SpeechRecognitionMethods {
  startListening: () => Promise<void>;
  stopListening: () => void;
  pauseListening: () => void;
  resumeListening: () => void;
  resetTranscript: () => void;
}

// 音声合成関連
export interface SpeechSynthesisState {
  isSpeaking: boolean;
  isLoading: boolean;
  error: string | null;
  isSupported: boolean;
  duration?: number;
  isPaused: boolean;
}

export interface SpeechSynthesisConfig extends SpeechConfig {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface SpeechSynthesisResponse {
  success: boolean;
  audioData?: string;
  duration?: number;
  format?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: any;
  error?: string;
}

export interface SpeechSynthesisMethods {
  speak: (text: string, options?: Partial<SpeechSynthesisConfig>) => Promise<void>;
  stopSpeaking: () => void;
  pauseSpeaking: () => void;
  resumeSpeaking: () => void;
}

// 音声アバター型
export interface VoiceAvatar {
  id: string;
  name: string;
  gender: 'male' | 'female';
  style:
    | 'neutral'
    | 'young'
    | 'calm'
    | 'gentle'
    | 'cheerful'
    | 'polite'
    | 'strong'
    | 'friendly'
    | 'professional'
    | 'energetic';
}

export interface LanguageVoices {
  [languageCode: string]: readonly VoiceAvatar[];
}

// 統合Speech Hook型
export interface UnifiedSpeechHook {
  // 認識
  recognition: SpeechRecognitionState & SpeechRecognitionMethods;

  // 合成
  synthesis: SpeechSynthesisState & SpeechSynthesisMethods;

  // 共通
  isSupported: boolean;
  config: SpeechConfig;
  updateConfig: (config: Partial<SpeechConfig>) => void;
}

// エラー型
export interface SpeechError {
  code: string;
  message: string;
  type: 'recognition' | 'synthesis' | 'config' | 'network';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
}

// デモページ用の型
export interface SpeechDemoState {
  inputText: string;
  outputText: string;
  isActive: boolean;
  logs: Array<{
    timestamp: Date;
    type: 'info' | 'warn' | 'error';
    message: string;
  }>;
}
