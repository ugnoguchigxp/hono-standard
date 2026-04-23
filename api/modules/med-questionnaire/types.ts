/**
 * @fileoverview 医療問診システムの型定義
 * @description WebSocket通信、データベースモデル、API仕様の型定義
 */

/**
 * 問診状態の定義
 */
export type InterviewStatus = 'idle' | 'in_progress' | 'completed' | 'cancelled';

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
  startedAt: Date;
  completedAt?: Date;
  currentQuestionId?: string;
  questionCount: number;
  collectedInfo: string[];
  possibleDiagnoses?: string[];
}

/**
 * 問診質問データ
 */
export interface IMedicalQuestion {
  id: string;
  interviewId: string;
  questionText: string;
  answerText?: string;
  questionOrder: number;
  timestamp: Date;
  aiContext?: string;
}

/**
 * 医療診断結果
 */
export interface IMedicalDiagnosis {
  id: string;
  interviewId: string;
  primaryDiagnosis: string;
  confidence: number;
  recommendations: string;
  urgencyLevel: UrgencyLevel;
  createdAt: Date;
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
    interviewHistory: Array<{
      questionText: string;
      answerText: string;
      timestamp: Date;
    }>;
    diagnosis?: {
      primaryDiagnosis: string;
      confidence: number;
      recommendations: string;
      urgencyLevel: UrgencyLevel;
    };
  };
  timestamp: number;
}

/**
 * 問診プレビューデータ
 */
export interface IInterviewPreviewMessage {
  type: 'interview_preview';
  sessionId: string;
  data: {
    interviewHistory: Array<{
      questionId: string;
      questionText: string;
      answerText: string;
      timestamp: Date;
    }>;
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
  | IInterviewErrorMessage
  | IVoiceModeChangeMessage;

/**
 * ChatGPT API リクエスト用の型
 */
export interface IChatGPTRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stream?: boolean;
}

/**
 * ChatGPT API レスポンス用の型
 */
export interface IChatGPTResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 問診サービス設定
 */
export interface IMedicalInterviewConfig {
  chatGPT: {
    model: string;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
  };
  interview: {
    maxQuestions: number;
    timeoutMs: number;
    autoSaveInterval: number;
  };
  websocket: {
    path: string;
    heartbeatInterval: number;
  };
}

/**
 * 問診進行状況の分析結果
 */
export interface IInterviewAnalysis {
  shouldContinue: boolean;
  completionReason?: string;
  nextQuestionHint?: string;
  collectedCategories: string[];
  missingCategories: string[];
  urgencyLevel: UrgencyLevel;
  confidence: number;
}

/**
 * データベースエンティティのインターフェース（Prisma用）
 */
export interface IMedicalInterviewEntity {
  id: string;
  sessionId: string;
  patientAge?: number;
  patientGender?: string;
  status: InterviewStatus;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMedicalQuestionEntity {
  id: string;
  interviewId: string;
  questionText: string;
  answerText?: string;
  questionOrder: number;
  timestamp: Date;
}

export interface IMedicalDiagnosisEntity {
  id: string;
  interviewId: string;
  primaryDiagnosis: string;
  confidence: number;
  recommendations: string;
  urgencyLevel: UrgencyLevel;
  createdAt: Date;
}
