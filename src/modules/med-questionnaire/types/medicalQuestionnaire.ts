/**
 * @fileoverview 医療問診システムのフロントエンド型定義
 * @description WebSocket通信、状態管理、UI コンポーネントの型定義
 */

/**
 * 問診状態の定義
 */
export type InterviewStatus = 'idle' | 'in_progress' | 'preview' | 'thankyou' | 'completed';

/**
 * 緊急度レベルの定義
 */
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'emergency';

/**
 * 問診セッション情報
 */
export interface IMedicalInterviewSession {
  sessionId: string;
  interviewId?: string;
  patientAge?: number;
  patientGender?: string;
  status: InterviewStatus;
  startedAt?: Date;
  completedAt?: Date;
  currentQuestionId?: string;
  questionCount: number;
  collectedInfo: string[];
}

/**
 * 問診質問データ
 */
export interface IMedicalQuestion {
  id: string;
  questionText: string;
  answerText?: string;
  questionOrder: number;
  timestamp: Date;
  isFirstQuestion?: boolean;
}

/**
 * 医療診断結果
 */
export interface IMedicalDiagnosis {
  primaryDiagnosis: string;
  confidence: number;
  recommendations: string;
  urgencyLevel: UrgencyLevel;
}

/**
 * 問診履歴項目
 */
export interface IInterviewHistoryItem {
  questionId: string;
  questionText: string;
  answerText: string;
  timestamp: Date;
}

/**
 * WebSocketメッセージ型定義
 */

/**
 * 問診開始メッセージ
 */
export interface IStartInterviewMessage {
  type: 'start_interview';
  sessionId: string;
  data: {
    patientAge?: number;
    patientGender?: string;
    voiceModeEnabled?: boolean;
  };
  timestamp: number;
}

/**
 * ユーザー回答メッセージ
 */
export interface IUserResponseMessage {
  type: 'user_response';
  sessionId: string;
  data: {
    answerText: string;
    questionId: string;
  };
  timestamp: number;
}

/**
 * 新しい質問メッセージ
 */
export interface INewQuestionMessage {
  type: 'new_question';
  sessionId: string;
  data: {
    questionId: string;
    questionText: string;
    isFirstQuestion: boolean;
    questionOrder: number;
  };
  timestamp: number;
}

/**
 * 問診終了メッセージ
 */
export interface IInterviewFinishedMessage {
  type: 'interview_finished';
  sessionId: string;
  data: {
    interviewHistory: IInterviewHistoryItem[];
    diagnosis?: IMedicalDiagnosis;
  };
  timestamp: number;
}

/**
 * 問診プレビューメッセージ
 */
export interface IInterviewPreviewMessage {
  type: 'interview_preview';
  sessionId: string;
  data: {
    interviewHistory: IInterviewHistoryItem[];
    canEdit: boolean;
    possibleDiagnoses?: string[];
  };
  timestamp: number;
}

/**
 * 回答編集メッセージ
 */
export interface IEditAnswerMessage {
  type: 'edit_answer';
  sessionId: string;
  data: {
    questionId: string;
    newAnswerText: string;
  };
  timestamp: number;
}

/**
 * 問診確定メッセージ
 */
export interface IConfirmInterviewMessage {
  type: 'confirm_interview';
  sessionId: string;
  data: {
    finalConfirmation: boolean;
  };
  timestamp: number;
}

/**
 * システムステータスメッセージ
 */
export interface ISystemStatusMessage {
  type: 'system_status';
  sessionId: string;
  data: {
    status: string;
    message: string;
    user?: {
      id: string;
      email: string;
      displayName: string;
      permissions?: string[];
    };
  };
  timestamp: number;
}

/**
 * エラーメッセージ
 */
export interface IInterviewErrorMessage {
  type: 'interview_error';
  sessionId: string;
  data: {
    error: string;
    code?: string;
    details?: unknown;
  };
  timestamp: number;
}

/**
 * 音声モード変更メッセージ
 */
export interface IVoiceModeChangeMessage {
  type: 'voice_mode_change';
  sessionId: string;
  data: {
    voiceModeEnabled: boolean;
  };
  timestamp: number;
}

/**
 * テキスト補正メッセージ
 */
export interface ITextCorrectedMessage {
  type: 'text_corrected';
  sessionId: string;
  data: {
    originalText: string;
    correctedText: string;
    confidence: number;
    corrections?: boolean;
  };
  timestamp: number;
}

/**
 * 音声テキスト処理メッセージ
 */
export interface IVoiceTextProcessedMessage {
  type: 'voice_text_processed';
  sessionId: string;
  data: {
    originalText: string;
    correctedText: string;
    hasCorrections: boolean;
    confidence: number;
    isPartial: boolean;
  };
  timestamp: number;
}

/**
 * 音声テキスト入力メッセージ
 */
export interface IVoiceTextInputMessage {
  type: 'voice_text_input';
  sessionId: string;
  data: {
    text: string;
  };
  timestamp: number;
}

/**
 * 音声モード更新メッセージ
 */
export interface IVoiceModeUpdatedMessage {
  type: 'voice_mode_updated';
  sessionId: string;
  data: {
    voiceModeEnabled: boolean;
  };
  timestamp: number;
}

/**
 * WebSocket認証エラーメッセージ
 */
export interface IAuthErrorMessage {
  type: 'auth_error';
  sessionId?: string;
  data: {
    message: string;
  };
  timestamp?: number;
}

/**
 * WebSocketセッションエラーメッセージ
 */
export interface ISessionErrorMessage {
  type: 'session_error';
  sessionId?: string;
  data: {
    message: string;
  };
  timestamp?: number;
}

/**
 * WebSocket率制限エラーメッセージ
 */
export interface IRateLimitErrorMessage {
  type: 'rate_limit_error';
  sessionId?: string;
  data: {
    message: string;
    retryAfter?: number;
  };
  timestamp?: number;
}

/**
 * WebSocketシステムエラーメッセージ
 */
export interface ISystemErrorMessage {
  type: 'system_error';
  sessionId?: string;
  data: {
    message: string;
  };
  timestamp?: number;
}

/**
 * 問診WebSocketメッセージの共用型
 */
export type MedicalInterviewMessage =
  | IStartInterviewMessage
  | IUserResponseMessage
  | INewQuestionMessage
  | IInterviewFinishedMessage
  | IInterviewPreviewMessage
  | IEditAnswerMessage
  | IConfirmInterviewMessage
  | ISystemStatusMessage
  | IInterviewErrorMessage
  | IVoiceModeChangeMessage
  | ITextCorrectedMessage
  | IVoiceTextProcessedMessage
  | IVoiceTextInputMessage
  | IVoiceModeUpdatedMessage
  | IAuthErrorMessage
  | ISessionErrorMessage
  | IRateLimitErrorMessage
  | ISystemErrorMessage;

/**
 * 問診フック の状態
 */
export interface IQuestionnaireState {
  interviewState: InterviewStatus;
  currentQuestion: IMedicalQuestion | null;
  history: IInterviewHistoryItem[];
  isRecording: boolean;
  isConnected: boolean;
  isSending: boolean;
  error: string | null;
  diagnosis: IMedicalDiagnosis | null;
  possibleDiagnoses: string[];
  patientAge?: number;
  patientGender?: string;
  sessionId: string | null;

  // Speech recognition state
  speechTranscript: string;
  speechInterimTranscript: string;
  speechSupported: boolean;
  speechPaused: boolean;

  // Auto speech state
  isAutoSpeechPlaying: boolean;
  autoSpeechEnabled: boolean;
  autoSpeechPlaybackState: 'idle' | 'playing' | 'paused' | 'completed';

  // Voice mode state
  voiceModeEnabled: boolean;

  // Debug mode state
  debugModeEnabled: boolean;

  // Text correction state
  originalText: string;
  correctedText: string;
  hasTextCorrections: boolean;
}

/**
 * 問診フックのアクション
 */
export interface IQuestionnaireActions {
  connect: () => Promise<void>;
  startInterview: (patientAge?: number, patientGender?: string) => void;
  sendAnswer: (answerText: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  editAnswer: (questionId: string, newAnswerText: string) => void;
  confirmInterview: () => void;
  completeThankYou: () => void;
  resetInterview: () => void;
  toggleAutoSpeech: () => void;
  stopAutoSpeech: () => void;
  resumeAutoSpeech: () => void;
  repeatAutoSpeech: () => Promise<void>;
  toggleVoiceMode: () => void;
  toggleDebugMode: () => void;
  startDebugInterview: (patientAge?: number, patientGender?: string) => void;
  sendDebugAnswer: (answerText: string) => void;
}

/**
 * Web Speech API の型定義
 */
export interface ISpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
      isFinal: boolean;
    };
  };
  resultIndex: number;
}

export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): ISpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): ISpeechRecognition;
    };
  }
}

/**
 * UI コンポーネントのプロパティ型
 */

/**
 * 問診ページのプロパティ
 */
export type IQuestionnairePageProps = {};

/**
 * 質問ステップコンポーネントのプロパティ
 */
export interface IQuestionStepProps {
  question: IMedicalQuestion;
  isRecording: boolean;
  speechTranscript?: string;
  speechInterimTranscript?: string;
  speechSupported: boolean;
  isAutoSpeechPlaying: boolean;
  autoSpeechEnabled: boolean;
  autoSpeechPlaybackState: 'idle' | 'playing' | 'paused' | 'completed';
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSendAnswer: (answer: string) => void;
  onToggleAutoSpeech: () => void;
  onStopAutoSpeech: () => void;
  onResumeAutoSpeech: () => void;
  onRepeatAutoSpeech: () => Promise<void>;
}

/**
 * プレビューステップコンポーネントのプロパティ
 */
export interface IPreviewStepProps {
  history: IInterviewHistoryItem[];
  diagnosis?: IMedicalDiagnosis;
  possibleDiagnoses?: string[];
  onEditAnswer: (questionId: string, newAnswer: string) => void;
  onConfirm: () => void;
  onBack?: () => void;
}

/**
 * マイクボタンコンポーネントのプロパティ
 */
export interface IMicButtonProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
}

/**
 * 問診履歴コンポーネントのプロパティ
 */
export interface IInterviewHistoryProps {
  history: IInterviewHistoryItem[];
  onEditAnswer?: (questionId: string, newAnswer: string) => void;
  readOnly?: boolean;
}

/**
 * WebSocket接続状態
 */
export interface IWebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessageTime: number | null;
}
