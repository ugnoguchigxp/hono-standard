export type AssetLoadError = {
	code: "asset";
	assetId: string;
	retryable: boolean;
	message: string;
};

export type ContentRuntimeError = {
	code: "content";
	retryable: boolean;
	message: string;
};

export type GameRuntimeError = AssetLoadError | ContentRuntimeError;
