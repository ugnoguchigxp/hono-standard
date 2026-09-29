// biome-ignore-all lint/a11y/noStaticElementInteractions: Three.js meshes use pointer selection; equivalent keyboard controls are in the HTML lists.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	AdditiveBlending,
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	type Group,
	Line,
	LineBasicMaterial,
	type Mesh,
	MeshBasicMaterial,
	OrthographicCamera,
	Quaternion,
	Vector3,
} from "three";
import { inspectionDetails } from "./inspection-details";
import { InspectionPanel } from "./inspection-panel";
import { ParticleSymbol } from "./particle-symbol";
import {
	entityVisualColor,
	healthVisual,
	type Orbit,
	orbitalPosition,
	type SceneModel,
	type Selection,
	selectionFromClick,
} from "./scene-model";
import { ServiceSymbol } from "./service-symbol";
import { UniverseField } from "./universe-field";

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

function useSmoothTint(group: React.RefObject<Group | null>, color: string) {
	const target = useMemo(() => new Color(color), [color]);
	const current = useRef(new Color(color));
	const materials = useRef<Color[]>([]);
	const invalidate = useThree((state) => state.invalidate);
	const reduced = useRef(false);
	useEffect(() => {
		const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => {
			reduced.current = preference.matches;
		};
		update();
		preference.addEventListener("change", update);
		return () => preference.removeEventListener("change", update);
	}, []);
	useLayoutEffect(() => {
		const previous = new Set(materials.current);
		const next: Color[] = [];
		group.current?.traverse((object) => {
			const material = (object as Mesh).material;
			for (const entry of Array.isArray(material) ? material : [material]) {
				if (
					entry &&
					"color" in entry &&
					entry.color instanceof Color &&
					(entry.color.equals(target) || previous.has(entry.color))
				) {
					entry.color.copy(current.current);
					next.push(entry.color);
				}
			}
		});
		materials.current = next;
		invalidate();
	});
	useFrame((_, delta) => {
		if (
			Math.abs(current.current.r - target.r) +
				Math.abs(current.current.g - target.g) +
				Math.abs(current.current.b - target.b) <
			0.005
		)
			return;
		current.current.lerp(
			target,
			reduced.current ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 4),
		);
		for (const materialColor of materials.current)
			materialColor.copy(current.current);
		invalidate();
	});
}

const OVERVIEW_RADIUS = 4.15 / 1.1;
const FOCUS_ZOOM_SCALE = 1.85;
const FOCUS_SHIFT = 0.16;

export function overviewZoomFor(viewWidth: number, viewHeight: number) {
	return Math.min(viewWidth, viewHeight) / (2 * OVERVIEW_RADIUS);
}

export function focusZoomFor(viewWidth: number, viewHeight: number) {
	return overviewZoomFor(viewWidth, viewHeight) * FOCUS_ZOOM_SCALE;
}

export function focusShiftX(viewWidth: number, zoom: number) {
	return (-FOCUS_SHIFT * viewWidth) / zoom;
}

function writeFocusPoint(
	model: SceneModel,
	selected: Selection,
	elapsed: number,
	out: Vector3,
	a: [number, number, number],
	b: [number, number, number],
) {
	if (!selected) return false;
	if (selected.kind === "entity") {
		const item = model.entities.find((entry) => entry.id === selected.id);
		if (!item) return false;
		out.fromArray(orbitalPosition(item.orbit, elapsed, a));
		return true;
	}
	if (selected.kind === "task") {
		const item = model.tasks.find((entry) => entry.id === selected.id);
		if (!item) return false;
		out.fromArray(orbitalPosition(item.orbit, elapsed, a));
		return true;
	}
	if (selected.kind === "stage") {
		const item = model.stages.find(
			(entry) =>
				entry.pipelineId === selected.pipelineId && entry.id === selected.id,
		);
		if (!item) return false;
		out.fromArray(orbitalPosition(item.orbit, elapsed, a));
		return true;
	}
	if (selected.kind === "boundary") {
		const item = model.boundaries.find((entry) => entry.id === selected.id);
		if (!item) return false;
		const from = orbitalPosition(item.fromOrbit, elapsed, a);
		const to = orbitalPosition(item.toOrbit, elapsed, b);
		out.set(
			(from[0] + to[0]) / 2,
			(from[1] + to[1]) / 2,
			(from[2] + to[2]) / 2,
		);
		return true;
	}
	const stages = model.stages.filter(
		(entry) => entry.pipelineId === selected.id,
	);
	if (!stages.length) return false;
	out.set(0, 0, 0);
	for (const stage of stages) {
		const point = orbitalPosition(stage.orbit, elapsed, a);
		out.x += point[0];
		out.y += point[1];
		out.z += point[2];
	}
	out.multiplyScalar(1 / stages.length);
	return true;
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

function SceneCamera({
	model,
	selected,
}: {
	model: SceneModel;
	selected: Selection;
}) {
	const camera = useThree((state) => state.camera);
	const size = useThree((state) => state.size);
	const invalidate = useThree((state) => state.invalidate);
	const canvas = useThree((state) => state.gl.domElement);
	const surface = canvas.closest<HTMLElement>(".spatial-canvas") ?? canvas;
	const clock = useOrbitClock();
	const basePosition = useRef(camera.position.clone());
	const overviewZoom = useRef(camera.zoom);
	const userPan = useRef(new Vector3());
	const userZoom = useRef(1);
	const currentPan = useRef(new Vector3());
	const currentZoom = useRef(camera.zoom);
	const reduced = useRef(false);
	const selectedRef = useRef(selected);
	const modelRef = useRef(model);
	selectedRef.current = selected;
	modelRef.current = model;
	const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null);
	const scratch = useMemo(
		() => ({
			point: new Vector3(),
			cam: new Vector3(),
			targetPan: new Vector3(),
			right: new Vector3(),
			up: new Vector3(),
			inverse: new Quaternion(),
			a: [0, 0, 0] as [number, number, number],
			b: [0, 0, 0] as [number, number, number],
		}),
		[],
	);
	const publishCameraState = useCallback(() => {
		canvas.dataset.cameraZoom = camera.zoom.toFixed(3);
		canvas.dataset.cameraPan = [
			currentPan.current.x,
			currentPan.current.y,
			currentPan.current.z,
		]
			.map((value) => value.toFixed(3))
			.join(",");
	}, [camera, canvas]);
	useEffect(() => {
		const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => {
			reduced.current = preference.matches;
		};
		update();
		preference.addEventListener("change", update);
		return () => preference.removeEventListener("change", update);
	}, []);
	useEffect(() => {
		if (!(camera instanceof OrthographicCamera)) return;
		overviewZoom.current = overviewZoomFor(size.width, size.height);
		if (!selectedRef.current) {
			currentZoom.current = overviewZoom.current * userZoom.current;
			currentPan.current.copy(userPan.current);
			camera.position.copy(basePosition.current).add(currentPan.current);
			camera.zoom = currentZoom.current;
			camera.updateMatrixWorld();
			camera.updateProjectionMatrix();
			publishCameraState();
		}
		invalidate();
	}, [camera, size.width, size.height, invalidate, publishCameraState]);
	useFrame((_, delta) => {
		if (!(camera instanceof OrthographicCamera)) return;
		const focused = writeFocusPoint(
			modelRef.current,
			selectedRef.current,
			clock.current,
			scratch.point,
			scratch.a,
			scratch.b,
		);
		let targetZoom = overviewZoom.current * userZoom.current;
		scratch.targetPan.copy(userPan.current);
		if (focused) {
			targetZoom = focusZoomFor(size.width, size.height);
			scratch.inverse.copy(camera.quaternion).invert();
			scratch.cam
				.copy(scratch.point)
				.sub(basePosition.current)
				.applyQuaternion(scratch.inverse);
			scratch.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
			scratch.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
			scratch.targetPan
				.copy(scratch.right)
				.multiplyScalar(scratch.cam.x - focusShiftX(size.width, targetZoom))
				.addScaledVector(scratch.up, scratch.cam.y);
		}
		const step = reduced.current
			? 1
			: 1 - Math.exp(-Math.min(delta, 0.05) * 6.5);
		currentPan.current.lerp(scratch.targetPan, step);
		currentZoom.current += (targetZoom - currentZoom.current) * step;
		camera.position.copy(basePosition.current).add(currentPan.current);
		camera.zoom = currentZoom.current;
		camera.updateMatrixWorld();
		camera.updateProjectionMatrix();
		publishCameraState();
		if (
			focused ||
			Math.abs(currentZoom.current - targetZoom) > 0.05 ||
			currentPan.current.distanceTo(scratch.targetPan) > 0.002
		)
			invalidate();
	});
	useEffect(() => {
		if (!(camera instanceof OrthographicCamera)) return;
		const right = new Vector3();
		const up = new Vector3();
		const moveView = (x: number, y: number) => {
			right.set(1, 0, 0).applyQuaternion(camera.quaternion);
			up.set(0, 1, 0).applyQuaternion(camera.quaternion);
			userPan.current.addScaledVector(right, x).addScaledVector(up, y);
			currentPan.current.copy(userPan.current);
			camera.position.copy(basePosition.current).add(currentPan.current);
			camera.updateMatrixWorld();
			publishCameraState();
			invalidate();
		};
		const zoomBy = (delta: number, clientX: number, clientY: number) => {
			const nextFactor = Math.min(
				4,
				Math.max(0.45, userZoom.current * Math.exp(-delta * 0.0012)),
			);
			const previousZoom = camera.zoom;
			const nextZoom = overviewZoom.current * nextFactor;
			if (nextZoom === previousZoom) return;
			const rect = canvas.getBoundingClientRect();
			const x = clientX - rect.left - rect.width / 2;
			const y = clientY - rect.top - rect.height / 2;
			userZoom.current = nextFactor;
			currentZoom.current = nextZoom;
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
			if (selectedRef.current) return;
			const delta =
				event.deltaY *
				(event.deltaMode === 1
					? 16
					: event.deltaMode === 2
						? canvas.clientHeight
						: 1);
			zoomBy(delta, event.clientX, event.clientY);
		};
		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 2 || selectedRef.current) return;
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
		return () => {
			surface.removeEventListener("wheel", onWheel);
			surface.removeEventListener("pointerdown", onPointerDown);
			surface.removeEventListener("pointermove", onPointerMove);
			surface.removeEventListener("pointerup", onPointerEnd);
			surface.removeEventListener("pointercancel", onPointerEnd);
			surface.removeEventListener("lostpointercapture", onPointerEnd);
			surface.removeEventListener("contextmenu", onContextMenu);
			canvas.style.cursor = "";
		};
	}, [camera, canvas, surface, invalidate, publishCameraState]);
	return null;
}

function HoverSelectionSphere({
	radius,
	onClick,
	hovered,
	onHoverChange,
}: {
	radius: number;
	onClick: () => void;
	hovered: boolean;
	onHoverChange: (hovered: boolean) => void;
}) {
	const particles = useMemo(() => {
		const positions: number[] = [];
		const count = 640;
		const goldenAngle = Math.PI * (3 - Math.sqrt(5));
		for (let index = 0; index < count; index++) {
			const y = 1 - (index / (count - 1)) * 2;
			const width = Math.sqrt(1 - y * y);
			const angle = index * goldenAngle;
			const shell = radius * (0.85 + (((index * 37) % 101) / 101) * 0.15);
			positions.push(
				Math.cos(angle) * width * shell,
				y * shell,
				Math.sin(angle) * width * shell,
			);
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
		return geometry;
	}, [radius]);
	useEffect(() => () => particles.dispose(), [particles]);
	return (
		<>
			<mesh
				onPointerOver={(event) => {
					event.stopPropagation();
					onHoverChange(true);
				}}
				onPointerOut={(event) => {
					event.stopPropagation();
					onHoverChange(false);
				}}
				onClick={(event) => {
					event.stopPropagation();
					onClick();
				}}
			>
				<sphereGeometry args={[radius, 16, 12]} />
				<meshBasicMaterial
					color="#ffffff"
					transparent
					opacity={0}
					depthWrite={false}
					toneMapped={false}
				/>
			</mesh>
			<points geometry={particles} visible={hovered} raycast={() => {}}>
				<pointsMaterial
					color="#e9f7ff"
					size={0.047}
					sizeAttenuation
					transparent
					opacity={0.86}
					depthWrite={false}
					blending={AdditiveBlending}
					toneMapped={false}
				/>
			</points>
		</>
	);
}

function TaskGlyph({
	task,
	selected,
	onClick,
	hovered,
	onHoverChange,
}: {
	task: SceneModel["tasks"][number];
	selected: boolean;
	onClick: () => void;
	hovered: boolean;
	onHoverChange: (hovered: boolean) => void;
}) {
	const color = selected
		? "#ffffff"
		: task.state === "failed" || task.state === "blocked"
			? "#ff6b7b"
			: task.state === "completed"
				? "#61d6bd"
				: "#f5b375";
	const tint = useRef<Group>(null);
	useSmoothTint(tint, color);
	return (
		<group
			ref={tint}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			<group>
				<HoverSelectionSphere
					radius={0.76}
					onClick={onClick}
					hovered={hovered}
					onHoverChange={onHoverChange}
				/>
				<ParticleSymbol
					shape="task-particle"
					color={color}
					selected={selected}
				/>
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
		</group>
	);
}

function StageGlyph({
	stage,
	selected,
	active,
	onClick,
	hovered,
	onHoverChange,
}: {
	stage: SceneModel["stages"][number];
	selected: boolean;
	active: boolean;
	onClick: () => void;
	hovered: boolean;
	onHoverChange: (hovered: boolean) => void;
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
	const tint = useRef<Group>(null);
	useSmoothTint(tint, color);
	return (
		<group
			ref={tint}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			<group>
				<HoverSelectionSphere
					radius={0.82}
					onClick={onClick}
					hovered={hovered}
					onHoverChange={onHoverChange}
				/>
				<StageCore
					symbol={stage.id}
					kind={stage.kind}
					active={processing}
					selected={selected}
					color={color}
				/>
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
		</group>
	);
}

function StageCore({
	symbol,
	kind,
	active,
	selected,
	color,
}: {
	symbol: string;
	kind: SceneModel["stages"][number]["kind"];
	active: boolean;
	selected: boolean;
	color: string;
}) {
	const group = useRef<Group>(null);
	const moving = useRef(false);
	const motion = useRef(0);
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
	useFrame(({ clock }, delta) => {
		if (!group.current) return;
		motion.current +=
			((moving.current ? 1 : 0) - motion.current) *
			(1 - Math.exp(-Math.min(delta, 0.05) * 3));
		group.current.scale.setScalar(
			1 + 0.025 * motion.current * Math.sin(clock.elapsedTime * 1.3),
		);
	});
	useEffect(() => {
		group.current?.traverse((object) => {
			const material = (object as Mesh).material;
			for (const entry of Array.isArray(material) ? material : [material]) {
				if (!(entry instanceof MeshBasicMaterial)) continue;
				entry.transparent = true;
				if (entry.userData.baseOpacity === undefined)
					entry.userData.baseOpacity = entry.opacity;
				const baseOpacity = entry.userData.baseOpacity as number;
				entry.opacity = Math.min(baseOpacity, active ? 0.38 : 0.12);
				entry.depthWrite = false;
				entry.needsUpdate = true;
			}
		});
	}, [active]);
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
				selected={selected}
				active={active}
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
						<SynapseLink
							fromOrbit={from}
							toOrbit={to}
							highlighted={selected}
							color={selected ? "#ffffff" : "#dc9d69"}
							onClick={onClick}
						/>
					</group>
				);
			})}
		</group>
	);
}

function SynapseLink({
	fromOrbit,
	toOrbit,
	start = 0,
	end = 1,
	highlighted = false,
	color,
	onClick,
}: {
	fromOrbit: Orbit;
	toOrbit: Orbit;
	start?: number;
	end?: number;
	highlighted?: boolean;
	color: string;
	onClick: () => void;
}) {
	const clock = useOrbitClock();
	const targetColor = useMemo(() => new Color(color), [color]);
	const initialColor = useRef(color);
	const invalidate = useThree((state) => state.invalidate);
	const hit = useRef<Group>(null);
	const paths = useMemo(
		() =>
			Array.from({ length: 3 }, () => {
				const geometry = new BufferGeometry();
				geometry.setAttribute(
					"position",
					new Float32BufferAttribute(new Float32Array(17 * 3), 3),
				);
				return geometry;
			}),
		[],
	);
	const lines = useMemo(
		() =>
			paths.map(
				(geometry, index) =>
					new Line(
						geometry,
						new LineBasicMaterial({
							color: initialColor.current,
							transparent: true,
							opacity:
								index === 1
									? highlighted
										? 0.9
										: 0.55
									: highlighted
										? 0.45
										: 0.25,
							toneMapped: false,
						}),
					),
			),
		[paths, highlighted],
	);
	useEffect(
		() => () =>
			lines.forEach((line) => {
				line.material.dispose();
			}),
		[lines],
	);
	const scratch = useMemo(
		() => ({
			from: new Vector3(),
			to: new Vector3(),
			axis: new Vector3(),
			bend: new Vector3(),
			side: new Vector3(),
			point: new Vector3(),
			up: new Vector3(0, 1, 0),
			a: [0, 0, 0] as [number, number, number],
			b: [0, 0, 0] as [number, number, number],
		}),
		[],
	);
	useEffect(
		() => () =>
			paths.forEach((path) => {
				path.dispose();
			}),
		[paths],
	);
	useFrame((_, delta) => {
		for (const line of lines) {
			if (!line.material.color.equals(targetColor)) {
				line.material.color.lerp(
					targetColor,
					1 - Math.exp(-Math.min(delta, 0.05) * 4),
				);
				invalidate();
			}
		}
		scratch.from.fromArray(
			orbitalPosition(fromOrbit, clock.current, scratch.a),
		);
		scratch.to.fromArray(orbitalPosition(toOrbit, clock.current, scratch.b));
		scratch.axis.copy(scratch.to).sub(scratch.from);
		const length = scratch.axis.length();
		if (length < 0.01) return;
		scratch.axis.multiplyScalar(1 / length);
		scratch.bend.set(-scratch.axis.z, 0.35, scratch.axis.x).normalize();
		scratch.side.crossVectors(scratch.axis, scratch.bend).normalize();
		const bendSize = Math.min(length * 0.16, 0.85);
		for (const [branch, path] of paths.entries()) {
			const attribute = path.getAttribute("position");
			for (let index = 0; index <= 16; index++) {
				const u = index / 16;
				const fraction = start + u * (end - start);
				const t = 0.09 + fraction * 0.78;
				const spread = (branch - 1) * 0.12 * Math.sin(u * Math.PI);
				scratch.point
					.copy(scratch.from)
					.lerp(scratch.to, t)
					.addScaledVector(
						scratch.bend,
						Math.sin(t * Math.PI) * bendSize + spread,
					);
				if (branch !== 1)
					scratch.point.addScaledVector(
						scratch.side,
						Math.sin(u * Math.PI) *
							(Math.sin(u * Math.PI * 2 + branch * 1.7) * 0.045 +
								(branch - 1) * 0.04),
					);
				attribute.setXYZ(
					index,
					scratch.point.x,
					scratch.point.y,
					scratch.point.z,
				);
			}
			attribute.needsUpdate = true;
			path.computeBoundingSphere();
		}
		if (hit.current) {
			hit.current.position
				.copy(scratch.from)
				.add(scratch.to)
				.multiplyScalar(0.5);
			hit.current.quaternion.setFromUnitVectors(scratch.up, scratch.axis);
			hit.current.scale.set(1, length, 1);
		}
	});
	return (
		<group>
			{lines.map((line) => (
				<primitive key={line.uuid} object={line} />
			))}
			<group ref={hit}>
				<mesh
					onClick={(event) => {
						event.stopPropagation();
						onClick();
					}}
				>
					<cylinderGeometry args={[0.12, 0.12, 1, 6]} />
					<meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
				</mesh>
			</group>
		</group>
	);
}

function EntityGlyph({
	entity,
	selected,
	onClick,
	hovered,
	onHoverChange,
}: {
	entity: SceneModel["entities"][number];
	selected: boolean;
	onClick: () => void;
	hovered: boolean;
	onHoverChange: (hovered: boolean) => void;
}) {
	const radius =
		entity.kind === "agent" || entity.kind === "system" ? 0.57 : 0.43;
	const color = selected ? "#ffffff" : entityVisualColor(entity);
	const symbol =
		entity.id === "context-search"
			? "embedding"
			: entity.id === "runtime"
				? "harness"
				: entity.id === "physical-host"
					? "laptop"
					: entity.id === "llm"
						? "brain"
						: entity.id === "memory"
							? "head"
							: entity.id === "physical-load"
								? "thermometer"
								: entity.id === "physical-memory"
									? "dimm"
									: entity.id === "physical-cpu"
										? "processor"
										: entity.id === "physical-disk"
											? "ssd"
											: entity.symbol;
	const tint = useRef<Group>(null);
	useSmoothTint(tint, color);
	return (
		<group
			ref={tint}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			<group>
				<HoverSelectionSphere
					radius={radius === 0.57 ? 0.94 : 0.76}
					onClick={onClick}
					hovered={hovered}
					onHoverChange={onHoverChange}
				/>
				<ServiceSymbol
					symbol={symbol}
					color={color}
					size={radius}
					ghost
					ghostOpacity={
						entity.id === "context-recall" || entity.id === "context-search"
							? 0.06
							: 0.17
					}
				/>
				<ParticleSymbol
					shape={symbol}
					emphasized={entity.id === "context-search"}
					color={color}
					size={radius / 0.43}
					selected={selected}
				/>
			</group>
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
				<SynapseLink
					key={`${start}-${end}`}
					fromOrbit={fromOrbit}
					toOrbit={toOrbit}
					highlighted={selected}
					start={start}
					end={end}
					color={color}
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
	const [hoveredTarget, setHoveredTarget] = useState<Selection>(null);
	const hoveredTargetRef = useRef<Selection>(null);
	const sameTarget = (a: Selection, b: Selection) =>
		a?.kind === b?.kind &&
		a?.id === b?.id &&
		(a?.kind !== "stage" ||
			(b?.kind === "stage" && a.pipelineId === b.pipelineId));
	const hover = (target: NonNullable<Selection>, active: boolean) => {
		if (active) {
			hoveredTargetRef.current = target;
			setHoveredTarget(target);
		} else if (sameTarget(hoveredTargetRef.current, target)) {
			hoveredTargetRef.current = null;
			setHoveredTarget(null);
		}
	};
	const inspection = useMemo(
		() => inspectionDetails(model, selected),
		[model, selected],
	);
	const choose = (target: NonNullable<Selection>) => {
		const next = selected
			? null
			: selectionFromClick(selected, hoveredTargetRef.current ?? target);
		if (next !== selected) onSelect(next);
	};
	return (
		<>
			<color attach="background" args={["#080d1b"]} />
			<ambientLight intensity={0.65} />
			<directionalLight position={[3, 8, 5]} intensity={1.2} />
			<OrbitSystem active={active}>
				<SceneCamera model={model} selected={selected} />
				<UniverseField />
				{model.boundaries.map((boundary) => (
					<Boundary
						key={boundary.id}
						fromOrbit={boundary.fromOrbit}
						toOrbit={boundary.toOrbit}
						health={boundary.health}
						selected={
							selected?.kind === "boundary" && selected.id === boundary.id
						}
						onClick={() => choose({ kind: "boundary", id: boundary.id })}
					/>
				))}
				{model.entities.map((entity) => (
					<OrbitAnchor key={entity.id} orbit={entity.orbit}>
						<EntityGlyph
							entity={entity}
							hovered={sameTarget(hoveredTarget, {
								kind: "entity",
								id: entity.id,
							})}
							onHoverChange={(active) =>
								hover({ kind: "entity", id: entity.id }, active)
							}
							selected={
								selected?.kind === "entity" && selected.id === entity.id
							}
							onClick={() => choose({ kind: "entity", id: entity.id })}
						/>
					</OrbitAnchor>
				))}
				{model.tasks.map((task) => (
					<OrbitAnchor key={task.id} orbit={task.orbit}>
						<TaskGlyph
							task={task}
							hovered={sameTarget(hoveredTarget, { kind: "task", id: task.id })}
							onHoverChange={(active) =>
								hover({ kind: "task", id: task.id }, active)
							}
							selected={selected?.kind === "task" && selected.id === task.id}
							onClick={() => choose({ kind: "task", id: task.id })}
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
						onClick={() => choose({ kind: "pipeline", id: pipeline.id })}
					/>
				))}
				{model.stages.map((stage) => (
					<OrbitAnchor
						key={`${stage.pipelineId}:${stage.id}`}
						orbit={stage.orbit}
					>
						<StageGlyph
							stage={stage}
							hovered={sameTarget(hoveredTarget, {
								kind: "stage",
								id: stage.id,
								pipelineId: stage.pipelineId,
							})}
							onHoverChange={(active) =>
								hover(
									{ kind: "stage", id: stage.id, pipelineId: stage.pipelineId },
									active,
								)
							}
							active={active}
							selected={
								selected?.kind === "stage" &&
								selected.id === stage.id &&
								selected.pipelineId === stage.pipelineId
							}
							onClick={() =>
								choose({
									kind: "stage",
									id: stage.id,
									pipelineId: stage.pipelineId,
								})
							}
						/>
					</OrbitAnchor>
				))}
			</OrbitSystem>
			{inspection ? (
				<InspectionPanel
					inspection={inspection}
					onDismiss={() => onSelect(null)}
				/>
			) : null}
		</>
	);
}

export function SceneCanvas(props: Props) {
	const root = useRef<HTMLDivElement>(null);
	const [fullscreen, setFullscreen] = useState(false);
	useEffect(() => {
		const sync = () =>
			setFullscreen(document.fullscreenElement === root.current);
		document.addEventListener("fullscreenchange", sync);
		return () => document.removeEventListener("fullscreenchange", sync);
	}, []);
	return (
		<div className="spatial-canvas" ref={root} data-spatial-canvas="ready">
			<Canvas
				orthographic
				camera={{ position: [0, 16, 16], zoom: 46, near: 0.1, far: 100 }}
				frameloop="demand"
				dpr={[1, 1.5]}
				onPointerMissed={() => props.onSelect(null)}
			>
				<ContextMonitor onContextLost={props.onContextLost} />
				<SceneContent
					model={props.model}
					selected={props.selected}
					onSelect={props.onSelect}
					active={props.active}
				/>
			</Canvas>
			<button
				type="button"
				className="spatial-fullscreen"
				aria-pressed={fullscreen}
				aria-label={fullscreen ? "Exit full screen" : "Full screen"}
				onClick={() => {
					const node = root.current;
					if (!node) return;
					if (document.fullscreenElement === node) {
						void document.exitFullscreen();
						return;
					}
					void node.requestFullscreen().catch(() => undefined);
				}}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					{fullscreen ? (
						<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
					) : (
						<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
					)}
				</svg>
			</button>
		</div>
	);
}
