import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	type DashboardFetch,
	defineHttpJsonRecordQueryV2,
} from "./http-json-query";
import { dashboardRecordQueryTestContext } from "./test-helpers";

const pipelineResponseSchema = z.object({
	runs: z.array(
		z.object({
			id: z.string(),
			pipeline: z.string(),
			branch: z.string().nullable(),
			status: z.enum([
				"queued",
				"running",
				"succeeded",
				"failed",
				"cancelled",
			]),
			startedAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
			finishedAt: z
				.string()
				.datetime({ offset: true })
				.nullable()
				.transform((value) => (value === null ? null : new Date(value))),
			url: z.string().url().nullable(),
		}),
	),
});

describe("pipeline HTTP/JSON recipe", () => {
	it("maps validated pipeline runs through the shared Record adapter", async () => {
		const fetchMock = vi.fn<DashboardFetch>(async () =>
			new Response(
				JSON.stringify({
					runs: [
						{
							id: "run-1",
							pipeline: "deploy",
							branch: "main",
							status: "failed",
							startedAt: "2026-07-18T00:00:00.000Z",
							finishedAt: "2026-07-18T00:02:00.000Z",
							url: "https://ci.example.test/private/run-1",
						},
					],
				}),
				{ headers: { "content-type": "application/json" } },
			),
		);
		const query = defineHttpJsonRecordQueryV2({
			id: "pipeline-runs",
			filterKeys: ["status"],
			baseUrl: "https://ci.example.test",
			frameName: "Pipeline runs",
			columns: [
				{ source: "startedAt", type: "time", roles: ["time"] },
				{ source: "pipeline", type: "string", roles: ["series"] },
				{ source: "status", type: "string", roles: ["state"] },
				{ source: "durationMs", type: "number", roles: ["value", "duration"] },
			],
			responseSchema: pipelineResponseSchema,
			request: () => ({ path: "/api/runs" }),
			selectRecords: ({ runs }) =>
				runs.map(({ url: _url, ...run }) => ({
					...run,
					durationMs:
						run.finishedAt === null
							? null
							: run.finishedAt.getTime() - run.startedAt.getTime(),
				})),
			fetch: fetchMock,
		});

		const result = await query.handler(dashboardRecordQueryTestContext());
		expect(result.frames[0]?.fields.map((field) => field.values)).toEqual([
			[1784332800000],
			["deploy"],
			["failed"],
			[120000],
		]);
		expect(JSON.stringify(result)).not.toContain("/private/run-1");
	});
});
