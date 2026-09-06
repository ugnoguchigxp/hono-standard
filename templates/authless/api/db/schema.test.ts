import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("database schema", () => {
	it("retains the pgvector document table without auth tables", () => {
		expect(schema.documents).toBeDefined();
		expect("users" in schema).toBe(false);
	});
});
