import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
	AdditiveBlending,
	BufferGeometry,
	CanvasTexture,
	Float32BufferAttribute,
	type Group,
} from "three";
import type { EntitySymbol } from "./scene-model";

type Shape =
	| EntitySymbol
	| "harness"
	| "laptop"
	| "thermometer"
	| "processor"
	| "stage"
	| "task-particle"
	| "finding"
	| "covering"
	| "finalize"
	| "review-queue"
	| "knowledge-queue";

function hash(value: number) {
	const x = Math.sin(value * 127.1 + 78.233) * 43758.5453;
	return x - Math.floor(x);
}

let glowTexture: CanvasTexture | null = null;

function particleGlowTexture() {
	if (glowTexture) return glowTexture;
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Could not create particle glow texture");
	const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
	gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
	gradient.addColorStop(0.18, "rgba(255, 255, 255, 0.65)");
	gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.15)");
	gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
	context.fillStyle = gradient;
	context.fillRect(0, 0, 64, 64);
	glowTexture = new CanvasTexture(canvas);
	return glowTexture;
}

function line(
	from: [number, number, number],
	to: [number, number, number],
	t: number,
): [number, number, number] {
	return from.map((value, axis) => value + (to[axis] - value) * t) as [
		number,
		number,
		number,
	];
}

function particlePosition(
	shape: Shape,
	index: number,
): [number, number, number] {
	const a = hash(index * 3 + 1) * Math.PI * 2;
	const b = hash(index * 3 + 2) * 2 - 1;
	const c = hash(index * 3 + 3);
	const r = 0.43 + (c - 0.5) * 0.045;
	switch (shape) {
		case "processor": {
			const edge = index % 4;
			const x = edge < 2 ? (edge ? 0.31 : -0.31) : b * 0.31;
			const z = edge < 2 ? b * 0.31 : edge === 2 ? -0.31 : 0.31;
			const rotation = Math.PI / 4;
			return [
				x * Math.cos(rotation) + z * Math.sin(rotation),
				index % 5 === 0 ? 0.04 : (c - 0.5) * 0.05,
				-x * Math.sin(rotation) + z * Math.cos(rotation),
			];
		}
		case "thermometer": {
			const part = index % 5;
			if (part === 0)
				return [
					Math.cos(a) * 0.115,
					-0.34 + Math.sin(a) * 0.115,
					0.04 + b * 0.03,
				];
			if (part === 1 || part === 2)
				return [
					Math.cos(a) * 0.055,
					-0.02 + b * 0.295,
					0.02 + Math.sin(a) * 0.055,
				];
			if (part === 3)
				return [index % 2 ? -0.145 : 0.145, -0.4 + c * 0.83, -0.08];
			return [0.09 + c * 0.08, [0.22, 0.1, -0.02, -0.14][index % 4] ?? 0, 0.04];
		}
		case "laptop": {
			const edge = index % 8;
			let x: number;
			let y: number;
			let z: number;
			if (edge < 4) {
				x = edge < 2 ? (edge ? 0.41 : -0.41) : (c - 0.5) * 0.82;
				y = edge < 2 ? -0.05 + b * 0.26 : edge === 2 ? -0.31 : 0.21;
				z = -0.22 - (y + 0.31) * 0.16;
			} else {
				x = edge < 6 ? (c - 0.5) * 0.86 : edge === 6 ? -0.43 : 0.43;
				y = -0.34;
				z = edge < 6 ? (edge === 4 ? -0.22 : 0.35) : -0.22 + c * 0.57;
			}
			const rotation = -Math.PI / 5;
			return [
				x * Math.cos(rotation) + z * Math.sin(rotation),
				y,
				-x * Math.sin(rotation) + z * Math.cos(rotation),
			];
		}
		case "harness": {
			if (index % 4 === 0)
				return [-0.3 + Math.cos(a) * 0.16, 0.25 + Math.sin(a) * 0.16, b * 0.03];
			if (index % 4 === 1)
				return line([-0.17, 0.16, 0], [-0.03, -0.06, 0.03], c);
			if (index % 4 === 2)
				return line([-0.03, -0.06, 0.03], [0.17, -0.2, 0.06], c);
			return line([0.17, -0.2, 0.06], [0.36, -0.28, 0], c);
		}
		case "computer": {
			const edge = index % 4;
			return edge < 2
				? [edge ? 0.48 : -0.48, b * 0.34 + 0.08, (c - 0.5) * 0.08]
				: [(c - 0.5) * 0.96, edge === 2 ? -0.26 : 0.42, b * 0.08];
		}
		case "brain": {
			const side = index % 2 ? 1 : -1;
			const lobe = index % 4 < 2 ? 0.16 : -0.16;
			const z = Math.sqrt(Math.max(0, 1 - b * b));
			return [
				side * 0.23 + Math.cos(a) * z * 0.3,
				lobe + b * 0.26,
				Math.sin(a) * z * 0.3,
			];
		}
		case "network": {
			const node = index % 6;
			const angle = (node / 6) * Math.PI * 2;
			const end: [number, number, number] = [
				Math.cos(angle) * 0.7,
				node % 2 ? -0.26 : 0.26,
				Math.sin(angle) * 0.36,
			];
			return line(index % 4 === 0 ? end : [0, 0, 0], end, c);
		}
		case "backchannel": {
			const side = index % 2 ? 1 : -1;
			return [
				side * (0.27 + 0.31 * c),
				Math.sin(c * Math.PI) * 0.32 * side,
				Math.cos(a) * 0.14,
			];
		}
		case "world": {
			const z = Math.sqrt(Math.max(0, 1 - b * b));
			return [Math.cos(a) * z * r, b * r, Math.sin(a) * z * r];
		}
		case "orchestrator": {
			const arm = index % 3;
			const angle = a + (arm * Math.PI) / 3;
			return [
				Math.cos(angle) * (0.22 + c * 0.43),
				Math.sin(angle) * (0.22 + c * 0.43),
				b * 0.18,
			];
		}
		case "server": {
			const level = ((index % 3) - 1) * 0.29;
			const edge = index % 4;
			return edge < 2
				? [edge ? 0.43 : -0.43, level + b * 0.09, (c - 0.5) * 0.48]
				: [(c - 0.5) * 0.86, level + b * 0.09, edge === 2 ? -0.24 : 0.24];
		}
		case "database": {
			const level = ((index % 3) - 1) * 0.26;
			return [Math.cos(a) * 0.43, level + b * 0.055, Math.sin(a) * 0.24];
		}
		case "service": {
			const face = index % 6;
			const start = (face * Math.PI) / 3;
			return line(
				[Math.cos(start) * 0.46, Math.sin(start) * 0.46, b * 0.12],
				[
					Math.cos(start + Math.PI / 3) * 0.46,
					Math.sin(start + Math.PI / 3) * 0.46,
					b * 0.12,
				],
				c,
			);
		}
		case "gear": {
			const teeth = Math.round(a / (Math.PI / 4));
			const radius = index % 4 === 0 ? 0.56 : 0.37;
			const angle = index % 4 === 0 ? (teeth * Math.PI) / 4 : a;
			return [Math.cos(angle) * radius, b * 0.075, Math.sin(angle) * radius];
		}
		case "pipeline": {
			const step = index % 3;
			return [
				step * 0.42 - 0.42 + Math.cos(a) * 0.14,
				Math.sin(a) * 0.23,
				b * 0.14,
			];
		}
		case "gateway": {
			if (index % 3 === 0)
				return [(index % 2 ? 1 : -1) * 0.43, b * 0.53, c * 0.12];
			return [(c - 0.5) * 0.86, 0.53, b * 0.12];
		}
		case "search": {
			if (index % 4 === 0) return line([0.21, -0.21, 0], [0.7, -0.7, 0], c);
			return [Math.cos(a) * 0.36 - 0.1, Math.sin(a) * 0.36 + 0.1, b * 0.07];
		}
		case "recall": {
			const angle = c * Math.PI * 4;
			return [
				Math.cos(angle) * (0.08 + c * 0.48),
				Math.sin(angle) * (0.08 + c * 0.48),
				b * 0.08,
			];
		}
		case "embedding": {
			const row = index % 4;
			const column = Math.floor(index / 4) % 4;
			return [column * 0.25 - 0.375, row * 0.25 - 0.375, b * 0.1];
		}
		case "stage":
			return [Math.cos(a) * r, Math.sin(a) * r, b * 0.1];
		case "finding": {
			if (index % 5 === 0) return line([0.22, -0.22, 0], [0.65, -0.65, 0], c);
			return [Math.cos(a) * 0.36 - 0.12, Math.sin(a) * 0.36 + 0.12, b * 0.06];
		}
		case "covering": {
			const level = ((index % 3) - 1) * 0.22;
			return [(c - 0.5) * 0.82, level + b * 0.035, (index % 2 ? 1 : -1) * 0.27];
		}
		case "finalize": {
			return index % 2
				? line([-0.5, -0.05, 0], [-0.12, -0.38, 0], c)
				: line([-0.12, -0.38, 0], [0.58, 0.46, 0], c);
		}
		case "review-queue":
			return [
				Math.cos(a) * (0.35 + c * 0.2),
				b * 0.09,
				Math.sin(a) * (0.35 + c * 0.2),
			];
		case "knowledge-queue": {
			const level = ((index % 3) - 1) * 0.23;
			return [(c - 0.5) * 0.75, level, (index % 2 ? 1 : -1) * 0.27];
		}
		case "microphone": {
			if (index % 5 === 0) return [b * 0.34, -0.56, 0];
			return [Math.cos(a) * 0.19, b * 0.45, Math.sin(a) * 0.18];
		}
		case "speaker": {
			if (index % 4 === 0)
				return [0.36 + c * 0.34, Math.sin(a) * (0.24 + c * 0.18), b * 0.08];
			return [
				c * 0.53 - 0.35,
				Math.sin(a) * (0.12 + c * 0.29),
				Math.cos(a) * (0.12 + c * 0.29),
			];
		}
		case "task":
		case "task-particle": {
			const t = c;
			return [
				((index % 3) - 1) * t * 0.3 + (hash(index + 40) - 0.5) * 0.035,
				(1 - t) * 0.34 - 0.17,
				b * t * 0.24,
			];
		}
	}
}

export function ParticleSymbol({
	shape,
	color,
	size = 1,
	selected = false,
	emphasized = false,
	active = false,
}: {
	shape: Shape;
	color: string;
	size?: number;
	selected?: boolean;
	emphasized?: boolean;
	active?: boolean;
}) {
	const group = useRef<Group>(null);
	const glowMap = useMemo(particleGlowTexture, []);
	const contextStill =
		emphasized ||
		shape === "recall" ||
		shape === "search" ||
		shape === "finding" ||
		shape === "covering" ||
		shape === "finalize" ||
		shape === "review-queue" ||
		shape === "knowledge-queue" ||
		shape === "stage";
	const geometry = useMemo(() => {
		const positions: number[] = [];
		for (let i = 0; i < (contextStill ? 760 : 440); i++)
			positions.push(...particlePosition(shape, i));
		const result = new BufferGeometry();
		result.setAttribute("position", new Float32BufferAttribute(positions, 3));
		return result;
	}, [shape, contextStill]);
	const fieldGeometry = useMemo(() => {
		const positions: number[] = [];
		for (let i = 0; i < (contextStill ? 1050 : 650); i++) {
			const [x, y, z] = particlePosition(shape, i + 1000);
			const spread = 1.25 + hash(i * 7 + 37) * 0.9;
			const drift = hash(i * 11 + 83) - 0.5;
			positions.push(
				x * spread + drift * 0.24,
				y * spread + (hash(i * 13 + 91) - 0.5) * 0.27,
				z * spread + (hash(i * 17 + 19) - 0.5) * 0.3,
			);
		}
		const result = new BufferGeometry();
		result.setAttribute("position", new Float32BufferAttribute(positions, 3));
		return result;
	}, [shape, contextStill]);
	const galaxyGeometry = useMemo(() => {
		const positions: number[] = [];
		for (let index = 0; index < (contextStill ? 2300 : 1300); index++) {
			const [sourceX, sourceY] = particlePosition(shape, index + 2400);
			const radius = 0.42 + hash(index * 5 + 71) * 1.1;
			const arm = (index % 3) * ((Math.PI * 2) / 3);
			const angle = arm + radius * 1.8 + (hash(index * 5 + 83) - 0.5) * 0.8;
			positions.push(
				Math.cos(angle) * radius + sourceX * 0.18,
				Math.sin(angle) * radius * 0.72 + sourceY * 0.18,
				(hash(index * 5 + 109) - 0.5) * (0.55 + radius * 0.48),
			);
		}
		const result = new BufferGeometry();
		result.setAttribute("position", new Float32BufferAttribute(positions, 3));
		return result;
	}, [shape, contextStill]);
	useFrame(({ clock }) => {
		if (!group.current) return;
		group.current.rotation.y = Math.sin(clock.elapsedTime * 0.23) * 0.12;
		group.current.scale.setScalar(
			size * (1 + Math.sin(clock.elapsedTime * 1.5) * 0.025),
		);
	});
	return (
		<group ref={group} scale={size}>
			<points geometry={galaxyGeometry} raycast={() => {}}>
				<pointsMaterial
					color={color}
					map={glowMap}
					size={0.23}
					sizeAttenuation
					transparent
					opacity={contextStill ? 0.34 : 0.27}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</points>
			<points geometry={galaxyGeometry} raycast={() => {}}>
				<pointsMaterial
					color={color}
					size={0.05}
					sizeAttenuation
					transparent
					opacity={contextStill ? 0.32 : 0.25}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</points>
			<points geometry={fieldGeometry} raycast={() => {}}>
				<pointsMaterial
					color={color}
					size={selected ? 0.048 : 0.025}
					sizeAttenuation
					transparent
					opacity={selected ? 0.82 : 0.36}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</points>
			<points geometry={geometry}>
				<pointsMaterial
					color={color}
					map={glowMap}
					size={0.38}
					sizeAttenuation
					transparent
					opacity={active ? 0.85 : 0.5}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</points>
			<points geometry={geometry}>
				<pointsMaterial
					color={color}
					size={selected ? 0.12 : active ? 0.085 : 0.054}
					sizeAttenuation
					transparent
					opacity={selected ? 0.42 : active ? 0.32 : 0.17}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</points>
			<points geometry={geometry}>
				<pointsMaterial
					color={color}
					size={selected ? 0.032 : 0.016}
					sizeAttenuation
					transparent
					opacity={selected ? 1 : 0.9}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</points>
		</group>
	);
}
