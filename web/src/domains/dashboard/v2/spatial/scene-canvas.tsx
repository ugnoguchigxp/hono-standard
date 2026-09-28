// biome-ignore-all lint/a11y/noStaticElementInteractions: Three.js meshes use pointer selection; equivalent keyboard controls are in the HTML lists.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
	createContext,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";
import {
	AdditiveBlending,
	type Group,
	type MeshBasicMaterial,
	OrthographicCamera,
	Vector3,
} from "three";
import { ParticleSymbol } from "./particle-symbol";
import {
	healthVisual,
	entityVisualColor,
	type Orbit,
	orbitalPosition,
	type SceneModel,
	type Selection,
} from "./scene-model";
import { ServiceSymbol } from "./service-symbol";

const OrbitClock = createContext<{ current: number } | null>(null);

function OrbitSystem({
	active,
	children,
}: {
	active: boolean;
	children: ReactNode;
}) {
	const elapsed = useRef(0);
	const moving = useRef(false);
	const invalidate = useThree((state) => state.invalidate);
	useEffect(() => {
		const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
		let timer: ReturnType<typeof setInterval> | null = null;
		const update = () => {
			if (timer) clearInterval(timer);
			moving.current = active && !document.hidden && !preference.matches;
			if (moving.current) timer = setInterval(invalidate, 50);
			invalidate();
		};
		update();
		document.addEventListener("visibilitychange", update);
		preference.addEventListener("change", update);
		return () => {
			if (timer) clearInterval(timer);
			document.removeEventListener("visibilitychange", update);
			preference.removeEventListener("change", update);
		};
	}, [active, invalidate]);
	useFrame((_, delta) => {
		if (moving.current) elapsed.current += Math.min(delta, 0.05) * 1000;
	}, -1);
	return <OrbitClock.Provider value={elapsed}>{children}</OrbitClock.Provider>;
}

function useOrbitClock() {
	const clock = useContext(OrbitClock);
	if (!clock) throw new Error("Orbit clock is unavailable");
	return clock;
}

function OrbitAnchor({
	orbit,
	children,
}: {
	orbit: Orbit;
	children: ReactNode;
}) {
	const group = useRef<Group>(null);
	const clock = useOrbitClock();
	useFrame(() => {
		group.current?.position.set(...orbitalPosition(orbit, clock.current));
	});
	return (
		<group ref={group} position={orbitalPosition(orbit, 0)}>
			{children}
		</group>
	);
}

type Props = {
	model: SceneModel;
	selected: Selection;
	onSelect: (selection: Selection) => void;
	onContextLost: () => void;
	active: boolean;
};

function ContextMonitor({ onContextLost }: { onContextLost: () => void }) {
	const canvas = useThree((state) => state.gl.domElement);
	useEffect(() => {
		const lost = (event: Event) => {
			event.preventDefault();
			onContextLost();
		};
		canvas.addEventListener("webglcontextlost", lost);
		return () => canvas.removeEventListener("webglcontextlost", lost);
	}, [canvas, onContextLost]);
	return null;
}

function SceneCamera({ model }: { model: SceneModel }) {
	const camera = useThree((state) => state.camera);
	const size = useThree((state) => state.size);
	const invalidate = useThree((state) => state.invalidate);
	const canvas = useThree((state) => state.gl.domElement);
	const surface = canvas.closest<HTMLElement>(".spatial-canvas") ?? canvas;
	const basePosition = useRef(camera.position.clone());
	const pan = useRef(new Vector3());
	const zoomFactor = useRef(1);
	const fitZoom = useRef(camera.zoom);
	const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null);
	const publishCameraState = useCallback(() => {
		canvas.dataset.cameraZoom = camera.zoom.toFixed(3);
		canvas.dataset.cameraPan = [pan.current.x, pan.current.y, pan.current.z]
			.map((value) => value.toFixed(3))
			.join(",");
	}, [camera, canvas]);
	useEffect(() => {
		if (!(camera instanceof OrthographicCamera)) return;
		camera.position.copy(basePosition.current);
		camera.updateMatrixWorld();
		let maxX = 0;
		let maxY = 0;
		const orbits = [...model.entities, ...model.tasks, ...model.stages].map(
			(item) => item.orbit,
		);
		for (const position of orbits.flatMap((orbit) =>
			Array.from({ length: 12 }, (_, index) =>
				orbitalPosition(orbit, (orbit.periodMs * index) / 12),
			),
		)) {
			const projected = new Vector3(...position).applyMatrix4(
				camera.matrixWorldInverse,
			);
			maxX = Math.max(maxX, Math.abs(projected.x));
			maxY = Math.max(maxY, Math.abs(projected.y));
		}
		fitZoom.current = Math.min(
			size.width / (2 * maxX + 4.4),
			size.height / (2 * maxY + 4.4),
			78,
		);
		camera.position.add(pan.current);
		camera.zoom = fitZoom.current * zoomFactor.current;
		camera.updateMatrixWorld();
		camera.updateProjectionMatrix();
		publishCameraState();
		invalidate();
	}, [camera, size.width, size.height, invalidate, model, publishCameraState]);
	useEffect(() => {
		if (!(camera instanceof OrthographicCamera)) return;
		const right = new Vector3();
		const up = new Vector3();
		const moveView = (x: number, y: number) => {
			right.set(1, 0, 0).applyQuaternion(camera.quaternion);
			up.set(0, 1, 0).applyQuaternion(camera.quaternion);
			pan.current.addScaledVector(right, x).addScaledVector(up, y);
			camera.position.copy(basePosition.current).add(pan.current);
			camera.updateMatrixWorld();
			publishCameraState();
			invalidate();
		};
		const zoomBy = (delta: number, clientX: number, clientY: number) => {
			const nextFactor = Math.min(
				4,
				Math.max(0.45, zoomFactor.current * Math.exp(-delta * 0.0012)),
			);
			const previousZoom = camera.zoom;
			const nextZoom = fitZoom.current * nextFactor;
			if (nextZoom === previousZoom) return;
			const rect = canvas.getBoundingClientRect();
			const x = clientX - rect.left - rect.width / 2;
			const y = clientY - rect.top - rect.height / 2;
			zoomFactor.current = nextFactor;
			moveView(
				x * (1 / previousZoom - 1 / nextZoom),
				-y * (1 / previousZoom - 1 / nextZoom),
			);
			camera.zoom = nextZoom;
			camera.updateProjectionMatrix();
			publishCameraState();
			invalidate();
		};
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const delta =
				event.deltaY *
				(event.deltaMode === 1
					? 16
					: event.deltaMode === 2
						? canvas.clientHeight
						: 1);
			zoomBy(delta, event.clientX, event.clientY);
		};
		const onCommand = (event: Event) => {
			const command = (event as CustomEvent<string>).detail;
			const rect = canvas.getBoundingClientRect();
			if (command === "zoom-in" || command === "zoom-out") {
				zoomBy(
					command === "zoom-in" ? -300 : 300,
					rect.left + rect.width / 2,
					rect.top + rect.height / 2,
				);
			} else if (command === "reset") {
				pan.current.set(0, 0, 0);
				zoomFactor.current = 1;
				camera.position.copy(basePosition.current);
				camera.zoom = fitZoom.current;
				camera.updateMatrixWorld();
				camera.updateProjectionMatrix();
				publishCameraState();
				invalidate();
			} else if (
				command === "left" ||
				command === "right" ||
				command === "up" ||
				command === "down"
			) {
				moveView(
					command === "left" ? -0.65 : command === "right" ? 0.65 : 0,
					command === "up" ? 0.65 : command === "down" ? -0.65 : 0,
				);
			}
		};
		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 2) return;
			event.preventDefault();
			drag.current = {
				x: event.clientX,
				y: event.clientY,
				pointerId: event.pointerId,
			};
			surface.setPointerCapture(event.pointerId);
			canvas.style.cursor = "grabbing";
		};
		const onPointerMove = (event: PointerEvent) => {
			const previous = drag.current;
			if (!previous || previous.pointerId !== event.pointerId) return;
			if (!(event.buttons & 2)) {
				drag.current = null;
				canvas.style.cursor = "";
				return;
			}
			moveView(
				-(event.clientX - previous.x) / camera.zoom,
				(event.clientY - previous.y) / camera.zoom,
			);
			drag.current = {
				x: event.clientX,
				y: event.clientY,
				pointerId: event.pointerId,
			};
		};
		const onPointerEnd = () => {
			drag.current = null;
			canvas.style.cursor = "";
		};
		const onContextMenu = (event: MouseEvent) => event.preventDefault();
		surface.addEventListener("wheel", onWheel, { passive: false });
		surface.addEventListener("pointerdown", onPointerDown);
		surface.addEventListener("pointermove", onPointerMove);
		surface.addEventListener("pointerup", onPointerEnd);
		surface.addEventListener("pointercancel", onPointerEnd);
		surface.addEventListener("lostpointercapture", onPointerEnd);
		surface.addEventListener("contextmenu", onContextMenu);
		surface.addEventListener("spatial-camera-command", onCommand);
		return () => {
			surface.removeEventListener("wheel", onWheel);
			surface.removeEventListener("pointerdown", onPointerDown);
			surface.removeEventListener("pointermove", onPointerMove);
			surface.removeEventListener("pointerup", onPointerEnd);
			surface.removeEventListener("pointercancel", onPointerEnd);
			surface.removeEventListener("lostpointercapture", onPointerEnd);
			surface.removeEventListener("contextmenu", onContextMenu);
			surface.removeEventListener("spatial-camera-command", onCommand);
			canvas.style.cursor = "";
		};
	}, [camera, canvas, surface, invalidate, publishCameraState]);
	return null;
}

function OrbitSegment({
	fromOrbit,
	toOrbit,
	start = 0,
	end = 1,
	color,
	radius = 0.04,
	onClick,
}: {
	fromOrbit: Orbit;
	toOrbit: Orbit;
	start?: number;
	end?: number;
	color: string;
	radius?: number;
	onClick?: () => void;
}) {
	const group = useRef<Group>(null);
	const clock = useOrbitClock();
	const scratch = useMemo(
		() => ({
			fromPoint: [0, 0, 0] as [number, number, number],
			toPoint: [0, 0, 0] as [number, number, number],
			from: new Vector3(),
			to: new Vector3(),
			begin: new Vector3(),
			finish: new Vector3(),
			direction: new Vector3(),
			up: new Vector3(0, 1, 0),
		}),
		[],
	);
	useFrame(() => {
		if (!group.current) return;
		scratch.from.fromArray(
			orbitalPosition(fromOrbit, clock.current, scratch.fromPoint),
		);
		scratch.to.fromArray(
			orbitalPosition(toOrbit, clock.current, scratch.toPoint),
		);
		scratch.begin.copy(scratch.from).lerp(scratch.to, start);
		scratch.finish.copy(scratch.from).lerp(scratch.to, end);
		scratch.direction.copy(scratch.finish).sub(scratch.begin);
		const length = scratch.direction.length();
		group.current.position
			.copy(scratch.begin)
			.add(scratch.finish)
			.multiplyScalar(0.5);
		if (length > 0) {
			group.current.quaternion.setFromUnitVectors(
				scratch.up,
				scratch.direction.multiplyScalar(1 / length),
			);
		}
		group.current.scale.set(1, Math.max(length, 0.001), 1);
	});
	return (
		<group ref={group}>
			<mesh>
				<cylinderGeometry args={[radius * 3.5, radius * 3.5, 1, 8]} />
				<meshBasicMaterial
					color={color}
					transparent
					opacity={0.16}
					blending={AdditiveBlending}
					depthWrite={false}
					toneMapped={false}
				/>
			</mesh>
			<mesh>
				<cylinderGeometry args={[radius * 0.42, radius * 0.42, 1, 8]} />
				<meshBasicMaterial color={color} toneMapped={false} />
			</mesh>
			<mesh
				onClick={
					onClick
						? (event) => {
								event.stopPropagation();
								onClick();
							}
						: undefined
				}
			>
				<cylinderGeometry
					args={[
						Math.max(radius * 1.8, 0.09),
						Math.max(radius * 1.8, 0.09),
						1,
						8,
					]}
				/>
				<meshBasicMaterial
					color={color}
					transparent
					opacity={0.001}
					depthWrite={false}
				/>
			</mesh>
		</group>
	);
}

function TaskGlyph({
	task,
	selected,
	onClick,
}: {
	task: SceneModel["tasks"][number];
	selected: boolean;
	onClick: () => void;
}) {
	const color =
		task.state === "failed" || task.state === "blocked"
			? "#ff6b7b"
			: task.state === "completed"
				? "#61d6bd"
				: "#f5b375";
	return (
		<group
			scale={selected ? 1.3 : 1}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			<ParticleSymbol shape="task-particle" color={color} selected={selected} />
			<mesh>
				<tetrahedronGeometry args={[0.25, 0]} />
				<meshBasicMaterial
					color={color}
					transparent
					opacity={0.16}
					toneMapped={false}
				/>
			</mesh>
			<mesh rotation={[Math.PI / 2.4, 0.2, 0]}>
				<torusGeometry args={[0.31, 0.013, 4, 3]} />
				<meshBasicMaterial
					color={color}
					transparent
					opacity={0.75}
					toneMapped={false}
				/>
			</mesh>
		</group>
	);
}

function StageGlyph({
	stage,
	selected,
	active,
	onClick,
}: {
	stage: SceneModel["stages"][number];
	selected: boolean;
	active: boolean;
	onClick: () => void;
}) {
	const processing =
		active && stage.status === "running" && stage.activeTaskId !== null;
	const color = selected
		? "#ffffff"
		: stage.status === "stalled"
			? "#ff6b7b"
			: processing
				? "#ffb477"
				: "#61d6bd";
	const queueMarks = Math.min(stage.queueDepth, 6);
	return (
		<group
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			<StageCore
				symbol={stage.id}
				kind={stage.kind}
				active={processing}
				color={color}
			/>
			{selected ? (
				<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.43, 0]}>
					<torusGeometry args={[0.47, 0.018, 5, 40]} />
					<meshBasicMaterial color="#ffffff" toneMapped={false} />
				</mesh>
			) : null}
			{Array.from({ length: queueMarks }, (_, index) => {
				const angle = (index / 6) * Math.PI * 2;
				return (
					<mesh
						key={`queue-${angle.toFixed(5)}`}
						position={[Math.cos(angle) * 0.53, -0.4, Math.sin(angle) * 0.53]}
					>
						<sphereGeometry args={[0.045, 6, 4]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				);
			})}
		</group>
	);
}

function StageCore({
	symbol,
	kind,
	active,
	color,
}: {
	symbol: string;
	kind: SceneModel["stages"][number]["kind"];
	active: boolean;
	color: string;
}) {
	const group = useRef<Group>(null);
	const moving = useRef(false);
	const invalidate = useThree((state) => state.invalidate);
	useEffect(() => {
		const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
		let timer: ReturnType<typeof setInterval> | null = null;
		const update = () => {
			if (timer) clearInterval(timer);
			moving.current = active && !document.hidden && !preference.matches;
			if (!moving.current && group.current) {
				group.current.rotation.y = 0;
				group.current.scale.setScalar(1);
			}
			if (moving.current) timer = setInterval(invalidate, 50);
			invalidate();
		};
		update();
		document.addEventListener("visibilitychange", update);
		preference.addEventListener("change", update);
		return () => {
			if (timer) clearInterval(timer);
			document.removeEventListener("visibilitychange", update);
			preference.removeEventListener("change", update);
		};
	}, [active, invalidate]);
	useFrame(() => {
		if (!group.current || !moving.current) return;
		group.current.rotation.y = performance.now() / 1400;
		group.current.scale.setScalar(1 + 0.1 * Math.sin(performance.now() / 330));
	});
	return (
		<group ref={group}>
			<ParticleSymbol
				shape={
					symbol === "finding" ||
					symbol === "covering" ||
					symbol === "finalize" ||
					symbol === "review-queue" ||
					symbol === "knowledge-queue"
						? symbol
						: "stage"
				}
				color={color}
				selected={active}
			/>
			{symbol === "finding" ? (
				<>
					<mesh position={[-0.08, 0.08, 0]}>
						<torusGeometry args={[0.26, 0.035, 6, 32]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					<mesh position={[0.23, -0.22, 0]} rotation={[0, 0, -Math.PI / 4]}>
						<cylinderGeometry args={[0.05, 0.05, 0.38, 8]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</>
			) : symbol === "covering" ? (
				<>
					{[-0.15, 0, 0.15].map((offset) => (
						<mesh
							key={offset}
							position={[0, offset, 0]}
							rotation={[0, Math.PI / 4, 0]}
						>
							<boxGeometry args={[0.43, 0.05, 0.43]} />
							<meshBasicMaterial color={color} toneMapped={false} />
						</mesh>
					))}
					<mesh>
						<boxGeometry args={[0.26, 0.42, 0.26]} />
						<meshBasicMaterial
							color={color}
							transparent
							opacity={0.22}
							toneMapped={false}
						/>
					</mesh>
				</>
			) : symbol === "finalize" ? (
				<>
					<mesh position={[-0.14, -0.07, 0]} rotation={[0, 0, Math.PI / 4]}>
						<cylinderGeometry args={[0.05, 0.05, 0.28, 6]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					<mesh position={[0.13, 0.04, 0]} rotation={[0, 0, -Math.PI / 4]}>
						<cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</>
			) : symbol === "review-queue" ? (
				<>
					<mesh scale={[1.35, 0.65, 1]}>
						<torusGeometry args={[0.3, 0.035, 6, 32]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					<mesh>
						<octahedronGeometry args={[0.12]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</>
			) : symbol === "knowledge-queue" ? (
				[-0.17, 0, 0.17].map((offset) => (
					<mesh key={offset} position={[0, offset, 0]}>
						<boxGeometry args={[0.48, 0.1, 0.33]} />
						<meshBasicMaterial
							color={color}
							wireframe={offset === 0}
							toneMapped={false}
						/>
					</mesh>
				))
			) : kind === "queue" ? (
				<>
					<mesh rotation={[Math.PI / 2.4, 0, 0]}>
						<torusGeometry args={[0.32, active ? 0.065 : 0.035, 6, 32]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					<mesh>
						<sphereGeometry args={[0.1, 8, 6]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
				</>
			) : (
				<>
					<mesh>
						<octahedronGeometry args={[0.25, 0]} />
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					<mesh>
						<octahedronGeometry args={[0.39, 0]} />
						<meshBasicMaterial
							color={color}
							wireframe
							transparent
							opacity={active ? 1 : 0.68}
							toneMapped={false}
						/>
					</mesh>
				</>
			)}
			{active ? (
				<mesh>
					<sphereGeometry args={[0.46, 12, 8]} />
					<meshBasicMaterial
						color="#ffab70"
						transparent
						opacity={0.12}
						blending={AdditiveBlending}
						depthWrite={false}
						toneMapped={false}
					/>
				</mesh>
			) : null}
		</group>
	);
}

function PipelinePath({
	pipeline,
	stages,
	selected,
	onClick,
}: {
	pipeline: SceneModel["pipelines"][number];
	stages: SceneModel["stages"];
	selected: boolean;
	onClick: () => void;
}) {
	const orbits = new Map(stages.map((stage) => [stage.id, stage.orbit]));
	return (
		<group>
			{pipeline.links.map((link) => {
				const from = orbits.get(link.source);
				const to = orbits.get(link.target);
				if (!from || !to) return null;
				return (
					<group key={`${link.source}:${link.target}`}>
						<OrbitSegment
							fromOrbit={from}
							toOrbit={to}
							color={selected ? "#ffffff" : "#dc9d69"}
							radius={0.045}
							onClick={onClick}
						/>
					</group>
				);
			})}
		</group>
	);
}

function TopologyField({ stages }: { stages: SceneModel["stages"] }) {
	return (
		<group>
			<gridHelper
				args={[20, 10, "#26384d", "#142235"]}
				position={[0, -1.05, 0]}
			/>
			{stages.map((stage) => (
				<group
					key={`${stage.pipelineId}:${stage.id}`}
					rotation={[0, stage.orbit.nodeAngle, 0]}
					position={[0, stage.orbit.yOffset, 0]}
				>
					<mesh rotation={[-Math.PI / 2 + stage.orbit.inclination, 0, 0]}>
						<torusGeometry args={[stage.orbit.radius, 0.008, 4, 128]} />
						<meshBasicMaterial
							color={stage.kind === "queue" ? "#5795ac" : "#d7a275"}
							transparent
							opacity={0.16}
							depthWrite={false}
							toneMapped={false}
						/>
					</mesh>
				</group>
			))}
		</group>
	);
}

function EntityGlyph({
	entity,
	selected,
	onClick,
}: {
	entity: SceneModel["entities"][number];
	selected: boolean;
	onClick: () => void;
}) {
	const radius =
		entity.kind === "agent" || entity.kind === "system" ? 0.57 : 0.43;
	const color = entityVisualColor(entity);
	const alarm = useRef<Group>(null);
	const alarmMaterial = useRef<MeshBasicMaterial>(null);
	const clock = useOrbitClock();
	useFrame(() => {
		if (!alarm.current || !alarmMaterial.current) return;
		const elapsed = clock.current;
		if (entity.visualState === "danger") {
			const pulse = (Math.sin(elapsed * 0.008) + 1) / 2;
			alarm.current.scale.setScalar(1 + pulse * 0.35);
			alarmMaterial.current.opacity = 0.35 + pulse * 0.65;
		} else if (entity.visualState === "dead") {
			alarm.current.scale.setScalar(1);
			alarmMaterial.current.opacity =
				Math.floor(elapsed / 400) % 3 === 0 ? 1 : 0.25;
		}
	});
	return (
		<group
			scale={selected ? 1.18 : 1}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			<ServiceSymbol symbol={entity.symbol} color={color} size={radius} ghost />
			<ParticleSymbol
				shape={entity.symbol}
				color={color}
				size={radius / 0.43}
				selected={selected}
			/>
			{entity.visualState === "danger" || entity.visualState === "dead" ? (
				<group
					ref={alarm}
					rotation={[-Math.PI / 2, 0, 0]}
					position={[0, -0.35, 0]}
				>
					<mesh>
						<torusGeometry
							args={[
								radius * 1.8,
								0.04,
								6,
								32,
								entity.visualState === "dead" ? Math.PI * 1.5 : Math.PI * 2,
							]}
						/>
						<meshBasicMaterial
							ref={alarmMaterial}
							color={entity.visualState === "dead" ? "#ad86ed" : "#f43e5c"}
							transparent
							opacity={0.6}
							toneMapped={false}
						/>
					</mesh>
				</group>
			) : null}
			{selected ? (
				<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
					<torusGeometry args={[radius * 1.5, 0.025, 5, 40]} />
					<meshBasicMaterial color="#ffffff" toneMapped={false} />
				</mesh>
			) : null}
			{entity.health !== "healthy" ? (
				<mesh position={[0, radius + 0.44, 0]}>
					{entity.health === "fault" ? (
						<coneGeometry args={[0.17, 0.28, 3]} />
					) : entity.health === "degraded" ? (
						<octahedronGeometry args={[0.17]} />
					) : entity.health === "disconnected" ? (
						<torusGeometry args={[0.18, 0.045, 6, 12]} />
					) : (
						<sphereGeometry args={[0.12, 8, 6]} />
					)}
					<meshBasicMaterial color={color} toneMapped={false} />
				</mesh>
			) : null}
		</group>
	);
}

function Boundary({
	fromOrbit,
	toOrbit,
	health,
	selected,
	onClick,
}: {
	fromOrbit: Orbit;
	toOrbit: Orbit;
	health: keyof typeof healthVisual;
	selected: boolean;
	onClick: () => void;
}) {
	const color = selected ? "#ffffff" : healthVisual[health].color;
	const pattern = healthVisual[health].pattern;
	const fractions =
		pattern === "broken"
			? [
					[0, 0.36],
					[0.64, 1],
				]
			: pattern === "dashed"
				? [
						[0, 0.24],
						[0.38, 0.62],
						[0.76, 1],
					]
				: [[0, 1]];
	return (
		<group>
			{fractions.map(([start, end]) => (
				<OrbitSegment
					key={`${start}-${end}`}
					fromOrbit={fromOrbit}
					toOrbit={toOrbit}
					start={start}
					end={end}
					color={color}
					radius={selected ? 0.09 : 0.055}
					onClick={onClick}
				/>
			))}
		</group>
	);
}

function SceneContent({
	model,
	selected,
	onSelect,
	active,
}: Omit<Props, "onContextLost">) {
	return (
		<>
			<color attach="background" args={["#080d1b"]} />
			<ambientLight intensity={0.65} />
			<directionalLight position={[3, 8, 5]} intensity={1.2} />
			<TopologyField stages={model.stages} />
			<OrbitSystem active={active}>
				{model.boundaries.map((boundary) => (
					<Boundary
						key={boundary.id}
						fromOrbit={boundary.fromOrbit}
						toOrbit={boundary.toOrbit}
						health={boundary.health}
						selected={
							selected?.kind === "boundary" && selected.id === boundary.id
						}
						onClick={() => onSelect({ kind: "boundary", id: boundary.id })}
					/>
				))}
				{model.entities.map((entity) => (
					<OrbitAnchor key={entity.id} orbit={entity.orbit}>
						<EntityGlyph
							entity={entity}
							selected={
								selected?.kind === "entity" && selected.id === entity.id
							}
							onClick={() => onSelect({ kind: "entity", id: entity.id })}
						/>
					</OrbitAnchor>
				))}
				{model.tasks.map((task) => (
					<OrbitAnchor key={task.id} orbit={task.orbit}>
						<TaskGlyph
							task={task}
							selected={selected?.kind === "task" && selected.id === task.id}
							onClick={() => onSelect({ kind: "task", id: task.id })}
						/>
					</OrbitAnchor>
				))}
				{model.pipelines.map((pipeline) => (
					<PipelinePath
						key={pipeline.id}
						pipeline={pipeline}
						stages={model.stages.filter(
							(stage) => stage.pipelineId === pipeline.id,
						)}
						selected={
							selected?.kind === "pipeline" && selected.id === pipeline.id
						}
						onClick={() => onSelect({ kind: "pipeline", id: pipeline.id })}
					/>
				))}
				{model.stages.map((stage) => (
					<OrbitAnchor
						key={`${stage.pipelineId}:${stage.id}`}
						orbit={stage.orbit}
					>
						<StageGlyph
							stage={stage}
							active={active}
							selected={
								selected?.kind === "stage" &&
								selected.id === stage.id &&
								selected.pipelineId === stage.pipelineId
							}
							onClick={() =>
								onSelect({
									kind: "stage",
									id: stage.id,
									pipelineId: stage.pipelineId,
								})
							}
						/>
					</OrbitAnchor>
				))}
			</OrbitSystem>
		</>
	);
}

export function SceneCanvas(props: Props) {
	const command =
		(name: string) => (event: ReactMouseEvent<HTMLButtonElement>) => {
			event.currentTarget
				.closest(".spatial-canvas")
				?.dispatchEvent(
					new CustomEvent("spatial-camera-command", { detail: name }),
				);
		};
	return (
		<div className="spatial-canvas" data-spatial-canvas="ready">
			<Canvas
				orthographic
				camera={{ position: [0, 12, 16], zoom: 46, near: 0.1, far: 100 }}
				frameloop="demand"
				dpr={[1, 1.5]}
				onPointerMissed={() => props.onSelect(null)}
			>
				<SceneCamera model={props.model} />
				<ContextMonitor onContextLost={props.onContextLost} />
				<SceneContent
					model={props.model}
					selected={props.selected}
					onSelect={props.onSelect}
					active={props.active}
				/>
			</Canvas>
			<fieldset className="spatial-camera-controls">
				<legend className="sr-only">Scene navigation</legend>
				<button type="button" onClick={command("zoom-in")} aria-label="Zoom in">
					＋
				</button>
				<button
					type="button"
					onClick={command("zoom-out")}
					aria-label="Zoom out"
				>
					−
				</button>
				<button type="button" onClick={command("left")} aria-label="Pan left">
					←
				</button>
				<button type="button" onClick={command("right")} aria-label="Pan right">
					→
				</button>
				<button type="button" onClick={command("up")} aria-label="Pan up">
					↑
				</button>
				<button type="button" onClick={command("down")} aria-label="Pan down">
					↓
				</button>
				<button
					type="button"
					onClick={command("reset")}
					aria-label="Reset view"
				>
					◎
				</button>
			</fieldset>
		</div>
	);
}
