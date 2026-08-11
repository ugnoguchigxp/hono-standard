import type { Action3dAsset } from "@shared/action3d";

export type Action3dAnimationHandle = {
	name: string;
	play(loop: boolean): void;
	stop(): void;
	setWeight(weight: number): void;
};

type ModelAsset = Extract<Action3dAsset, { type: "model" }>;
type ActiveClip = {
	id: string;
	key: string;
	handle: Action3dAnimationHandle;
};

export class Action3dAnimationController {
	private current: ActiveClip | null = null;
	private outgoing: ActiveClip | null = null;
	private blendElapsedMs = 0;
	private disposed = false;

	constructor(
		private readonly clips: ReadonlyMap<
			string,
			ModelAsset["model"]["clips"][number]
		>,
		private readonly handles: ReadonlyMap<string, Action3dAnimationHandle>,
		private readonly blendDurationMs = 120,
	) {}

	select(id: string, revision = id): boolean {
		if (this.disposed) return false;
		const clip = this.clips.get(id);
		if (!clip) throw new Error(`Unknown Action3D animation clip '${id}'.`);
		const handle = this.handles.get(clip.name);
		if (!handle)
			throw new Error(
				`Action3D animation group '${clip.name}' is missing for '${id}'.`,
			);
		const key = `${id}:${revision}`;
		if (this.current?.key === key) return false;

		this.outgoing?.handle.stop();
		if (this.current?.handle === handle) {
			this.current.handle.stop();
			this.outgoing = null;
		} else this.outgoing = this.current;
		this.current = { id, key, handle };
		this.blendElapsedMs = 0;
		handle.play(clip.loop);
		handle.setWeight(this.outgoing ? 0 : 1);
		if (this.outgoing && this.blendDurationMs <= 0) this.finishBlend();
		return true;
	}

	update(deltaMs: number): void {
		if (this.disposed || !this.current || !this.outgoing) return;
		this.blendElapsedMs += Math.max(0, deltaMs);
		const progress = Math.min(1, this.blendElapsedMs / this.blendDurationMs);
		this.current.handle.setWeight(progress);
		this.outgoing.handle.setWeight(1 - progress);
		if (progress >= 1) this.finishBlend();
	}

	get activeId() {
		return this.current?.id ?? null;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.current?.handle.stop();
		this.outgoing?.handle.stop();
		this.current = null;
		this.outgoing = null;
	}

	private finishBlend(): void {
		this.current?.handle.setWeight(1);
		this.outgoing?.handle.setWeight(0);
		this.outgoing?.handle.stop();
		this.outgoing = null;
	}
}

export const createAction3dAnimationController = (
	asset: ModelAsset,
	handles: readonly Action3dAnimationHandle[],
	blendDurationMs = 120,
) =>
	new Action3dAnimationController(
		new Map(asset.model.clips.map((clip) => [clip.id, clip])),
		new Map(handles.map((handle) => [handle.name, handle])),
		blendDurationMs,
	);
