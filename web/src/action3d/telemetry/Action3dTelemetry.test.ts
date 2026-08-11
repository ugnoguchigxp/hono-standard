import { describe, expect, it } from "vitest";
import {
	BufferedBrowserAction3dTelemetry,
	NoopAction3dTelemetry,
} from "./Action3dTelemetry";

describe("Action3dTelemetry", () => {
	it("buffers only typed semantic properties and emits a browser event", () => {
		const emitted: Event[] = [];
		const target = { dispatchEvent: (event: Event) => (emitted.push(event), true) } as EventTarget;
		const telemetry = new BufferedBrowserAction3dTelemetry(target);
		telemetry.capture("action3d_world_entered", {
			contentVersion: "action3d-field-lab-1",
			worldId: "aether-causeway",
			deviceClass: "desktop",
		});
		expect(telemetry.events).toHaveLength(1);
		expect(telemetry.events[0]).toMatchObject({
			name: "action3d_world_entered",
			properties: { worldId: "aether-causeway" },
		});
		expect(emitted).toHaveLength(1);
	});

	it("never lets an adapter failure interrupt gameplay", () => {
		const target = { dispatchEvent: () => { throw new Error("blocked"); } } as unknown as EventTarget;
		const telemetry = new BufferedBrowserAction3dTelemetry(target);
		expect(() => telemetry.capture("action3d_session_started")).not.toThrow();
		expect(() => new NoopAction3dTelemetry().capture()).not.toThrow();
	});
});
