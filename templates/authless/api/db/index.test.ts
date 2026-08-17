import { describe, expect, it } from "vitest";
import type { AppEnv } from "../app/env";
import { createDbRuntime, schema } from "./index";

describe("createDbRuntime", () => {
	it("initializes the authless in-memory libSQL runtime", async () => {
		const runtime = await createDbRuntime({ databaseUrl: ":memory:" } as AppEnv);

		expect(Object.keys(schema)).toEqual([]);
		await runtime.close();
	});
});
