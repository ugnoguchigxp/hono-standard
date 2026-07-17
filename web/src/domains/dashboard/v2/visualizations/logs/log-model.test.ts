import { describe, expect, it } from "vitest";
import { buildLogModel } from "./log-model";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

describe("buildLogModel", () => {
	const defaultConfig = {
		attributeFields: [],
		order: "ascending" as const,
		wrap: true,
		showTimestamp: true,
		showAttributes: false,
		maxMessageCharacters: 100,
	};

	const validFrame: DashboardDataFrameV2 = {
		schemaVersion: 2,
		refId: "A",
		source: { kind: "query", refId: "A" },
		name: "logs",
		fields: [
			{ key: "time", label: "Time", type: "time", values: [1000, 2000], roles: ["time"], labels: {} },
			{ key: "message", label: "Message", type: "string", values: ["hello", "world\nnew line"], roles: ["message"], labels: {} },
		],
		meta: { shapeHint: "logs" },
	};

	it("should parse valid logs frame correctly", () => {
		const result = buildLogModel(validFrame, defaultConfig);
		expect(result.rows).toHaveLength(2);
		expect(result.rows[0]?.message).toBe("hello");
		expect(result.rows[1]?.message).toBe("world\nnew line");
	});

	it("should throw error if time or message field is missing", () => {
		const badFrame = {
			...validFrame,
			fields: [validFrame.fields[1]!], // only message
		};
		expect(() => buildLogModel(badFrame, defaultConfig)).toThrow("logs require time and message fields");
	});

	it("should throw error if log row limit exceeded", () => {
		const tooManyRows: DashboardDataFrameV2 = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" },
			name: "logs",
			fields: [
				{ key: "time", label: "Time", type: "time", values: Array(5001).fill(1000), roles: ["time"], labels: {} },
				{ key: "message", label: "Message", type: "string", values: Array(5001).fill("msg"), roles: ["message"], labels: {} },
			],
			meta: { shapeHint: "logs" },
		};
		expect(() => buildLogModel(tooManyRows, defaultConfig)).toThrow("log row limit exceeded");
	});

	it("should throw error if requested attribute field is missing", () => {
		const config = {
			...defaultConfig,
			attributeFields: ["missing_field"],
		};
		expect(() => buildLogModel(validFrame, config)).toThrow("log attribute field is missing: missing_field");
	});

	it("should throw error if time is invalid", () => {
		const badTimeFrame: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				{ key: "time", label: "Time", type: "time", values: [NaN, 2000], roles: ["time"], labels: {} },
				validFrame.fields[1]!,
			],
		};
		expect(() => buildLogModel(badTimeFrame, defaultConfig)).toThrow("log time must be finite");

		const hugeTimeFrame: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				{ key: "time", label: "Time", type: "time", values: [9e15, 2000], roles: ["time"], labels: {} },
				validFrame.fields[1]!,
			],
		};
		expect(() => buildLogModel(hugeTimeFrame, defaultConfig)).toThrow("log time must be finite");
	});

	it("should throw error if message is not a string", () => {
		const badMsgFrame: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				validFrame.fields[0]!,
				{ key: "message", label: "Message", type: "string", values: [123 as never, "world"], roles: ["message"], labels: {} },
			],
		};
		expect(() => buildLogModel(badMsgFrame, defaultConfig)).toThrow("log message must be a string");
	});

	it("should enforce unique ID if id field is present", () => {
		const idFrame: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				...validFrame.fields,
				{ key: "id", label: "ID", type: "string", values: ["1", "1"], roles: ["id"], labels: {} },
			],
		};
		expect(() => buildLogModel(idFrame, defaultConfig)).toThrow("log IDs must be unique");
	});

	it("should enforce exactly one focal row in context preset", () => {
		const stateFrame: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				...validFrame.fields,
				{ key: "state", label: "State", type: "string", values: ["before", "after"], roles: ["state"], labels: {} },
			],
		};
		expect(() => buildLogModel(stateFrame, defaultConfig, "context")).toThrow(
			"log context must contain exactly one focal row",
		);

		const validStateFrame: DashboardDataFrameV2 = {
			...validFrame,
			fields: [
				...validFrame.fields,
				{ key: "state", label: "State", type: "string", values: ["focal", "after"], roles: ["state"], labels: {} },
			],
		};
		expect(() => buildLogModel(validStateFrame, defaultConfig, "context")).not.toThrow();
	});

	it("should handle wrap=false replacing newlines", () => {
		const config = {
			...defaultConfig,
			wrap: false,
		};
		const result = buildLogModel(validFrame, config);
		expect(result.rows[1]?.message).toBe("world↵new line");
	});

	it("should sort logs descending if configured", () => {
		const config = {
			...defaultConfig,
			order: "descending" as const,
		};
		const result = buildLogModel(validFrame, config);
		expect(result.rows[0]?.time).toBe(2000);
		expect(result.rows[1]?.time).toBe(1000);
	});

	it("should add notice if rows count exceeds 80", () => {
		const manyRowsFrame: DashboardDataFrameV2 = {
			schemaVersion: 2,
			refId: "A",
			source: { kind: "query", refId: "A" },
			name: "logs",
			fields: [
				{ key: "time", label: "Time", type: "time", values: Array(100).fill(1000), roles: ["time"], labels: {} },
				{ key: "message", label: "Message", type: "string", values: Array(100).fill("msg"), roles: ["message"], labels: {} },
			],
			meta: { shapeHint: "logs" },
		};
		const result = buildLogModel(manyRowsFrame, defaultConfig);
		expect(result.notices).toContain("log rows are windowed");
		expect(result.visibleRows).toHaveLength(80);
	});
});
