import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
	AdditiveBlending,
	BufferGeometry,
	Float32BufferAttribute,
	type Group,
} from "three";

function geometry(points: number[]) {
	const result = new BufferGeometry();
	result.setAttribute("position", new Float32BufferAttribute(points, 3));
	return result;
}

function hash(index: number) {
	const value = Math.sin(index * 127.1 + 78.233) * 43758.5453;
	return value - Math.floor(value);
}

export function UniverseField() {
	const orbit = useRef<Group>(null);
	const { arcs, flecks, ticks } = useMemo(() => {
		const arcs: number[] = [];
		const flecks: number[] = [];
		const ticks: number[] = [];
		const rings = [
			{ radius: 1.65, tilt: Math.PI / 6, node: -0.25, phase: 0.2 },
			{ radius: 2.65, tilt: -Math.PI / 6, node: 0.15, phase: 1.1 },
			{ radius: 3.5, tilt: 0, node: 0, phase: 2.1 },
			{ radius: 3.25, tilt: Math.PI / 3, node: 0.25, phase: 0.75 },
		];
		for (const [ringIndex, ring] of rings.entries()) {
			const point = (angle: number, radius = ring.radius) => {
				const flatX = Math.cos(angle) * radius;
				const flatZ = Math.sin(angle) * radius;
				const tiltedZ = flatZ * Math.cos(ring.tilt);
				return [
					flatX * Math.cos(ring.node) + tiltedZ * Math.sin(ring.node),
					-flatZ * Math.sin(ring.tilt),
					-flatX * Math.sin(ring.node) + tiltedZ * Math.cos(ring.node),
				];
			};
			for (let index = 0; index < 180; index++) {
				if (hash(index + ringIndex * 211) < 0.28) continue;
				const angle = (index / 180) * Math.PI * 2 + ring.phase;
				arcs.push(...point(angle), ...point(angle + Math.PI / 90));
			}
			for (let index = 0; index < 36; index++) {
				if (hash(index * 3 + ringIndex * 47) < 0.4) continue;
				const angle = (index / 36) * Math.PI * 2 + ring.phase;
				ticks.push(
					...point(angle, ring.radius - 0.055),
					...point(angle, ring.radius + 0.055),
				);
			}
		}
		for (let index = 0; index < 520; index++) {
			const longitude = hash(index * 3 + 1) * Math.PI * 2;
			const latitude = Math.acos(hash(index * 3 + 2) * 2 - 1);
			const radius = 2.55 + hash(index * 3 + 3) * 1.15;
			flecks.push(
				Math.sin(latitude) * Math.cos(longitude) * radius,
				Math.cos(latitude) * radius * 0.72,
				Math.sin(latitude) * Math.sin(longitude) * radius,
			);
		}
		return {
			arcs: geometry(arcs),
			flecks: geometry(flecks),
			ticks: geometry(ticks),
		};
	}, []);
	useFrame(({ clock }) => {
		if (orbit.current) orbit.current.rotation.y = -clock.elapsedTime * 0.075;
	});
	return (
		<group ref={orbit}>
			<lineSegments geometry={arcs} raycast={() => {}}>
				<lineBasicMaterial
					color="#6594b1"
					transparent
					opacity={0.43}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</lineSegments>
			<lineSegments geometry={ticks} raycast={() => {}}>
				<lineBasicMaterial
					color="#9bcbd8"
					transparent
					opacity={0.45}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</lineSegments>
			<points geometry={flecks} raycast={() => {}}>
				<pointsMaterial
					color="#8ab7c8"
					size={0.025}
					sizeAttenuation
					transparent
					opacity={0.42}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</points>
		</group>
	);
}
