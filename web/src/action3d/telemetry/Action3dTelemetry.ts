export type Action3dTelemetryEventName =
	| "action3d_session_started"
	| "action3d_world_entered"
	| "action3d_combat_started"
	| "action3d_combat_completed"
	| "action3d_player_defeated"
	| "action3d_checkpoint_saved"
	| "action3d_save_conflict"
	| "action3d_content_load_failed"
	| "action3d_asset_fallback_used"
	| "action3d_runtime_interrupted"
	| "action3d_performance_degraded";

export type Action3dTelemetryProperties = Partial<{
	contentVersion: string;
	worldId: string;
	enemyArchetypeId: string;
	attackId: string;
	durationBucket: string;
	deviceClass: "compact" | "desktop";
	errorCode: string;
	source: "server" | "local";
}>;
export type Action3dTelemetryEvent = {
	name: Action3dTelemetryEventName;
	properties: Action3dTelemetryProperties;
	capturedAt: string;
	sessionId: string;
};
export interface Action3dTelemetry {
	capture(
		name: Action3dTelemetryEventName,
		properties?: Action3dTelemetryProperties,
	): void;
}

export class NoopAction3dTelemetry implements Action3dTelemetry {
	capture(): void {}
}

/**
 * Privacy-bounded browser adapter. It emits semantic events for an optional
 * provider bridge and keeps a small in-memory diagnostic buffer.
 */
export class BufferedBrowserAction3dTelemetry implements Action3dTelemetry {
	readonly events: Action3dTelemetryEvent[] = [];
	private readonly sessionId = crypto.randomUUID();
	constructor(private readonly target: EventTarget = window) {}
	capture(
		name: Action3dTelemetryEventName,
		properties: Action3dTelemetryProperties = {},
	): void {
		try {
			const event = {
				name,
				properties: { ...properties },
				capturedAt: new Date().toISOString(),
				sessionId: this.sessionId,
			} satisfies Action3dTelemetryEvent;
			this.events.push(event);
			if (this.events.length > 100) this.events.shift();
			this.target.dispatchEvent(
				new CustomEvent("action3d:telemetry", { detail: event }),
			);
		} catch {
			// Observability must never interrupt gameplay or saving.
		}
	}
}
