import type { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Action3dState, Action3dWorld } from "@shared/action3d";

const cameraCollisionRatio = (
	from: { x: number; z: number },
	to: { x: number; z: number },
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
) => {
	const padding = 0.35;
	const dx = to.x - from.x;
	const dz = to.z - from.z;
	let near = 0;
	let far = 1;
	for (const [origin, delta, min, max] of [
		[from.x, dx, bounds.minX - padding, bounds.maxX + padding],
		[from.z, dz, bounds.minZ - padding, bounds.maxZ + padding],
	] as const) {
		if (Math.abs(delta) < 0.000_01) {
			if (origin < min || origin > max) return null;
			continue;
		}
		const first = (min - origin) / delta;
		const second = (max - origin) / delta;
		near = Math.max(near, Math.min(first, second));
		far = Math.min(far, Math.max(first, second));
		if (near > far) return null;
	}
	return near >= 0 && near <= 1 ? near : null;
};

export const syncBabylonCamera = (
	camera: FreeCamera,
	state: Action3dState,
	world: Action3dWorld,
	cameraYaw: number,
	cameraPitch: number,
	shakeMs: number,
	reduceMotion: boolean,
): void => {
	const target = new Vector3(
		state.player.position.x,
		state.player.position.y + 1.25,
		state.player.position.z,
	);
	const horizontal = Math.cos(cameraPitch) * 6.5;
	let desired = new Vector3(
		target.x - Math.sin(cameraYaw) * horizontal,
		target.y + 2.2 - Math.sin(cameraPitch) * 4,
		target.z - Math.cos(cameraYaw) * horizontal,
	);
	desired.x = Math.min(
		world.bounds.maxX - 0.2,
		Math.max(world.bounds.minX + 0.2, desired.x),
	);
	desired.z = Math.min(
		world.bounds.maxZ - 0.2,
		Math.max(world.bounds.minZ + 0.2, desired.z),
	);
	let collisionRatio = 1;
	for (const collider of world.colliders) {
		const ratio = cameraCollisionRatio(target, desired, collider.bounds);
		if (ratio !== null) collisionRatio = Math.min(collisionRatio, ratio);
	}
	if (collisionRatio < 1)
		desired = Vector3.Lerp(
			target,
			desired,
			Math.max(0.08, collisionRatio - 0.04),
		);
	if (shakeMs > 0 && !reduceMotion) {
		const strength = (shakeMs / 220) * 0.09;
		desired.x += (Math.random() - 0.5) * strength;
		desired.y += (Math.random() - 0.5) * strength;
	}
	camera.position = Vector3.Lerp(camera.position, desired, 0.16);
	camera.setTarget(target);
};
