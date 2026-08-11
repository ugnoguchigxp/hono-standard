import { describe, expect, it } from "vitest";
import { requiresSessionCheck } from "./route-access";

describe("route access", () => {
	it("requires session checks only for login and authenticated route boundaries", () => {
		expect(requiresSessionCheck("/")).toBe(false);
		expect(requiresSessionCheck("/showcase")).toBe(false);
		expect(requiresSessionCheck("/login")).toBe(true);
		expect(requiresSessionCheck("/protected")).toBe(true);
		expect(requiresSessionCheck("/protected/settings")).toBe(true);
		expect(requiresSessionCheck("/protectedness")).toBe(false);
		expect(requiresSessionCheck("/game")).toBe(true);
		expect(requiresSessionCheck("/game/settings")).toBe(true);
		expect(requiresSessionCheck("/games")).toBe(false);
		expect(requiresSessionCheck("/games/action-3d")).toBe(true);
		expect(requiresSessionCheck("/games/action-3d/settings")).toBe(true);
		expect(requiresSessionCheck("/games/action-3dness")).toBe(false);
	});
});
