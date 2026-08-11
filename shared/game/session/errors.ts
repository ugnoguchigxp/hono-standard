export type GameSessionErrorCode =
	| "invalid-command"
	| "invalid-content-reference"
	| "incompatible-content"
	| "invalid-state";

export class GameSessionError extends Error {
	readonly code: GameSessionErrorCode;

	constructor(code: GameSessionErrorCode, message: string) {
		super(message);
		this.name = "GameSessionError";
		this.code = code;
	}
}

export type GameSessionListenerErrorContext = {
	sessionId: string;
	sequence: number;
	stateRevision: number;
};

export type GameSessionListenerErrorSink = (
	error: unknown,
	context: GameSessionListenerErrorContext,
) => void;
