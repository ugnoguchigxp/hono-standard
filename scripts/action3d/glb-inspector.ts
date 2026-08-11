type GltfAccessor = {
	count?: number;
	min?: number[];
	max?: number[];
};
type GltfPrimitive = {
	attributes?: Record<string, number>;
	indices?: number;
	mode?: number;
};
type GltfMesh = { name?: string; primitives?: GltfPrimitive[] };
type GltfNode = {
	name?: string;
	mesh?: number;
	children?: number[];
	matrix?: number[];
	translation?: number[];
	rotation?: number[];
	scale?: number[];
};
type GltfAnimation = {
	name?: string;
	samplers?: Array<{ input?: number }>;
	channels?: Array<{
		target?: {
			node?: number;
			path?: "rotation" | "scale" | "translation" | "weights";
		};
	}>;
};
type GltfDocument = {
	asset?: { generator?: string; version?: string };
	scene?: number;
	scenes?: Array<{ nodes?: number[] }>;
	nodes?: GltfNode[];
	meshes?: GltfMesh[];
	materials?: Array<{ name?: string }>;
	textures?: unknown[];
	images?: Array<{ bufferView?: number; mimeType?: string }>;
	bufferViews?: Array<{ byteOffset?: number; byteLength?: number }>;
	accessors?: GltfAccessor[];
	animations?: GltfAnimation[];
	skins?: Array<{ name?: string; joints?: number[]; skeleton?: number }>;
};

export type Action3dGlbBounds = {
	min: [number, number, number];
	max: [number, number, number];
	width: number;
	height: number;
	depth: number;
};
export type Action3dGlbReport = {
	generator: string;
	nodes: string[];
	meshNodes: string[];
	materials: string[];
	clips: Array<{
		name: string;
		durationMs: number;
		rotationBones: number;
		translationBones: number;
	}>;
	skeletons: Array<{ name: string; bones: number }>;
	triangles: number;
	primitives: number;
	textures: number;
	maxTextureSize: number;
	maxBoneInfluences: number;
	bounds: Action3dGlbBounds | null;
};

const GLB_MAGIC = 0x4654_6c67;
const JSON_CHUNK = 0x4e4f_534a;
const BIN_CHUNK = 0x004e_4942;
const identity = (): number[] => [
	1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
];
const multiply = (a: number[], b: number[]) => {
	const result = new Array<number>(16).fill(0);
	for (let column = 0; column < 4; column += 1)
		for (let row = 0; row < 4; row += 1)
			for (let index = 0; index < 4; index += 1)
				result[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
	return result;
};
const localMatrix = (node: GltfNode) => {
	if (node.matrix?.length === 16) return [...node.matrix];
	const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
	const [sx, sy, sz] = node.scale ?? [1, 1, 1];
	const [tx, ty, tz] = node.translation ?? [0, 0, 0];
	const xx = x * x;
	const yy = y * y;
	const zz = z * z;
	const xy = x * y;
	const xz = x * z;
	const yz = y * z;
	const wx = w * x;
	const wy = w * y;
	const wz = w * z;
	return [
		(1 - 2 * (yy + zz)) * sx,
		2 * (xy + wz) * sx,
		2 * (xz - wy) * sx,
		0,
		2 * (xy - wz) * sy,
		(1 - 2 * (xx + zz)) * sy,
		2 * (yz + wx) * sy,
		0,
		2 * (xz + wy) * sz,
		2 * (yz - wx) * sz,
		(1 - 2 * (xx + yy)) * sz,
		0,
		tx,
		ty,
		tz,
		1,
	];
};
const transformPoint = (matrix: number[], point: number[]) =>
	[
		matrix[0] * point[0] +
			matrix[4] * point[1] +
			matrix[8] * point[2] +
			matrix[12],
		matrix[1] * point[0] +
			matrix[5] * point[1] +
			matrix[9] * point[2] +
			matrix[13],
		matrix[2] * point[0] +
			matrix[6] * point[1] +
			matrix[10] * point[2] +
			matrix[14],
	] as const;
const triangleCount = (primitive: GltfPrimitive, accessors: GltfAccessor[]) => {
	const count =
		(primitive.indices === undefined
			? accessors[primitive.attributes?.POSITION ?? -1]?.count
			: accessors[primitive.indices]?.count) ?? 0;
	switch (primitive.mode ?? 4) {
		case 4:
			return Math.floor(count / 3);
		case 5:
		case 6:
			return Math.max(0, count - 2);
		default:
			return 0;
	}
};
const parseTextureSize = (bytes: Uint8Array, mimeType?: string) => {
	if (
		(mimeType === "image/png" ||
			(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e)) &&
		bytes.length >= 24
	) {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return Math.max(view.getUint32(16), view.getUint32(20));
	}
	return 0;
};

export const parseAction3dGlb = (input: ArrayBufferLike): Action3dGlbReport => {
	const view = new DataView(input);
	if (view.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC)
		throw new Error("Model is not a binary glTF file.");
	if (view.getUint32(4, true) !== 2)
		throw new Error("Only glTF 2.0 models are supported.");
	if (view.getUint32(8, true) !== view.byteLength)
		throw new Error("GLB header length does not match the file size.");
	let offset = 12;
	let json: GltfDocument | null = null;
	let binary: Uint8Array<ArrayBufferLike> = new Uint8Array();
	while (offset + 8 <= view.byteLength) {
		const length = view.getUint32(offset, true);
		const type = view.getUint32(offset + 4, true);
		const start = offset + 8;
		const end = start + length;
		if (end > view.byteLength)
			throw new Error("GLB chunk exceeds the file length.");
		if (type === JSON_CHUNK) {
			const text = new TextDecoder()
				.decode(new Uint8Array(input, start, length))
				.replaceAll(String.fromCharCode(0), "")
				.trimEnd();
			json = JSON.parse(text) as GltfDocument;
		} else if (type === BIN_CHUNK)
			binary = new Uint8Array(input, start, length);
		offset = end;
	}
	if (!json) throw new Error("GLB does not contain a JSON chunk.");
	if (json.asset?.version !== "2.0")
		throw new Error("GLB asset version is not 2.0.");

	const nodes = json.nodes ?? [];
	const meshes = json.meshes ?? [];
	const accessors = json.accessors ?? [];
	const skeletonBones = new Set(
		(json.skins ?? []).flatMap((skin) => skin.joints ?? []),
	);
	const worldMatrices = new Map<number, number[]>();
	const visit = (nodeIndex: number, parent: number[]) => {
		const node = nodes[nodeIndex];
		if (!node) return;
		const world = multiply(parent, localMatrix(node));
		worldMatrices.set(nodeIndex, world);
		for (const child of node.children ?? []) visit(child, world);
	};
	const childNodes = new Set(nodes.flatMap((node) => node.children ?? []));
	const roots =
		json.scenes?.[json.scene ?? 0]?.nodes ??
		nodes.flatMap((_, index) => (childNodes.has(index) ? [] : [index]));
	for (const root of roots) visit(root, identity());

	const boundMin = [
		Number.POSITIVE_INFINITY,
		Number.POSITIVE_INFINITY,
		Number.POSITIVE_INFINITY,
	];
	const boundMax = [
		Number.NEGATIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
	];
	const meshNodeNames: string[] = [];
	let triangles = 0;
	let primitives = 0;
	let maxBoneInfluences = 0;
	nodes.forEach((node, nodeIndex) => {
		if (node.mesh === undefined) return;
		if (node.name) meshNodeNames.push(node.name);
		const mesh = meshes[node.mesh];
		if (!mesh) return;
		for (const primitive of mesh.primitives ?? []) {
			primitives += 1;
			triangles += triangleCount(primitive, accessors);
			if (primitive.attributes?.JOINTS_1 !== undefined)
				maxBoneInfluences = Math.max(maxBoneInfluences, 8);
			else if (primitive.attributes?.JOINTS_0 !== undefined)
				maxBoneInfluences = Math.max(maxBoneInfluences, 4);
			const accessor = accessors[primitive.attributes?.POSITION ?? -1];
			if (!accessor?.min || !accessor.max) continue;
			const matrix = worldMatrices.get(nodeIndex) ?? identity();
			for (const x of [accessor.min[0], accessor.max[0]])
				for (const y of [accessor.min[1], accessor.max[1]])
					for (const z of [accessor.min[2], accessor.max[2]]) {
						const point = transformPoint(matrix, [x, y, z]);
						for (let axis = 0; axis < 3; axis += 1) {
							boundMin[axis] = Math.min(boundMin[axis], point[axis]);
							boundMax[axis] = Math.max(boundMax[axis], point[axis]);
						}
					}
		}
	});

	let maxTextureSize = 0;
	for (const image of json.images ?? []) {
		if (image.bufferView === undefined) continue;
		const bufferView = json.bufferViews?.[image.bufferView];
		if (!bufferView?.byteLength) continue;
		const start = bufferView.byteOffset ?? 0;
		maxTextureSize = Math.max(
			maxTextureSize,
			parseTextureSize(
				binary.subarray(start, start + bufferView.byteLength),
				image.mimeType,
			),
		);
	}
	const hasBounds =
		boundMin.every(Number.isFinite) && boundMax.every(Number.isFinite);
	return {
		generator: json.asset.generator ?? "unknown",
		nodes: nodes.flatMap((node) => (node.name ? [node.name] : [])),
		meshNodes: meshNodeNames,
		materials: (json.materials ?? []).flatMap((value) =>
			value.name ? [value.name] : [],
		),
		clips: (json.animations ?? []).map((animation, index) => {
			const durationSeconds = Math.max(
				0,
				...(animation.samplers ?? []).map((sampler) =>
					Math.max(0, ...(accessors[sampler.input ?? -1]?.max ?? [0])),
				),
			);
			const targetBones = (path: "rotation" | "translation") =>
				new Set(
					(animation.channels ?? []).flatMap((channel) => {
						const node = channel.target?.node;
						return channel.target?.path === path &&
							node !== undefined &&
							skeletonBones.has(node)
							? [node]
							: [];
					}),
				).size;
			return {
				name: animation.name ?? `animation-${index}`,
				durationMs: Math.round(durationSeconds * 1_000),
				rotationBones: targetBones("rotation"),
				translationBones: targetBones("translation"),
			};
		}),
		skeletons: (json.skins ?? []).map((skin, index) => ({
			name: skin.name ?? `skin-${index}`,
			bones: skin.joints?.length ?? 0,
		})),
		triangles,
		primitives,
		textures: json.textures?.length ?? 0,
		maxTextureSize,
		maxBoneInfluences,
		bounds: hasBounds
			? {
					min: boundMin as [number, number, number],
					max: boundMax as [number, number, number],
					width: boundMax[0] - boundMin[0],
					height: boundMax[1] - boundMin[1],
					depth: boundMax[2] - boundMin[2],
				}
			: null,
	};
};
