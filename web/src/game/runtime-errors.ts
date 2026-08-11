export type AssetLoadError = {
	code: "asset";
	assetId: string;
	retryable: boolean;
	message: string;
};

export type GameRuntimeError = AssetLoadError;
