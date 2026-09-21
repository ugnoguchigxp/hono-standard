export type ModulatorState = {
	reward: number;
	threat: number;
	novelty: number;
	arousal: number;
};
export const initialModulatorState = (): ModulatorState => ({
	reward: 0,
	threat: 0,
	novelty: 0,
	arousal: 0,
});
