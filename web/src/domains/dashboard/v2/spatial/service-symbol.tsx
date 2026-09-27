import { useEffect, useRef } from "react";
import {
	type Group,
	Mesh,
	MeshBasicMaterial,
	Quaternion,
	Vector3,
} from "three";
import type { EntitySymbol, Point } from "./scene-model";

function Rod({
	from,
	to,
	color,
	radius = 0.025,
}: {
	from: Point;
	to: Point;
	color: string;
	radius?: number;
}) {
	const start = new Vector3(...from);
	const finish = new Vector3(...to);
	const direction = finish.clone().sub(start);
	const quaternion = new Quaternion().setFromUnitVectors(
		new Vector3(0, 1, 0),
		direction.clone().normalize(),
	);
	return (
		<mesh
			position={start.add(finish).multiplyScalar(0.5)}
			quaternion={quaternion}
		>
			<cylinderGeometry args={[radius, radius, direction.length(), 6]} />
			<meshBasicMaterial color={color} toneMapped={false} />
		</mesh>
	);
}

export function ServiceSymbol({
	symbol,
	color,
	size,
	ghost = false,
}: {
	symbol: EntitySymbol;
	color: string;
	size: number;
	ghost?: boolean;
}) {
	const group = useRef<Group>(null);
	useEffect(() => {
		if (!ghost) return;
		group.current?.traverse((object) => {
			if (!(object instanceof Mesh)) return;
			const materials = Array.isArray(object.material)
				? object.material
				: [object.material];
			for (const material of materials) {
				if (!(material instanceof MeshBasicMaterial)) continue;
				material.transparent = true;
				material.opacity = Math.min(material.opacity, 0.17);
				material.depthWrite = false;
				material.needsUpdate = true;
			}
		});
	}, [ghost]);
	return (
		<group ref={group} scale={size / 0.43}>
			{symbol === "brain" ? (
				<>
					{[-1, 1].flatMap((side) =>
						[-0.15, 0.13].map((height) => (
							<mesh
								key={`${side}:${height}`}
								position={[side * 0.17, height, 0]}
								scale={[0.8, 0.72, 0.9]}
							>
								<icosahedronGeometry args={[0.29, 1]} />
								<meshBasicMaterial color={color} wireframe toneMapped={false} />
							</mesh>
						)),
					)}
					<Rod
						from={[0, -0.34, 0.04]}
						to={[0, 0.35, 0.04]}
						color={color}
						radius={0.018}
					/>
					{[-1, 1].map((side) => (
						<group key={side}>
							<Rod
								from={[side * 0.08, 0.19, 0.29]}
								to={[side * 0.3, 0.09, 0.24]}
								color={color}
								radius={0.018}
							/>
							<Rod
								from={[side * 0.09, -0.08, 0.3]}
								to={[side * 0.29, -0.18, 0.23]}
								color={color}
								radius={0.018}
							/>
						</group>
					))}
				</>
			) : symbol === "network" ? (
				<>
					<mesh>
						<octahedronGeometry args={[0.15]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					{Array.from({ length: 6 }, (_, index) => {
						const angle = (index * Math.PI) / 3;
						const position: Point = [
							Math.cos(angle) * 0.36,
							index % 2 === 0 ? 0.12 : -0.12,
							Math.sin(angle) * 0.28,
						];
						return (
							<group key={`network-node-${angle.toFixed(4)}`}>
								<Rod
									from={[0, 0, 0]}
									to={position}
									color={color}
									radius={0.013}
								/>
								<mesh position={position}>
									<octahedronGeometry args={[0.075]} />
									<meshBasicMaterial color={color} toneMapped={false} />
								</mesh>
							</group>
						);
					})}
				</>
			) : symbol === "world" ? (
				<>
					<mesh>
						<icosahedronGeometry args={[0.34, 2]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh rotation={[Math.PI / 2, 0, 0]}>
						<torusGeometry args={[0.36, 0.018, 4, 48]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					<mesh rotation={[0, 0, Math.PI / 2]}>
						<torusGeometry args={[0.36, 0.012, 4, 48]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</>
			) : symbol === "server" ? (
				[-0.22, 0, 0.22].map((height) => (
					<group key={height}>
						<mesh position={[0, height, 0]}>
							<boxGeometry args={[0.55, 0.16, 0.38]} />
							<meshBasicMaterial
								color={color}
								transparent
								opacity={0.35}
								toneMapped={false}
							/>
						</mesh>
						<mesh position={[-0.19, height, 0.2]}>
							<boxGeometry args={[0.08, 0.05, 0.02]} />
							<meshBasicMaterial color={color} toneMapped={false} />
						</mesh>
					</group>
				))
			) : symbol === "gear" ? (
				<>
					<mesh rotation={[Math.PI / 2, 0, 0]}>
						<torusGeometry args={[0.26, 0.07, 6, 24]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					{Array.from({ length: 8 }, (_, index) => {
						const angle = (index * Math.PI) / 4;
						return (
							<mesh
								key={`gear-tooth-${angle.toFixed(4)}`}
								position={[Math.cos(angle) * 0.34, 0, Math.sin(angle) * 0.34]}
								rotation={[0, -angle, 0]}
							>
								<boxGeometry args={[0.15, 0.12, 0.11]} />
								<meshBasicMaterial color={color} toneMapped={false} />
							</mesh>
						);
					})}
					<mesh>
						<cylinderGeometry args={[0.075, 0.075, 0.15, 10]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</>
			) : symbol === "gateway" ? (
				<>
					{[-0.27, 0.27].map((offset) => (
						<mesh key={offset} position={[offset, 0, 0]}>
							<boxGeometry args={[0.1, 0.62, 0.16]} />
							<meshBasicMaterial color={color} toneMapped={false} />
						</mesh>
					))}
					<Rod
						from={[-0.27, 0.31, 0]}
						to={[0.27, 0.31, 0]}
						color={color}
						radius={0.06}
					/>
					<mesh position={[0, 0, 0.04]}>
						<octahedronGeometry args={[0.13]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
				</>
			) : symbol === "orchestrator" ? (
				<>
					<mesh>
						<dodecahedronGeometry args={[0.3]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh>
						<octahedronGeometry args={[0.15]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					{[0, 1, 2].map((index) => (
						<mesh
							key={index}
							rotation={[(index * Math.PI) / 3, (index * Math.PI) / 4, 0]}
						>
							<torusGeometry args={[0.4, 0.016, 4, 36]} />
							<meshBasicMaterial
								color={color}
								transparent
								opacity={0.75}
								toneMapped={false}
							/>
						</mesh>
					))}
				</>
			) : symbol === "database" ? (
				[-0.2, 0, 0.2].map((height) => (
					<mesh key={height} position={[0, height, 0]}>
						<cylinderGeometry args={[0.29, 0.29, 0.13, 16]} />
						<meshBasicMaterial
							color={color}
							wireframe={height === 0}
							toneMapped={false}
						/>
					</mesh>
				))
			) : symbol === "microphone" ? (
				<>
					<mesh position={[0, 0.13, 0]}>
						<capsuleGeometry args={[0.15, 0.22, 4, 8]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<Rod
						from={[0, -0.16, 0]}
						to={[0, -0.34, 0]}
						color={color}
						radius={0.035}
					/>
					<mesh position={[0, -0.36, 0]}>
						<boxGeometry args={[0.34, 0.04, 0.12]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</>
			) : symbol === "speaker" ? (
				<>
					<mesh position={[-0.11, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
						<coneGeometry args={[0.25, 0.4, 12]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[0.13, 0, 0]}>
						<boxGeometry args={[0.1, 0.18, 0.18]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					{[0.28, 0.39].map((radius) => (
						<mesh
							key={radius}
							position={[0.13, 0, 0]}
							rotation={[0, 0, -Math.PI / 2]}
						>
							<torusGeometry args={[radius, 0.012, 4, 24, Math.PI]} />
							<meshBasicMaterial color={color} toneMapped={false} />
						</mesh>
					))}
				</>
			) : symbol === "embedding" ? (
				<>
					{[-0.24, 0, 0.24].flatMap((x) =>
						[-0.24, 0, 0.24].map((y) => (
							<mesh key={`${x}:${y}`} position={[x, y, 0]}>
								<boxGeometry args={[0.09, 0.09, 0.09]} />
								<meshBasicMaterial color={color} toneMapped={false} />
							</mesh>
						)),
					)}
					{[-0.24, 0, 0.24].map((offset) => (
						<group key={offset}>
							<Rod
								from={[-0.24, offset, 0]}
								to={[0.24, offset, 0]}
								color={color}
								radius={0.01}
							/>
							<Rod
								from={[offset, -0.24, 0]}
								to={[offset, 0.24, 0]}
								color={color}
								radius={0.01}
							/>
						</group>
					))}
				</>
			) : symbol === "backchannel" ? (
				[-0.13, 0.13].map((height) => (
					<group key={height}>
						<Rod
							from={[-0.27, height, 0]}
							to={[0.2, height, 0]}
							color={color}
							radius={0.025}
						/>
						<mesh
							position={[height < 0 ? -0.26 : 0.26, height, 0]}
							rotation={[0, 0, height < 0 ? Math.PI / 2 : -Math.PI / 2]}
						>
							<coneGeometry args={[0.1, 0.15, 4]} />
							<meshBasicMaterial color={color} toneMapped={false} />
						</mesh>
					</group>
				))
			) : symbol === "search" ? (
				<>
					<mesh position={[-0.07, 0.08, 0]}>
						<torusGeometry args={[0.24, 0.035, 6, 32]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					<Rod
						from={[0.1, -0.1, 0]}
						to={[0.34, -0.34, 0]}
						color={color}
						radius={0.045}
					/>
				</>
			) : symbol === "recall" ? (
				<>
					<mesh position={[0, -0.11, 0]}>
						<boxGeometry args={[0.48, 0.3, 0.35]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<Rod
						from={[0, -0.04, 0.19]}
						to={[0, 0.32, 0.19]}
						color={color}
						radius={0.03}
					/>
					<mesh position={[0, 0.34, 0.19]}>
						<coneGeometry args={[0.12, 0.15, 4]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</>
			) : symbol === "service" ? (
				<>
					<mesh>
						<cylinderGeometry args={[0.28, 0.28, 0.34, 6]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					{[-1, 0, 1].map((index) => (
						<mesh key={index} position={[index * 0.18, 0.27, 0]}>
							<boxGeometry args={[0.09, 0.12, 0.09]} />
							<meshBasicMaterial color={color} toneMapped={false} />
						</mesh>
					))}
				</>
			) : symbol === "pipeline" ? (
				[-0.22, 0, 0.22].map((offset) => (
					<mesh
						key={offset}
						position={[offset, 0, 0]}
						rotation={[0, 0, Math.PI / 4]}
					>
						<boxGeometry args={[0.22, 0.22, 0.1]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
				))
			) : (
				<mesh>
					<tetrahedronGeometry args={[0.32]} />
					<meshBasicMaterial color={color} toneMapped={false} />
				</mesh>
			)}
		</group>
	);
}
