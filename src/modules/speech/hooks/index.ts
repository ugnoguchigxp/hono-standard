/**
 * Speech Module Hooks
 * Speech機能関連のカスタムHooks
 */

export * from './config';
// Re-export types and configs
export * from './types';
export { useAutoSpeech } from './useAutoSpeech';
export { useAzureSpeech } from './useAzureSpeech';
// Re-export from the main speech recognition hook
export {
  useSpeechRecognition,
  useSpeechRecognition as useGlobalSpeechRecognition,
} from './useSpeechRecognition';
export { useSpeechSynthesis } from './useSpeechSynthesis';
