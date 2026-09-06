import { describe, expect, it, vi } from "vitest";
import { AgenticSearchService } from "./agentic-search.service";

const runnerResult = {
	answer: "Grounded answer",
	citations: [],
	toolTrace: [
		{ tool: "search_evidence", status: "ok" },
		{ tool: "fetch", status: "error" },
	],
	usage: { totalTokens: 12 },
};

describe("AgenticSearchService", () => {
	it("combines user settings with runtime search context and logs completion", async () => {
		const settingsRepository = {
			getSystemContextForUser: vi.fn().mockResolvedValue({
				systemContext: "Use concise Japanese.",
			}),
		};
		const runner = { run: vi.fn().mockResolvedValue(runnerResult) };
		const log = vi.fn();
		const service = new AgenticSearchService({
			settingsRepository: settingsRepository as never,
			runner: runner as never,
			debug: true,
			log,
		});

		const result = await service.run({
			query: "deployment",
			userId: "user-1",
			category: "ops",
			topK: 5,
		});

		expect(result).toBe(runnerResult);
		expect(settingsRepository.getSystemContextForUser).toHaveBeenCalledWith(
			"user-1",
		);
		expect(runner.run).toHaveBeenCalledWith(
			expect.objectContaining({
				query: "deployment",
				category: "ops",
				topK: 5,
				systemContext: expect.stringContaining("Use concise Japanese."),
			}),
		);
		expect(log).toHaveBeenCalledWith(
			expect.objectContaining({
				level: "debug",
				event: "request.system_context",
			}),
		);
		expect(log).toHaveBeenCalledWith(
			expect.objectContaining({
				level: "info",
				event: "request.complete",
				data: expect.objectContaining({ toolCalls: 1, hasUsage: true }),
			}),
		);
	});

	it("suppresses debug logs and supports the default logger", async () => {
		const runner = {
			run: vi.fn().mockResolvedValue({
				...runnerResult,
				toolTrace: [],
				usage: undefined,
			}),
		};
		const customLog = vi.fn();
		const deps = {
			settingsRepository: {
				getSystemContextForUser: vi
					.fn()
					.mockResolvedValue({ systemContext: "" }),
			} as never,
			runner: runner as never,
		};
		const quiet = new AgenticSearchService({ ...deps, log: customLog });

		await quiet.run({
			query: "q",
			userId: "user-1",
			topK: 2,
		});
		expect(
			customLog.mock.calls.some(([entry]) => entry.level === "debug"),
		).toBe(false);

		const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const defaultLogger = new AgenticSearchService(deps);
		await defaultLogger.run({
			query: "q",
			userId: "user-1",
			topK: 2,
		});
		(defaultLogger as never as { log: Function }).log("error", "manual.error", {
			reason: "test",
		});
		expect(info).toHaveBeenCalled();
		expect(error).toHaveBeenCalledWith(expect.stringContaining("manual.error"));
		info.mockRestore();
		error.mockRestore();
	});
});
