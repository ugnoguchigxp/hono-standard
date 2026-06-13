import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentsRoute } from "./documents.route";

const dbMocks = vi.hoisted(() => {
	const returning = vi.fn();
	const values = vi.fn().mockReturnValue({ returning });
	const limit = vi.fn();
	const orderBy = vi.fn().mockReturnValue({ limit });
	const from = vi.fn().mockReturnValue({ orderBy });

	return {
		insert: vi.fn().mockReturnValue({ values }),
		select: vi.fn().mockReturnValue({ from }),
		values,
		returning,
		from,
		orderBy,
		limit,
	};
});

function createTestApp() {
	const app = new Hono();
	app.route(
		"/documents",
		createDocumentsRoute({
			db: {
				insert: dbMocks.insert,
				select: dbMocks.select,
			} as never,
		}),
	);
	return app;
}

describe("documents route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		dbMocks.returning.mockReset();
		dbMocks.limit.mockReset();
	});

	it("inserts a document vector", async () => {
		const mockDoc = {
			id: "a57ba8d8-21cc-4cb5-8d5c-dcf5d8521a00",
			content: "Apple",
		};
		dbMocks.returning.mockResolvedValueOnce([mockDoc]);

		const res = await createTestApp().request("/documents", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				content: "Apple",
				embedding: [1, 0, 0],
			}),
		});

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual(mockDoc);
		expect(dbMocks.insert).toHaveBeenCalled();
		expect(dbMocks.values).toHaveBeenCalledWith({
			content: "Apple",
			embedding: [1, 0, 0],
		});
	});

	it("returns vector search results", async () => {
		const mockResults = [
			{
				id: "a57ba8d8-21cc-4cb5-8d5c-dcf5d8521a00",
				content: "Apple",
				similarity: 0.99,
			},
		];
		dbMocks.limit.mockResolvedValueOnce(mockResults);

		const res = await createTestApp().request("/documents/search", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				embedding: [1, 0, 0],
				limit: 3,
			}),
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(mockResults);
		expect(dbMocks.select).toHaveBeenCalled();
		expect(dbMocks.from).toHaveBeenCalled();
		expect(dbMocks.orderBy).toHaveBeenCalled();
		expect(dbMocks.limit).toHaveBeenCalledWith(3);
	});
});
