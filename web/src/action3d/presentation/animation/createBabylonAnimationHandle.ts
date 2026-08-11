import type { Action3dAnimationHandle } from "./Action3dAnimationController";

export type Action3dAnimationGroupLike = {
	name: string;
	from: number;
	to: number;
	onAnimationGroupEndObservable: {
		add(callback: () => void): unknown;
	};
	play(loop?: boolean): unknown;
	stop(skipOnAnimationEnd?: boolean): unknown;
	pause(): unknown;
	goToFrame(frame: number, useWeight?: boolean): unknown;
	setWeightForAllAnimatables(weight: number): unknown;
};

/**
 * Adapts Babylon one-shots to the state-driven animation controller.
 *
 * Babylon removes a completed non-looping group's animatables. Depending on
 * the last weighted binding and render timing, that can expose the rest pose
 * while the logical state still selects the same one-shot. Hold the final
 * frame until the state machine selects another clip. Transition stops use
 * skipOnAnimationEnd so an outgoing clip cannot re-arm itself while blending.
 */
export const createBabylonAnimationHandle = (
	group: Action3dAnimationGroupLike,
): Action3dAnimationHandle => {
	let holdFinalFrame = false;
	group.onAnimationGroupEndObservable.add(() => {
		if (!holdFinalFrame) return;
		holdFinalFrame = false;
		group.play(false);
		group.goToFrame(group.to, true);
		group.pause();
	});

	return {
		name: group.name,
		play: (loop: boolean) => {
			holdFinalFrame = !loop;
			group.play(loop);
		},
		stop: () => {
			holdFinalFrame = false;
			group.stop(true);
		},
		setWeight: (weight: number) => group.setWeightForAllAnimatables(weight),
	};
};
