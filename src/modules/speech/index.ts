// Speech Module Exports

// Components
export { SpeechActivityLogs } from './components/SpeechActivityLogs';
export { SpeechInitializer } from './components/SpeechInitializer';
// Hooks and Provider
export {
  SpeechProvider,
  useSpeech,
  useSpeechStatus,
  useTextToSpeech,
} from './components/SpeechProvider';
export { SpeechRecognitionComponent } from './components/SpeechRecognitionComponent';
export { SpeechSampleSelector } from './components/SpeechSampleSelector';
export { SpeechStatistics } from './components/SpeechStatistics';
export { SpeechSynthesisComponent } from './components/SpeechSynthesisComponent';
export { SpeechSynthesisSettings } from './components/SpeechSynthesisSettings';
export { SpeechSynthesisSettingsButton } from './components/SpeechSynthesisSettingsButton';
export { SpeechSynthesisSettingsDrawer } from './components/SpeechSynthesisSettingsDrawer';

// Speech Hooks
export * from './hooks';
