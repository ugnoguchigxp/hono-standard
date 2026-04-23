import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { vitalsRecords } from '../../db/schema';
import { createOpenApiRouter } from '../../lib/openapi';
import { vitalsService } from '../../services/vitals/vitals.service';

const vitalsRoutes = createOpenApiRouter();

const analyzeVitalsSchema = z.object({
  forehead: z.object({
    r: z.array(z.number()),
    g: z.array(z.number()),
    b: z.array(z.number()),
  }),
  left_cheek: z.object({
    r: z.array(z.number()),
    g: z.array(z.number()),
    b: z.array(z.number()),
  }),
  right_cheek: z.object({
    r: z.array(z.number()),
    g: z.array(z.number()),
    b: z.array(z.number()),
  }),
  thumbnail: z.string().optional(),
});

vitalsRoutes.openapi(
  {
    method: 'post',
    path: '/analyze',
    summary: 'Analyze ROI RGB data and save to DB',
    request: {
      body: {
        content: {
          'application/json': {
            schema: analyzeVitalsSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Vitals analysis result',
        content: {
          'application/json': {
            schema: z.object({
              heart_rate_bpm: z.number(),
              respiratory_rate: z.number(),
              quality_score: z.number(),
              confidence: z.number(),
              rmssd: z.number().optional(),
              sdnn: z.number().optional(),
              dark_circle_index: z.number().optional(),
              edema_index: z.number().optional(),
              puffiness_index: z.number().optional(),
              lip_index: z.number().optional(),
              sunken_cheek_index: z.number().optional(),
              drowsiness_index: z.number().optional(),
              inebriation_level: z.number().optional(),
              anemia_index: z.number().optional(),
              fatigue_index: z.number().optional(),
              status: z.string(),
              thumbnail_url: z.string().optional(),
              baseline: z
                .object({
                  heart_rate_bpm: z.number(),
                  stress_level: z.number(),
                  fatigue_index: z.number(),
                })
                .optional(),
            }),
          },
        },
      },
    },
  },
  async (c) => {
    const data = await c.req.json();

    // サムネイルの保存
    let thumbnailUrl: string | undefined;
    if (data.thumbnail) {
      try {
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'vitals');
        await mkdir(uploadDir, { recursive: true });

        const fileName = `vitals_${Date.now()}.jpg`;
        const filePath = join(uploadDir, fileName);
        const buffer = Buffer.from(data.thumbnail, 'base64');
        await writeFile(filePath, buffer);
        thumbnailUrl = `/uploads/vitals/${fileName}`;
      } catch (e) {
        console.error('Failed to save thumbnail:', e);
      }
    }

    // 解析の実行
    const result = await vitalsService.analyzeVitals({
      forehead: data.forehead,
      left_cheek: data.left_cheek,
      right_cheek: data.right_cheek,
      // 拡張データも渡す
      ...data,
    } as Parameters<typeof vitalsService.analyzeVitals>[0]);

    if (result.status === 'success') {
      // データベースへの保存
      try {
        const userId = '00000000-0000-0000-0000-000000000000';
        await db.insert(vitalsRecords).values({
          userId,
          recordedAt: new Date(),
          heartRate: result.heart_rate_bpm,
          respiratoryRate: result.respiratory_rate,
          qualityScore: result.quality_score,
          confidence: result.confidence,
          rmssd: result.rmssd,
          sdnn: result.sdnn,
          lf: result.lf,
          hf: result.hf,
          lfHfRatio: result.lf_hf_ratio,
          stressLevel: result.stress_level,
          autonomicBalance: result.autonomic_balance,
          darkCircleIndex: result.dark_circle_index,
          edemaIndex: result.edema_index,
          puffinessIndex: result.puffiness_index,
          lipIndex: result.lip_index,
          sunkenCheekIndex: result.sunken_cheek_index,
          drowsinessIndex: result.drowsiness_index,
          inebriationLevel: result.inebriation_level,
          anemiaIndex: result.anemia_index,
          fatigueIndex: result.fatigue_index,
          thumbnailUrl: thumbnailUrl,
        });

        // ベースライン（過去10回の平均）の取得
        const pastRecords = await db.query.vitalsRecords.findMany({
          where: eq(vitalsRecords.userId, userId),
          orderBy: [desc(vitalsRecords.recordedAt)],
          limit: 10,
        });

        if (pastRecords.length > 0) {
          const baseline = {
            heart_rate_bpm:
              pastRecords.reduce((acc, r) => acc + r.heartRate, 0) / pastRecords.length,
            stress_level:
              pastRecords.reduce((acc, r) => acc + (r.stressLevel ?? 0), 0) / pastRecords.length,
            fatigue_index:
              pastRecords.reduce((acc, r) => acc + (r.fatigueIndex ?? 0), 0) / pastRecords.length,
          };

          return c.json({
            ...result,
            thumbnail_url: thumbnailUrl,
            baseline,
          });
        }
      } catch (e) {
        console.error('Failed to save record or calc baseline:', e);
      }
    }

    return c.json({
      ...result,
      thumbnail_url: thumbnailUrl,
    });
  }
);

vitalsRoutes.openapi(
  {
    method: 'get',
    path: '/history',
    summary: 'Get vitals measurement history',
    responses: {
      200: {
        description: 'Vitals history list',
        content: {
          'application/json': {
            schema: z.array(
              z.object({
                id: z.string(),
                heart_rate: z.number(),
                respiratory_rate: z.number().nullable(),
                recorded_at: z.string(),
                thumbnail_url: z.string().nullable(),
                dark_circle_index: z.number().nullable(),
                edema_index: z.number().nullable(),
              })
            ),
          },
        },
      },
    },
  },
  async (c) => {
    // 履歴の取得
    const history = await db.query.vitalsRecords.findMany({
      orderBy: [desc(vitalsRecords.recordedAt)],
      limit: 50,
    });

    return c.json(
      history.map((h) => ({
        id: h.id,
        heart_rate: h.heartRate,
        respiratory_rate: h.respiratoryRate,
        recorded_at: h.recordedAt.toISOString(),
        thumbnail_url: h.thumbnailUrl,
        dark_circle_index: h.darkCircleIndex,
        edema_index: h.edemaIndex,
      }))
    );
  }
);

export { vitalsRoutes };
