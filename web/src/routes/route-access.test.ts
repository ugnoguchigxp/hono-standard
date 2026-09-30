import { describe, expect, it } from "vitest";
import { requiresSessionCheck } from "./route-access";

describe("route access", () => {
	it("requires session checks for login, protected, and pages", () => {
		expect(requiresSessionCheck("/")).toBe(false);
		expect(requiresSessionCheck("/showcase")).toBe(false);
		expect(requiresSessionCheck("/login")).toBe(true);
		expect(requiresSessionCheck("/protected")).toBe(true);
		expect(requiresSessionCheck("/protected/settings")).toBe(true);
		expect(requiresSessionCheck("/protectedness")).toBe(false);
		expect(requiresSessionCheck("/pages")).toBe(true);
		expect(requiresSessionCheck("/pages/page-id")).toBe(true);
		expect(requiresSessionCheck("/pagesomething")).toBe(false);
	});
});
