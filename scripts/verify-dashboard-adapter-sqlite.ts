import { Database } from "bun:sqlite";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { defineDrizzleRecordQueryV2 } from "../api/modules/dashboard/v2/adapters/drizzle-query";
import type { DashboardQueryHandlerContextV2 } from "../api/modules/dashboard/v2/types";

const orders = sqliteTable("orders", {
	id: integer("id").primaryKey(),
	status: text("status").notNull(),
	amount: integer("amount").notNull(),
});

const directory = await mkdtemp(path.join(tmpdir(), "dashboard-adapter-"));
const databasePath = path.join(directory, "adapter.sqlite");
let reader: Database | undefined;

try {
	const writer = new Database(databasePath, { create: true });
	writer.run(
		"CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL, amount INTEGER NOT NULL)",
	);
	writer.run(
		"INSERT INTO orders (status, amount) VALUES ('ok', 10), ('ok', 15), ('failed', 3)",
	);
	writer.close();

	reader = new Database(databasePath, { readonly: true });
	const readDatabase = drizzle(reader);
	const query = defineDrizzleRecordQueryV2({
		id: "orders",
		filterKeys: [],
		database: readDatabase,
		frameName: "Orders",
		columns: [
			{ source: "status", type: "string" },
			{ source: "amount", type: "number" },
		],
		select: (database) =>
			database
				.select({ status: orders.status, amount: orders.amount })
				.from(orders)
				.orderBy(orders.id),
	});
	const context: DashboardQueryHandlerContextV2 = {
		requestId: "sqlite-integration",
		requestTime: new Date("2026-07-18T00:00:00.000Z"),
		dashboardId: "dashboard",
		panelId: "panel",
		queryId: "orders",
		queryRefId: "A",
		outputFrameRefs: ["A"],
		range: { kind: "relative", value: "1h" },
		resolvedRange: {
			from: new Date("2026-07-17T23:00:00.000Z"),
			to: new Date("2026-07-18T00:00:00.000Z"),
		},
		timezone: "UTC",
		filters: {},
		maxDataPoints: 100,
		maxRows: 10,
		auth: { userId: "user", email: "user@example.com", role: "member" },
		signal: new AbortController().signal,
	};
	const result = await query.handler(context);
	assert.deepEqual(
		result.frames[0]?.fields.map((field) => field.values),
		[
			["ok", "ok", "failed"],
			[10, 15, 3],
		],
	);
	console.log("Dashboard adapter read-only SQLite integration gate passed");
} finally {
	reader?.close();
	await rm(directory, { recursive: true });
}
