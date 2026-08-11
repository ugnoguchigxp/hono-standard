import type { Action3dPlayerTuning, Action3dWorld } from "../content";
import type { Action3dState } from "../model";

export const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

export const approach = (current: number, target: number, maxDelta: number) =>
	current < target
		? Math.min(target, current + maxDelta)
		: Math.max(target, current - maxDelta);

export const distanceSquared = (
	a: { x: number; z: number },
	b: { x: number; z: number },
) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export const angleTo = (
	from: { x: number; z: number },
	to: { x: number; z: number },
) => Math.atan2(to.x - from.x, to.z - from.z);

const segmentIntersectsBounds = (
	from: { x: number; z: number },
	to: { x: number; z: number },
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
) => {
	const dx = to.x - from.x;
	const dz = to.z - from.z;
	let near = 0;
	let far = 1;
	for (const [origin, delta, min, max] of [
		[from.x, dx, bounds.minX, bounds.maxX],
		[from.z, dz, bounds.minZ, bounds.maxZ],
	] as const) {
		if (Math.abs(delta) < 0.000_01) {
			if (origin < min || origin > max) return false;
			continue;
		}
		const first = (min - origin) / delta;
		const second = (max - origin) / delta;
		near = Math.max(near, Math.min(first, second));
		far = Math.min(far, Math.max(first, second));
		if (near > far) return false;
	}
	return far >= 0 && near <= 1;
};

export const hasLineOfSight = (
	world: Action3dWorld,
	from: { x: number; z: number },
	to: { x: number; z: number },
) =>
	!world.colliders.some((collider) =>
		segmentIntersectsBounds(from, to, collider.bounds),
	);

export const normalizeMove = (x: number, z: number) => {
	const length = Math.hypot(x, z);
	return length > 1 ? { x: x / length, z: z / length } : { x, z };
};

export const isBlocked = (
	world: Action3dWorld,
	x: number,
	z: number,
	radius: number,
) =>
	x < world.bounds.minX + radius ||
	x > world.bounds.maxX - radius ||
	z < world.bounds.minZ + radius ||
	z > world.bounds.maxZ - radius ||
	world.colliders.some(
		(collider) =>
			x + radius > collider.bounds.minX &&
			x - radius < collider.bounds.maxX &&
			z + radius > collider.bounds.minZ &&
			z - radius < collider.bounds.maxZ,
	);

export const groundAt = (world: Action3dWorld, x: number, z: number) => {
	let result: { height: number; gradient: number } = { height: 0, gradient: 0 };
	for (const surface of world.surfaces) {
		if (
			x < surface.bounds.minX ||
			x > surface.bounds.maxX ||
			z < surface.bounds.minZ ||
			z > surface.bounds.maxZ
		)
			continue;
		const span =
			surface.axis === "x"
				? surface.bounds.maxX - surface.bounds.minX
				: surface.bounds.maxZ - surface.bounds.minZ;
		const offset =
			surface.axis === "x" ? x - surface.bounds.minX : z - surface.bounds.minZ;
		const gradient = (surface.toHeight - surface.fromHeight) / span;
		const height = surface.fromHeight + gradient * offset;
		if (height >= result.height)
			result = { height, gradient: Math.abs(gradient) };
	}
	return result;
};

export const movePlayerWithCollision = (
	state: Action3dState,
	world: Action3dWorld,
	tuning: Action3dPlayerTuning,
	dx: number,
	dz: number,
) => {
	const currentGround = groundAt(
		world,
		state.player.position.x,
		state.player.position.z,
	).height;
	const maxSlopeGradient = Math.tan((tuning.maxSlopeDegrees * Math.PI) / 180);
	const canTraverse = (x: number, z: number) => {
		const ground = groundAt(world, x, z);
		return (
			ground.gradient <= maxSlopeGradient &&
			ground.height - currentGround <= tuning.maxStepHeight
		);
	};
	const nextX = state.player.position.x + dx;
	if (
		!isBlocked(world, nextX, state.player.position.z, tuning.playerRadius) &&
		canTraverse(nextX, state.player.position.z)
	)
		state.player.position.x = nextX;
	const nextZ = state.player.position.z + dz;
	if (
		!isBlocked(world, state.player.position.x, nextZ, tuning.playerRadius) &&
		canTraverse(state.player.position.x, nextZ)
	)
		state.player.position.z = nextZ;
	if (state.player.grounded) {
		const ground = groundAt(
			world,
			state.player.position.x,
			state.player.position.z,
		).height;
		if (ground < currentGround - tuning.maxStepHeight)
			state.player.grounded = false;
		else state.player.position.y = ground;
	}
};

export const pointInsideBounds = (
	point: { x: number; z: number },
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
) =>
	point.x >= bounds.minX &&
	point.x <= bounds.maxX &&
	point.z >= bounds.minZ &&
	point.z <= bounds.maxZ;
