/**
 * @fileoverview Medical interview service (Simplified)
 * @description Core service for managing medical interview sessions with ChatGPT integration
 */

import { logger } from '@api/lib/logger';
import { MedicalInterviewContext } from '../context/medicalInterviewContext';
import { MedicalInterviewRepository } from '../repositories/medicalInterviewRepository';
import type {
  UrgencyLevel as CustomUrgencyLevel,
  IInterviewAnalysis,
  IMedicalDiagnosis,
  IMedicalInterviewSession,
  IMedicalQuestion,
} from '../types';
import { ChatGPTService } from './chatGPTService';
import { MultiAgentChatGPTService } from './multiAgentChatGPTService';

/**
 * Medical interview service class
 */
export class MedicalInterviewService {
  private activeSessions: Map<string, IMedicalInterviewSession> = new Map();
  private conversationHistory: Map<
    string,
    Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  > = new Map();
  private useMultiAgent: boolean;
  private chatGPTService: ChatGPTService;
  private multiAgentChatGPTService: MultiAgentChatGPTService;
  private repository: MedicalInterviewRepository;

  constructor() {
    this.chatGPTService = new ChatGPTService();
    this.multiAgentChatGPTService = new MultiAgentChatGPTService();
    this.repository = new MedicalInterviewRepository();
    this.useMultiAgent = process.env.ENABLE_MULTI_AGENT === 'true';

    logger.info(
      {
        multiAgentEnabled: this.useMultiAgent,
      },
      'Medical Interview Service initialized'
    );
  }

  /**
   * Start a new medical interview session
   */
  async startInterview(
    sessionId: string,
    patientAge?: number,
    patientGender?: string
  ): Promise<IMedicalInterviewSession> {
    try {
      const interviewSession = await this.repository.createInterviewSession({
        sessionId,
        patientAge,
        patientGender,
      });

      this.activeSessions.set(sessionId, interviewSession);

      const systemPrompt = MedicalInterviewContext.getInitialSystemPrompt();
      const patientInfo = this.formatPatientInfo(patientAge, patientGender);

      this.conversationHistory.set(sessionId, [
        {
          role: 'system',
          content: `${systemPrompt}\n\n${patientInfo}`,
        },
      ]);

      logger.info(
        {
          sessionId,
          interviewId: interviewSession.interviewId,
          patientAge,
          patientGender,
        },
        `Medical interview started`
      );

      return interviewSession;
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to start medical interview'
      );
      throw new Error('Failed to start interview');
    }
  }

  /**
   * Generate first question
   */
  async generateFirstQuestion(sessionId: string): Promise<IMedicalQuestion> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const conversation = this.conversationHistory.get(sessionId) || [];
      const prompt = `あなたは経験豊富な問診医です。患者との問診を開始してください。挨拶は簡潔にし、すぐに症状について尋ねてください。`;

      conversation.push({ role: 'user', content: prompt });
      const response = await this.chatGPTService.generateResponse(conversation);
      conversation.push({ role: 'assistant', content: response });

      this.conversationHistory.set(sessionId, conversation);

      const question = await this.repository.createQuestion({
        interviewId: session.interviewId!,
        questionText: response,
        questionOrder: 1,
      });

      session.questionCount = 1;
      session.currentQuestionId = question.id;
      this.activeSessions.set(sessionId, session);

      return question;
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to generate first question'
      );
      throw new Error('Failed to generate first question');
    }
  }

  /**
   * Save answer to the database
   */
  async saveAnswer(questionId: string, answerText: string): Promise<void> {
    await this.repository.saveAnswer(questionId, answerText);
  }

  /**
   * Process answer and decide next action
   */
  async processAnswer(
    sessionId: string,
    _questionId: string,
    answerText: string
  ): Promise<IInterviewAnalysis> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) throw new Error('Session not found');

      const conversation = this.conversationHistory.get(sessionId) || [];
      conversation.push({ role: 'user', content: answerText });

      const progressContext = MedicalInterviewContext.getProgressContext(
        session.questionCount,
        session.collectedInfo
      );

      const analysisPrompt = `患者の回答: "${answerText}"\n${progressContext}\n問診を継続すべきか判断してください。終了する場合は「COMPLETE」と回答してください。継続する場合は次に聞くべき質問のヒントを回答してください。`;

      const analysisResponse = this.useMultiAgent
        ? await this.multiAgentChatGPTService.generateResponse([
            ...conversation,
            { role: 'system', content: analysisPrompt },
          ])
        : await this.chatGPTService.generateResponse([
            ...conversation,
            { role: 'system', content: analysisPrompt },
          ]);

      const shouldContinue = !analysisResponse.includes('COMPLETE');
      const urgencyLevel = this.assessUrgency(answerText);

      const updatedCollectedInfo = this.updateCollectedInfo(session.collectedInfo, answerText);
      session.collectedInfo = updatedCollectedInfo;
      this.activeSessions.set(sessionId, session);

      return {
        shouldContinue,
        completionReason: shouldContinue
          ? undefined
          : 'AI determined sufficient information collected',
        nextQuestionHint: shouldContinue ? analysisResponse : undefined,
        collectedCategories: updatedCollectedInfo,
        missingCategories: this.getMissingCategories(updatedCollectedInfo),
        urgencyLevel,
        confidence: 0.8,
      };
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to process answer'
      );
      throw new Error('Failed to process answer');
    }
  }

  /**
   * Generate next question
   */
  async generateNextQuestion(sessionId: string, hint?: string): Promise<IMedicalQuestion> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) throw new Error('Session not found');

      const conversation = this.conversationHistory.get(sessionId) || [];
      const prompt = hint
        ? `次のガイダンスに基づいて、あなたは医者として患者に対する次の質問を一つだけ生成してください：\n${hint}`
        : `あなたは医者です。前の患者の回答を踏まえて、次の質問を一つだけ生成してください。`;

      conversation.push({ role: 'user', content: prompt });
      const response = this.useMultiAgent
        ? await this.multiAgentChatGPTService.generateResponse(conversation)
        : await this.chatGPTService.generateResponse(conversation);
      conversation.push({ role: 'assistant', content: response });

      this.conversationHistory.set(sessionId, conversation);

      const question = await this.repository.createQuestion({
        interviewId: session.interviewId!,
        questionText: response,
        questionOrder: session.questionCount + 1,
      });

      session.questionCount += 1;
      session.currentQuestionId = question.id;
      this.activeSessions.set(sessionId, session);

      return question;
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to generate next question'
      );
      throw new Error('Failed to generate next question');
    }
  }

  async completeInterview(sessionId: string): Promise<{
    history: IMedicalQuestion[];
    diagnosis?: IMedicalDiagnosis;
  }> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) throw new Error('Session not found');

      const history = await this.repository.getInterviewHistory(sessionId);
      const diagnosis = await this.generateDiagnosis(sessionId, history);

      await this.repository.completeInterview(sessionId);
      session.status = 'completed';
      session.completedAt = new Date();
      this.activeSessions.set(sessionId, session);

      return { history, diagnosis };
    } catch (_error) {
      throw new Error('Failed to complete interview');
    }
  }

  private formatPatientInfo(age?: number, gender?: string): string {
    const info = [];
    if (age) info.push(`年齢: ${age}歳`);
    if (gender) info.push(`性別: ${gender}`);
    return info.length > 0 ? `# 患者基本情報\n${info.join('\n')}\n` : '# 患者基本情報\n未設定\n';
  }

  private assessUrgency(answerText: string): CustomUrgencyLevel {
    const highUrgencyKeywords = ['激痛', '意識', '呼吸困難', '大量出血', '39度'];
    if (highUrgencyKeywords.some((kw) => answerText.includes(kw))) return 'high';
    return 'low';
  }

  private updateCollectedInfo(currentInfo: string[], answerText: string): string[] {
    const info = [...currentInfo];
    if (answerText.includes('痛')) if (!info.includes('主訴')) info.push('主訴');
    return info;
  }

  private getMissingCategories(collectedInfo: string[]): string[] {
    const all = ['主訴', '症状詳細', '随伴症状', '既往歴', 'アレルギー', '服薬歴', '生活環境'];
    return all.filter((cat) => !collectedInfo.includes(cat));
  }

  private async generateDiagnosis(
    sessionId: string,
    history: IMedicalQuestion[]
  ): Promise<IMedicalDiagnosis | undefined> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return undefined;

      const diagnosisPrompt = `問診内容を分析し、JSON形式で診断結果を出してください。 { "primaryDiagnosis": "...", "confidence": 0.8, "urgencyLevel": "LOW", "recommendations": "..." } \n\n履歴:\n${history.map((q) => `${q.questionText}\n${q.answerText}`).join('\n\n')}`;

      const response = await this.chatGPTService.generateResponse([
        { role: 'system', content: diagnosisPrompt },
      ]);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return undefined;
      const data = JSON.parse(jsonMatch[0]);

      return await this.repository.createDiagnosis({
        interviewId: session.interviewId!,
        primaryDiagnosis: data.primaryDiagnosis,
        confidence: data.confidence,
        recommendations: data.recommendations,
        urgencyLevel: data.urgencyLevel,
      });
    } catch (_error) {
      return undefined;
    }
  }
}
