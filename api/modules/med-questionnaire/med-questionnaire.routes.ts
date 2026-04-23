import { logger } from '@api/lib/logger';
import { createOpenApiRouter } from '@api/lib/openapi';
import { createRoute, z } from '@hono/zod-openapi';
import { MedicalInterviewService } from './services/medicalInterviewService';

const medQuestionnaireService = new MedicalInterviewService();

const startInterviewRoute = createRoute({
  method: 'post',
  path: '/start',
  summary: '問診を開始する',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            sessionId: z.string(),
            patientAge: z.number().optional(),
            patientGender: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '問診が開始されました',
      content: {
        'application/json': {
          schema: z.object({
            session: z.any(),
            firstQuestion: z.any(),
          }),
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

const submitResponseRoute = createRoute({
  method: 'post',
  path: '/response',
  summary: '回答を送信し、次の質問または診断を取得する',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            sessionId: z.string(),
            questionId: z.string(),
            answerText: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '回答が処理されました',
      content: {
        'application/json': {
          schema: z.object({
            analysis: z.any(),
            nextQuestion: z.any().optional(),
            diagnosis: z.any().optional(),
          }),
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

export const medQuestionnaireRouter = createOpenApiRouter()
  .openapi(startInterviewRoute, async (c) => {
    const rawData = await c.req.json();
    const validatedData = c.req.valid('json');
    const { sessionId, patientAge, patientGender } =
      validatedData && Object.keys(validatedData).length > 0 ? validatedData : rawData;

    try {
      const session = await medQuestionnaireService.startInterview(
        sessionId,
        patientAge,
        patientGender
      );
      const firstQuestion = await medQuestionnaireService.generateFirstQuestion(sessionId);
      return c.json({ session, firstQuestion }, 200);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? { message: error.message, stack: error.stack } : error },
        'Failed to start interview'
      );
      return c.json({ error: 'Failed to start interview' }, 500);
    }
  })
  .openapi(submitResponseRoute, async (c) => {
    const rawData = await c.req.json();
    const validatedData = c.req.valid('json');
    const { sessionId, questionId, answerText } =
      validatedData && Object.keys(validatedData).length > 0 ? validatedData : rawData;

    try {
      await medQuestionnaireService.saveAnswer(questionId, answerText);
      const analysis = await medQuestionnaireService.processAnswer(
        sessionId,
        questionId,
        answerText
      );

      if (analysis.shouldContinue) {
        const nextQuestion = await medQuestionnaireService.generateNextQuestion(
          sessionId,
          analysis.nextQuestionHint
        );
        return c.json({ analysis, nextQuestion }, 200);
      } else {
        const result = await medQuestionnaireService.completeInterview(sessionId);
        return c.json({ analysis, diagnosis: result.diagnosis }, 200);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to process answer');
      return c.json({ error: 'Failed to process answer' }, 500);
    }
  });
