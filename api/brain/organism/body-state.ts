export type BodyState = {
	energy: number;
	hunger: number;
	fatigue: number;
	matingDrive: number;
	alive: boolean;
};
export const bodySetpoint = Object.freeze({
	energy: 0.8,
	hunger: 0.2,
	fatigue: 0.2,
	matingDrive: 0.1,
});
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export function createBody(overrides: Partial<BodyState> = {}): BodyState {
	return {
		energy: 0.65,
		hunger: 0.6,
		fatigue: 0.2,
		matingDrive: 0.1,
		alive: true,
		...overrides,
	};
}
export function homeostaticError(body: BodyState): number {
	return (
		(Math.abs(body.energy - bodySetpoint.energy) +
			Math.abs(body.hunger - bodySetpoint.hunger) +
			Math.abs(body.fatigue - bodySetpoint.fatigue) +
			Math.abs(body.matingDrive - bodySetpoint.matingDrive)) /
		4
	);
}
