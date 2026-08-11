import type {
	Action3dEvent,
	Action3dSession,
	Action3dState,
} from "@shared/action3d";

export type Action3dRuntimeStats = {
	fps: number;
	activeMeshes: number;
	drawCalls: number;
};
export type Action3dRuntimeSnapshot = {
	state: Action3dState;
	stats: Action3dRuntimeStats;
	pointerLocked: boolean;
};
export type Action3dRuntimeError = {
	code: "webgl-unsupported" | "context-lost" | "asset-load" | "startup";
	message: string;
	recoverable: boolean;
};
export type Action3dRuntimeOptions = {
	generation: number;
	session: Action3dSession;
	onSnapshot: (snapshot: Action3dRuntimeSnapshot) => void;
	onEvent: (event: Action3dEvent) => void;
	onCheckpoint: (state: Action3dState) => void;
	onWarning: (warning: Action3dRuntimeError) => void;
	onError: (error: Action3dRuntimeError) => void;
};
