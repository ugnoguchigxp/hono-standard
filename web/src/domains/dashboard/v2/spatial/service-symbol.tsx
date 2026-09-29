import { useEffect, useRef } from "react";
import {
	type Group,
	Mesh,
	MeshBasicMaterial,
	Quaternion,
	Vector3,
} from "three";
import { HEAD_ROTATION, headProfile } from "./head-profile";
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
	ghostOpacity = 0.17,
}: {
	symbol:
		| EntitySymbol
		| "harness"
		| "laptop"
		| "thermometer"
		| "processor"
		| "dimm"
		| "ssd"
		| "head";
	color: string;
	size: number;
	ghost?: boolean;
	ghostOpacity?: number;
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
				material.opacity = Math.min(material.opacity, ghostOpacity);
				material.depthWrite = false;
				material.needsUpdate = true;
			}
		});
	}, [ghost, ghostOpacity]);
	return (
		<group ref={group} scale={size / 0.43}>
			{symbol === "head" ? (
				<group rotation={[0, HEAD_ROTATION, 0]}>
					<mesh position={[0, 0, -0.075]}>
						<extrudeGeometry
							args={[
								headProfile,
								{
									depth: 0.15,
									bevelEnabled: true,
									bevelSegments: 1,
									steps: 1,
									bevelSize: 0.012,
									bevelThickness: 0.012,
									curveSegments: 2,
								},
							]}
						/>
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[-0.19, 0.02, 0.105]}>
						<torusGeometry args={[0.055, 0.009, 3, 10]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					<mesh position={[0.18, 0.13, 0.105]}>
						<sphereGeometry args={[0.017, 5, 4]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</group>
			) : symbol === "ssd" ? (
				<group rotation={[0, -Math.PI / 6, 0]}>
					<mesh>
						<boxGeometry args={[0.7, 0.09, 0.45]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[0, 0.051, 0]}>
						<boxGeometry args={[0.47, 0.005, 0.28]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[0.35, 0, -0.085]}>
						<boxGeometry args={[0.07, 0.035, 0.17]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</group>
			) : symbol === "dimm" ? (
				<group rotation={[0, -Math.PI / 7, 0]}>
					<mesh position={[0, 0.05, 0]}>
						<boxGeometry args={[0.94, 0.3, 0.045]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					{[-0.33, -0.11, 0.11, 0.33].map((x) => (
						<mesh key={x} position={[x, 0.075, 0.035]}>
							<boxGeometry args={[0.17, 0.17, 0.025]} />
							<meshBasicMaterial color={color} wireframe toneMapped={false} />
						</mesh>
					))}
					{[-0.38, -0.28, -0.18, -0.08, 0.13, 0.23, 0.33, 0.43].map((x) => (
						<mesh key={x} position={[x, -0.13, 0.01]}>
							<boxGeometry args={[0.055, 0.085, 0.052]} />
							<meshBasicMaterial color={color} toneMapped={false} />
						</mesh>
					))}
				</group>
			) : symbol === "processor" ? (
				<group rotation={[0, Math.PI / 4, 0]}>
					<mesh>
						<boxGeometry args={[0.62, 0.05, 0.62]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[0, 0.034, 0]}>
						<boxGeometry args={[0.4, 0.012, 0.4]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					{[-0.22, 0, 0.22].flatMap((offset) =>
						[-1, 1].flatMap((side) => [
							<mesh
								key={`x:${side}:${offset}`}
								position={[side * 0.35, 0, offset]}
							>
								<boxGeometry args={[0.09, 0.025, 0.045]} />
								<meshBasicMaterial color={color} toneMapped={false} />
							</mesh>,
							<mesh
								key={`z:${side}:${offset}`}
								position={[offset, 0, side * 0.35]}
							>
								<boxGeometry args={[0.045, 0.025, 0.09]} />
								<meshBasicMaterial color={color} toneMapped={false} />
							</mesh>,
						]),
					)}
				</group>
			) : symbol === "thermometer" ? (
				<>
					<mesh position={[0, 0.02, -0.08]}>
						<boxGeometry args={[0.29, 0.83, 0.035]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[0, -0.02, 0.02]}>
						<cylinderGeometry args={[0.055, 0.055, 0.59, 6]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[0, -0.34, 0.04]}>
						<sphereGeometry args={[0.12, 8, 6]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					{[0.22, 0.1, -0.02, -0.14].map((height) => (
						<Rod
							key={height}
							from={[0.09, height, 0.04]}
							to={[0.17, height, 0.04]}
							color={color}
							radius={0.009}
						/>
					))}
				</>
			) : symbol === "laptop" ? (
				<group rotation={[0, -Math.PI / 5, 0]}>
					<mesh position={[0, -0.05, -0.22]} rotation={[-0.16, 0, 0]}>
						<boxGeometry args={[0.82, 0.53, 0.025]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[0, -0.34, 0.065]}>
						<boxGeometry args={[0.86, 0.025, 0.58]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[0, -0.324, 0.005]} rotation={[-Math.PI / 2, 0, 0]}>
						<planeGeometry args={[0.67, 0.25]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<mesh position={[0, -0.324, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
						<planeGeometry args={[0.23, 0.1]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<Rod
						from={[-0.4, -0.32, -0.22]}
						to={[0.4, -0.32, -0.22]}
						color={color}
						radius={0.012}
					/>
				</group>
			) : symbol === "harness" ? (
				<>
					<mesh position={[-0.3, 0.25, 0]}>
						<torusGeometry args={[0.16, 0.027, 4, 16]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					{(
						[
							[
								[-0.17, 0.16, 0],
								[-0.03, -0.06, 0.03],
							],
							[
								[-0.03, -0.06, 0.03],
								[0.17, -0.2, 0.06],
							],
							[
								[0.17, -0.2, 0.06],
								[0.36, -0.28, 0],
							],
						] as [Point, Point][]
					).map(([from, to]) => (
						<Rod
							key={from.join(":")}
							from={from}
							to={to}
							color={color}
							radius={0.023}
						/>
					))}
					<mesh position={[0.36, -0.28, 0]}>
						<octahedronGeometry args={[0.075]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
				</>
			) : symbol === "computer" ? (
				<>
					<mesh position={[0, 0.08, 0]}>
						<boxGeometry args={[0.62, 0.42, 0.08]} />
						<meshBasicMaterial color={color} wireframe toneMapped={false} />
					</mesh>
					<Rod
						from={[0, -0.15, 0]}
						to={[0, -0.36, 0]}
						color={color}
						radius={0.025}
					/>
					<mesh position={[0, -0.38, 0]}>
						<boxGeometry args={[0.36, 0.035, 0.18]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</>
			) : symbol === "brain" ? (
				[-1, 1].map((side) => (
					<group key={side}>
						<mesh position={[side * 0.18, 0.015, 0]} scale={[0.75, 1, 0.75]}>
							<icosahedronGeometry args={[0.35, 1]} />
							<meshBasicMaterial color={color} wireframe toneMapped={false} />
						</mesh>
						{[
							[0.22, 0.13],
							[-0.02, 0.27],
							[-0.2, 0.12],
						].map(([height, x]) => (
							<mesh
								key={`${height}:${x}`}
								position={[side * x, height, 0.13]}
								scale={[0.9, 0.75, 0.65]}
							>
								<icosahedronGeometry args={[0.16, 0]} />
								<meshBasicMaterial color={color} wireframe toneMapped={false} />
							</mesh>
						))}
						{[
							[
								[0.08, 0.25, 0.25],
								[0.29, 0.17, 0.22],
							],
							[
								[0.1, 0.01, 0.28],
								[0.31, -0.08, 0.22],
							],
							[
								[0.08, -0.2, 0.23],
								[0.26, -0.26, 0.18],
							],
						].map(([from, to]) => (
							<Rod
								key={from.join(":")}
								from={[side * from[0], from[1], from[2]]}
								to={[side * to[0], to[1], to[2]]}
								color={color}
								radius={0.012}
							/>
						))}
					</group>
				))
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
