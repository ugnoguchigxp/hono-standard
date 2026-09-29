import { Shape } from "three";

export const HEAD_CONTOUR: [number, number][] = [
	[-0.38, -0.46],
	[-0.17, -0.38],
	[-0.16, -0.27],
	[-0.31, -0.17],
	[-0.36, 0.02],
	[-0.32, 0.22],
	[-0.2, 0.35],
	[-0.02, 0.4],
	[0.15, 0.35],
	[0.25, 0.25],
	[0.27, 0.12],
	[0.4, 0.04],
	[0.38, -0.01],
	[0.27, -0.04],
	[0.28, -0.08],
	[0.23, -0.11],
	[0.28, -0.15],
	[0.24, -0.22],
	[0.15, -0.27],
	[0.08, -0.31],
	[0.08, -0.38],
	[0.36, -0.46],
];

export const HEAD_ROTATION = -Math.PI / 8;

export const headProfile = new Shape();
headProfile.moveTo(...(HEAD_CONTOUR[0] ?? [0, 0]));
for (const point of HEAD_CONTOUR.slice(1)) headProfile.lineTo(...point);
headProfile.closePath();
