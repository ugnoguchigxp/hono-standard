// biome-ignore-all lint/a11y/noStaticElementInteractions: This Three.js mesh blocks scene selection behind the inspection panel.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type Group, LinearFilter, Vector3 } from "three";
import type { Inspection } from "./inspection-details";

const REFERENCE_VIEW_HEIGHT = 680;
const PADDING = 16;
const COLUMN_GAP = 14;
const MAX_VALUE_WIDTH = 236;
const BODY = 14;
const TITLE = 20;
const KICKER = 12;
const BODY_LINE = 20;
const TITLE_LINE = 26;
const BODY_FONT = `${BODY}px ui-sans-serif, system-ui, sans-serif`;
const TITLE_FONT = `bold ${TITLE}px ui-sans-serif, system-ui, sans-serif`;
const KICKER_FONT = `bold ${KICKER}px ui-sans-serif, system-ui, sans-serif`;
const BUTTON_CLEARANCE = 56;
const EDGE = 16;

export function inspectionTypeScale(viewHeight: number) {
	return Math.max(1, viewHeight) / REFERENCE_VIEW_HEIGHT;
}

function wrap(
	context: CanvasRenderingContext2D,
	value: string,
	width: number,
): string[] {
	const lines: string[] = [];
	let line = "";
	for (const word of value.split(/\s+/)) {
		if (context.measureText(word).width > width) {
			if (line) lines.push(line);
			line = "";
			for (const character of word) {
				if (line && context.measureText(line + character).width > width) {
					lines.push(line);
					line = "";
				}
				line += character;
			}
			continue;
		}
		const next = line ? `${line} ${word}` : word;
		if (line && context.measureText(next).width > width) {
			lines.push(line);
			line = word;
		} else line = next;
	}
	if (line) lines.push(line);
	return lines.length ? lines : [""];
}

function measure(context: CanvasRenderingContext2D, value: string) {
	return context.measureText(value).width;
}

type PanelLayout = {
	cssWidth: number;
	cssHeight: number;
	labelWidth: number;
	kicker: string;
	titleLines: string[];
	content: { label: string; lines: string[] }[];
};

function measureInspection(inspection: Inspection): PanelLayout {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas text rendering is unavailable");
	context.font = BODY_FONT;
	const labelWidth = inspection.rows.reduce(
		(max, row) => Math.max(max, measure(context, row.label)),
		0,
	);
	const valueLimit = MAX_VALUE_WIDTH;
	const content = inspection.rows.map((row) => ({
		label: row.label,
		lines: wrap(context, row.value, valueLimit),
	}));
	const valueWidth = content.reduce(
		(max, row) =>
			Math.max(max, ...row.lines.map((line) => measure(context, line))),
		0,
	);
	const rowWidth = labelWidth + (content.length ? COLUMN_GAP + valueWidth : 0);
	context.font = KICKER_FONT;
	const kicker = `${inspection.kind}  /  SELECTED`;
	const kickerWidth = measure(context, kicker);
	context.font = TITLE_FONT;
	const titleBudget = Math.max(rowWidth, kickerWidth, 220);
	const titleLines = wrap(context, inspection.title, titleBudget);
	const titleWidth = titleLines.reduce(
		(max, line) => Math.max(max, measure(context, line)),
		0,
	);
	const cssWidth = Math.ceil(
		Math.max(rowWidth, kickerWidth, titleWidth) + PADDING * 2,
	);
	const rowsBlock = content.reduce(
		(sum, row) => sum + row.lines.length * BODY_LINE + 6,
		0,
	);
	const cssHeight = Math.ceil(
		PADDING +
			KICKER +
			14 +
			titleLines.length * TITLE_LINE +
			20 +
			rowsBlock +
			PADDING,
	);
	return { cssWidth, cssHeight, labelWidth, kicker, titleLines, content };
}

function makeTexture(layout: PanelLayout, pixelRatio: number, scale: number) {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas text rendering is unavailable");
	const ratio = Math.min(2, Math.max(1, pixelRatio));
	const { cssWidth, cssHeight, labelWidth, kicker, titleLines, content } =
		layout;
	canvas.width = Math.max(1, Math.ceil(cssWidth * scale * ratio));
	canvas.height = Math.max(1, Math.ceil(cssHeight * scale * ratio));
	context.setTransform(ratio * scale, 0, 0, ratio * scale, 0, 0);
	context.fillStyle = "#101b30";
	context.fillRect(0, 0, cssWidth, cssHeight);
	context.strokeStyle = "#6b91ba";
	context.lineWidth = 1;
	context.strokeRect(1, 1, cssWidth - 2, cssHeight - 2);
	context.fillStyle = "#8dd9ec";
	context.font = KICKER_FONT;
	let y = PADDING + KICKER;
	context.fillText(kicker, PADDING, y);
	context.fillStyle = "#f5f9ff";
	context.font = TITLE_FONT;
	for (const line of titleLines) {
		y += TITLE_LINE;
		context.fillText(line, PADDING, y - (TITLE_LINE - TITLE));
	}
	context.strokeStyle = "#344b69";
	context.beginPath();
	y += 12;
	context.moveTo(PADDING, y);
	context.lineTo(cssWidth - PADDING, y);
	context.stroke();
	y += 8;
	const valueX = PADDING + labelWidth + COLUMN_GAP;
	for (const row of content) {
		context.fillStyle = "#8da9c7";
		context.font = BODY_FONT;
		context.fillText(row.label, PADDING, y + BODY);
		context.fillStyle = "#f1f7ff";
		for (const line of row.lines) {
			context.fillText(line, valueX, y + BODY);
			y += BODY_LINE;
		}
		y += 6;
	}
	const texture = new CanvasTexture(canvas);
	texture.minFilter = LinearFilter;
	texture.magFilter = LinearFilter;
	texture.generateMipmaps = false;
	return { texture, cssWidth: cssWidth * scale, cssHeight: cssHeight * scale };
}

export function inspectionPlacement(input: {
	viewWidth: number;
	viewHeight: number;
	panelWidth: number;
	panelHeight: number;
}) {
	const availableHeight = Math.max(
		1,
		input.viewHeight - BUTTON_CLEARANCE - EDGE,
	);
	const availableWidth = Math.max(1, input.viewWidth - EDGE * 2);
	const fit = Math.min(
		1,
		availableWidth / Math.max(1, input.panelWidth),
		availableHeight / Math.max(1, input.panelHeight),
	);
	const width = input.panelWidth * fit;
	const height = input.panelHeight * fit;
	let top = (input.viewHeight - height) / 2;
	if (top < BUTTON_CLEARANCE) top = BUTTON_CLEARANCE;
	return { width, height, top, right: EDGE };
}

export function InspectionPanel({
	inspection,
	onDismiss,
}: {
	inspection: Inspection;
	onDismiss: () => void;
}) {
	const group = useRef<Group>(null);
	const camera = useThree((state) => state.camera);
	const size = useThree((state) => state.size);
	const pixelRatio = useThree((state) => state.viewport.dpr);
	const invalidate = useThree((state) => state.invalidate);
	const layout = useMemo(() => measureInspection(inspection), [inspection]);
	const fitted = inspectionPlacement({
		viewWidth: size.width,
		viewHeight: size.height,
		panelWidth: layout.cssWidth * inspectionTypeScale(size.height),
		panelHeight: layout.cssHeight * inspectionTypeScale(size.height),
	});
	const drawScale =
		Math.round((fitted.width / Math.max(1, layout.cssWidth)) * 100) / 100;
	const rendered = useMemo(
		() => makeTexture(layout, pixelRatio, drawScale),
		[layout, pixelRatio, drawScale],
	);
	const scratch = useRef(new Vector3());
	useEffect(() => {
		invalidate();
		return () => rendered.texture.dispose();
	}, [rendered, invalidate]);
	useFrame(() => {
		if (!group.current) return;
		const place = inspectionPlacement({
			viewWidth: size.width,
			viewHeight: size.height,
			panelWidth: rendered.cssWidth,
			panelHeight: rendered.cssHeight,
		});
		const zoom = camera.zoom;
		scratch.current.set(
			(size.width / 2 - place.width / 2 - place.right) / zoom,
			(size.height / 2 - place.height / 2 - place.top) / zoom,
			-5,
		);
		group.current.position.copy(camera.localToWorld(scratch.current));
		group.current.quaternion.copy(camera.quaternion);
		group.current.scale.set(place.width / zoom, place.width / zoom, 1);
	});
	return (
		<group ref={group}>
			<mesh
				renderOrder={1000}
				onClick={(event) => {
					event.stopPropagation();
					onDismiss();
				}}
			>
				<planeGeometry args={[1, rendered.cssHeight / rendered.cssWidth]} />
				<meshBasicMaterial
					map={rendered.texture}
					transparent
					depthTest={false}
					depthWrite={false}
					toneMapped={false}
				/>
			</mesh>
		</group>
	);
}
