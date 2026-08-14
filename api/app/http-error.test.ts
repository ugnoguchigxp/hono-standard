import { describe, expect, it } from "vitest";
import { HttpError } from "./http-error";

describe("HttpError", () => {
	it("stores an HTTP status and message", () => {
		const error = new HttpError(400, "Bad Request");
		expect(error.status).toBe(400);
		expect(error.message).toBe("Bad Request");
		expect(error.name).toBe("HttpError");
		expect(error).toBeInstanceOf(Error);
	});
});
