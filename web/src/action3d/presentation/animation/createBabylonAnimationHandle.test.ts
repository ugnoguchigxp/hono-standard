import { describe, expect, it } from "vitest";
import {
	type Action3dAnimationGroupLike,
	createBabylonAnimationHandle,
} from "./createBabylonAnimationHandle";

const group = () => {
	const events: string[] = [];
	const ended: Array<() => void> = [];
	const value: Action3dAnimationGroupLike = {
		name: "Defeated",
		from: 0,
		to: 36,
		onAnimationGroupEndObservable: {
			add: (callback) => ended.push(callback),
		},
		play: (loop) => events.push(`play:${String(loop)}`),
		stop: (skip) => events.push(`stop:${String(skip)}`),
		pause: () => events.push("pause"),
		goToFrame: (frame, useWeight) =>
			events.push(`frame:${frame}:${String(useWeight)}`),
		setWeightForAllAnimatables: (weight) =>
			events.push(`weight:${weight}`),
	};
	return { value, events, end: () => ended.forEach((callback) => callback()) };
};

describe("createBabylonAnimationHandle", () => {
	it("holds the final weighted frame of a completed one-shot", () => {
		const fixture = group();
		const handle = createBabylonAnimationHandle(fixture.value);
		handle.play(false);
		fixture.end();
		expect(fixture.events).toEqual([
			"play:false",
			"play:false",
			"frame:36:true",
			"pause",
		]);
	});

	it("does not freeze a looping clip", () => {
		const fixture = group();
		const handle = createBabylonAnimationHandle(fixture.value);
		handle.play(true);
		fixture.end();
		expect(fixture.events).toEqual(["play:true"]);
	});

	it("suppresses end callbacks while stopping an outgoing one-shot", () => {
		const fixture = group();
		const handle = createBabylonAnimationHandle(fixture.value);
		handle.play(false);
		handle.stop();
		fixture.end();
		expect(fixture.events).toEqual(["play:false", "stop:true"]);
	});
});
