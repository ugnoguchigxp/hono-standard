/**
 * @fileoverview 医療問診データリポジトリ (Drizzle版)
 * @description Drizzleを使用した医療問診データの永続化管理
 */

import { db } from '@api/db/client';
import { medicalDiagnoses, medicalInterviews, medicalQuestions } from '@api/db/schema';
import { logger } from '@api/lib/logger';
import { asc, eq } from 'drizzle-orm';
import type { IMedicalDiagnosis, IMedicalInterviewSession, IMedicalQuestion } from '../types';

/**
 * 医療問診データリポジトリクラス
 * @description データベースとのやり取りを担当
 */
export class MedicalInterviewRepository {
  /**
   * 新しい問診セッションを作成
   * @param sessionData - セッション情報
   * @returns 作成されたセッション
   */
  async createInterviewSession(sessionData: {
    sessionId: string;
    patientAge?: number;
    patientGender?: string;
  }): Promise<IMedicalInterviewSession> {
    try {
      const [interview] = await db
        .insert(medicalInterviews)
        .values({
          sessionId: sessionData.sessionId,
          patientAge: sessionData.patientAge,
          patientGender: sessionData.patientGender,
          status: 'IN_PROGRESS',
        })
        .returning();

      logger.info(
        {
          sessionId: sessionData.sessionId,
          interviewId: interview.id,
        },
        'Medical interview session created'
      );

      return {
        sessionId: interview.sessionId,
        interviewId: interview.id,
        patientAge: interview.patientAge ?? undefined,
        patientGender: interview.patientGender ?? undefined,
        status: 'in_progress',
        startedAt: interview.startedAt,
        completedAt: interview.completedAt ?? undefined,
        questionCount: 0,
        collectedInfo: [],
      };
    } catch (error) {
      logger.error(
        {
          sessionId: sessionData.sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to create interview session'
      );
      throw new Error('Failed to create interview session');
    }
  }

  /**
   * セッション情報を取得
   * @param sessionId - セッション識別子
   * @returns セッション情報
   */
  async getInterviewSession(sessionId: string): Promise<IMedicalInterviewSession | null> {
    try {
      const interview = await db.query.medicalInterviews.findFirst({
        where: eq(medicalInterviews.sessionId, sessionId),
        with: {
          questions: {
            orderBy: [asc(medicalQuestions.questionOrder)],
          },
        } as any, // 'with' supports relations if defined, if not we fall back to manual join
      });

      if (!interview) {
        return null;
      }

      // Relations might not be set up in schema.ts yet, so we'll do manual fetch for now if needed
      const questions = await db
        .select()
        .from(medicalQuestions)
        .where(eq(medicalQuestions.interviewId, interview.id))
        .orderBy(asc(medicalQuestions.questionOrder));

      return {
        sessionId: interview.sessionId,
        interviewId: interview.id,
        patientAge: interview.patientAge ?? undefined,
        patientGender: interview.patientGender ?? undefined,
        status: interview.status.toLowerCase() as any,
        startedAt: interview.startedAt,
        completedAt: interview.completedAt ?? undefined,
        questionCount: questions.length,
        currentQuestionId: questions.length > 0 ? questions[questions.length - 1].id : undefined,
        collectedInfo: [],
      };
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to get interview session'
      );
      throw new Error('Failed to get interview session');
    }
  }

  /**
   * 新しい質問を保存
   * @param questionData - 質問データ
   * @returns 保存された質問
   */
  async createQuestion(questionData: {
    interviewId: string;
    questionText: string;
    questionOrder: number;
  }): Promise<IMedicalQuestion> {
    try {
      const [question] = await db
        .insert(medicalQuestions)
        .values({
          interviewId: questionData.interviewId,
          questionText: questionData.questionText,
          questionOrder: questionData.questionOrder,
        })
        .returning();

      logger.info(
        {
          questionId: question.id,
          interviewId: questionData.interviewId,
          order: questionData.questionOrder,
        },
        'Medical question created'
      );

      return {
        id: question.id,
        interviewId: question.interviewId,
        questionText: question.questionText,
        answerText: question.answerText ?? undefined,
        questionOrder: question.questionOrder,
        timestamp: question.timestamp,
      };
    } catch (error) {
      logger.error(
        {
          interviewId: questionData.interviewId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to create question'
      );
      throw new Error('Failed to create question');
    }
  }

  /**
   * 回答を保存
   * @param questionId - 質問識別子
   * @param answerText - 回答テキスト
   */
  async saveAnswer(questionId: string, answerText: string): Promise<void> {
    try {
      await db
        .update(medicalQuestions)
        .set({ answerText })
        .where(eq(medicalQuestions.id, questionId));

      logger.info(
        {
          questionId,
          answerLength: answerText.length,
        },
        'Question answered'
      );
    } catch (error) {
      logger.error(
        {
          questionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to answer question'
      );
      throw new Error('Failed to save answer');
    }
  }

  /**
   * 回答を更新
   * @param questionId - 質問識別子
   * @param newAnswerText - 新しい回答テキスト
   */
  async updateAnswer(questionId: string, newAnswerText: string): Promise<void> {
    try {
      await db
        .update(medicalQuestions)
        .set({ answerText: newAnswerText })
        .where(eq(medicalQuestions.id, questionId));

      logger.info(
        {
          questionId,
          newAnswerLength: newAnswerText.length,
        },
        'Answer updated'
      );
    } catch (error) {
      logger.error(
        {
          questionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to update answer'
      );
      throw new Error('Failed to update answer');
    }
  }

  /**
   * 問診履歴を取得
   * @param sessionId - セッション識別子
   * @returns 問診履歴
   */
  async getInterviewHistory(sessionId: string): Promise<IMedicalQuestion[]> {
    try {
      const interview = await db.query.medicalInterviews.findFirst({
        where: eq(medicalInterviews.sessionId, sessionId),
      });

      if (!interview) {
        throw new Error('Interview not found');
      }

      const questions = await db
        .select()
        .from(medicalQuestions)
        .where(eq(medicalQuestions.interviewId, interview.id))
        .orderBy(asc(medicalQuestions.questionOrder));

      return questions.map((q) => ({
        id: q.id,
        interviewId: q.interviewId,
        questionText: q.questionText,
        answerText: q.answerText ?? undefined,
        questionOrder: q.questionOrder,
        timestamp: q.timestamp,
      }));
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to get interview history'
      );
      throw new Error('Failed to get interview history');
    }
  }

  /**
   * 診断を保存
   * @param diagnosisData - 診断データ
   * @returns 保存された診断
   */
  async createDiagnosis(diagnosisData: {
    interviewId: string;
    primaryDiagnosis: string;
    confidence: number;
    recommendations: string;
    urgencyLevel: string;
  }): Promise<IMedicalDiagnosis> {
    try {
      const [diagnosis] = await db
        .insert(medicalDiagnoses)
        .values({
          interviewId: diagnosisData.interviewId,
          primaryDiagnosis: diagnosisData.primaryDiagnosis,
          confidence: diagnosisData.confidence,
          recommendations: diagnosisData.recommendations,
          urgencyLevel: diagnosisData.urgencyLevel,
        })
        .returning();

      logger.info(
        {
          diagnosisId: diagnosis.id,
          interviewId: diagnosisData.interviewId,
          urgencyLevel: diagnosis.urgencyLevel,
        },
        'Medical diagnosis created'
      );

      return {
        id: diagnosis.id,
        interviewId: diagnosis.interviewId,
        primaryDiagnosis: diagnosis.primaryDiagnosis,
        confidence: diagnosis.confidence,
        recommendations: diagnosis.recommendations,
        urgencyLevel: diagnosis.urgencyLevel.toLowerCase() as any,
        createdAt: diagnosis.createdAt,
      };
    } catch (error) {
      logger.error(
        {
          interviewId: diagnosisData.interviewId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to create diagnosis'
      );
      throw new Error('Failed to create diagnosis');
    }
  }

  /**
   * 問診を完了状態に更新
   * @param sessionId - セッション識別子
   */
  async completeInterview(sessionId: string): Promise<void> {
    try {
      await db
        .update(medicalInterviews)
        .set({
          status: 'COMPLETED',
          completedAt: new Date(),
        })
        .where(eq(medicalInterviews.sessionId, sessionId));

      logger.info({ sessionId }, 'Interview completed');
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to complete interview'
      );
      throw new Error('Failed to complete interview');
    }
  }

  /**
   * 問診をキャンセル状態に更新
   * @param sessionId - セッション識別子
   */
  async cancelInterview(sessionId: string): Promise<void> {
    try {
      await db
        .update(medicalInterviews)
        .set({
          status: 'CANCELLED',
          completedAt: new Date(),
        })
        .where(eq(medicalInterviews.sessionId, sessionId));

      logger.info({ sessionId }, 'Interview cancelled');
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to cancel interview'
      );
      throw new Error('Failed to cancel interview');
    }
  }
}
