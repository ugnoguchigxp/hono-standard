import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("database schema", () => {
	it("starts without application tables", () => {
		expect(Object.keys(schema)).toEqual([]);
	});
});
