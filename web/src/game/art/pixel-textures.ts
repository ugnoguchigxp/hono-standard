import type Phaser from "phaser";

const outline = 0x0a1020;
const skin = 0xdca77d;
const skinLight = 0xf3c99b;
const skinShadow = 0xa96556;
const leather = 0x70462e;
const leatherDark = 0x3e2b25;
const gold = 0xe5b957;
const goldLight = 0xf5d982;
const steel = 0x8294a3;
const steelLight = 0xbac8cf;
const steelDark = 0x3b4a5c;

export const FIELD_CHARACTER_TEXTURE_WIDTH = 32;
export const FIELD_CHARACTER_TEXTURE_HEIGHT = 40;

type CharacterRole = "hero" | "warrior" | "mage";

type CharacterPalette = {
	role: CharacterRole;
	main: number;
	shadow: number;
	highlight: number;
	accent: number;
	trim: number;
	hair: number;
};

export type FieldSpriteFacing = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type FieldWalkFrame = 0 | 1 | 2;
type TextureDirection = "up" | "down" | "side";

const characterPalettes: Record<string, CharacterPalette> = {
	"field-mira": {
		role: "hero",
		main: 0x376db3,
		shadow: 0x254474,
		highlight: 0x70a4d4,
		accent: 0xb94746,
		trim: gold,
		hair: 0x493026,
	},
	"field-sol": {
		role: "warrior",
		main: 0x607789,
		shadow: 0x344554,
		highlight: 0x9eb2bd,
		accent: 0xb94d3d,
		trim: 0xd29545,
		hair: 0x332821,
	},
	"field-lune": {
		role: "mage",
		main: 0x5b458d,
		shadow: 0x30294f,
		highlight: 0x967dc2,
		accent: 0x58b9bd,
		trim: 0xe6d7aa,
		hair: 0xd6c9b8,
	},
};

const fill = (
	graphics: Phaser.GameObjects.Graphics,
	color: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void => {
	graphics.fillStyle(color, 1);
	graphics.fillRect(x, y, width, height);
};

const textureDirection = (facing: FieldSpriteFacing): TextureDirection => {
	if (facing === "UP") return "up";
	if (facing === "DOWN") return "down";
	return "side";
};

export const getFieldCharacterTextureKey = (
	baseKey: string,
	facing: FieldSpriteFacing,
	frame: FieldWalkFrame,
): string => `${baseKey}-${textureDirection(facing)}-${frame}`;

export const getBattleCharacterTextureKey = (baseKey: string): string =>
	getFieldCharacterTextureKey(baseKey, "LEFT", 0);

const walkOffsets = (frame: FieldWalkFrame) => ({
	leftStep: frame === 1 ? 1 : 0,
	rightStep: frame === 2 ? 1 : 0,
	leftArm: frame === 1 ? -1 : frame === 2 ? 1 : 0,
	rightArm: frame === 2 ? -1 : frame === 1 ? 1 : 0,
});

const drawHeroFront = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	frame: FieldWalkFrame,
): void => {
	const walk = walkOffsets(frame);
	fill(graphics, outline, 25, 18, 4, 18);
	fill(graphics, steelDark, 26, 21, 2, 13);
	fill(graphics, steelLight, 26, 21, 1, 10);
	fill(graphics, gold, 24, 19, 6, 3);
	fill(graphics, leather, 26, 33, 2, 3);

	fill(graphics, outline, 5, 16, 22, 18);
	fill(graphics, palette.accent, 6, 17, 20, 15);
	fill(graphics, 0x7d3038, 7, 28, 18, 5);

	fill(graphics, outline, 8, 3, 16, 14);
	fill(graphics, palette.hair, 9, 4, 14, 6);
	fill(graphics, palette.hair, 7, 7, 4, 9);
	fill(graphics, palette.hair, 21, 7, 4, 8);
	fill(graphics, skin, 10, 8, 12, 8);
	fill(graphics, skinLight, 11, 8, 7, 2);
	fill(graphics, skinShadow, 19, 10, 3, 5);
	fill(graphics, palette.trim, 8, 6, 16, 2);
	fill(graphics, goldLight, 13, 5, 6, 3);
	fill(graphics, outline, 12, 11, 2, 2);
	fill(graphics, outline, 18, 11, 2, 2);
	fill(graphics, 0xf7e4bb, 13, 11, 1, 1);
	fill(graphics, 0xf7e4bb, 19, 11, 1, 1);
	fill(graphics, skinShadow, 15, 13, 2, 1);

	fill(graphics, outline, 6, 17 + walk.leftArm, 6, 11);
	fill(graphics, outline, 21, 17 + walk.rightArm, 6, 11);
	fill(graphics, gold, 7, 18 + walk.leftArm, 5, 4);
	fill(graphics, goldLight, 8, 18 + walk.leftArm, 3, 2);
	fill(graphics, gold, 21, 18 + walk.rightArm, 5, 4);
	fill(graphics, palette.main, 8, 22 + walk.leftArm, 4, 5);
	fill(graphics, palette.shadow, 21, 22 + walk.rightArm, 4, 5);
	fill(graphics, outline, 9, 17, 14, 15);
	fill(graphics, palette.main, 10, 18, 12, 13);
	fill(graphics, palette.highlight, 11, 18, 7, 3);
	fill(graphics, palette.trim, 15, 18, 2, 10);
	fill(graphics, leatherDark, 9, 27, 14, 4);
	fill(graphics, gold, 14, 27, 4, 4);
	fill(graphics, outline, 9, 30 + walk.leftStep, 7, 9);
	fill(graphics, outline, 17, 30 + walk.rightStep, 7, 9);
	fill(graphics, palette.shadow, 10, 31 + walk.leftStep, 5, 6);
	fill(graphics, palette.shadow, 18, 31 + walk.rightStep, 5, 6);
	fill(graphics, leatherDark, 9, 36 + walk.leftStep, 7, 3);
	fill(graphics, leatherDark, 17, 36 + walk.rightStep, 7, 3);
};

const drawHeroBack = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	frame: FieldWalkFrame,
): void => {
	const walk = walkOffsets(frame);
	fill(graphics, outline, 24, 16, 5, 20);
	fill(graphics, leather, 26, 17, 2, 18);
	fill(graphics, steelLight, 25, 19, 3, 3);
	fill(graphics, steelDark, 25, 32, 4, 4);
	fill(graphics, outline, 8, 3, 16, 14);
	fill(graphics, palette.hair, 9, 4, 14, 12);
	fill(graphics, palette.trim, 8, 6, 16, 2);
	fill(graphics, goldLight, 13, 5, 6, 3);
	fill(graphics, outline, 5, 16, 22, 18);
	fill(graphics, palette.accent, 6, 17, 20, 16);
	fill(graphics, 0xd26052, 8, 18, 6, 3);
	fill(graphics, 0x7d3038, 7, 29, 18, 4);
	fill(graphics, gold, 6, 18 + walk.leftArm, 5, 5);
	fill(graphics, gold, 22, 18 + walk.rightArm, 5, 5);
	fill(graphics, outline, 9, 30 + walk.leftStep, 7, 9);
	fill(graphics, outline, 17, 30 + walk.rightStep, 7, 9);
	fill(graphics, palette.shadow, 10, 31 + walk.leftStep, 5, 6);
	fill(graphics, palette.shadow, 18, 31 + walk.rightStep, 5, 6);
	fill(graphics, leatherDark, 9, 36 + walk.leftStep, 7, 3);
	fill(graphics, leatherDark, 17, 36 + walk.rightStep, 7, 3);
};

const drawHeroSide = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	frame: FieldWalkFrame,
): void => {
	const frontLegX = frame === 1 ? 18 : frame === 2 ? 12 : 16;
	const backLegX = frame === 1 ? 10 : frame === 2 ? 17 : 12;
	const armY = frame === 1 ? 19 : frame === 2 ? 21 : 20;
	fill(graphics, outline, 3, 17, 15, 17);
	fill(graphics, palette.accent, 4, 18, 13, 14);
	fill(graphics, 0x7d3038, 4, 29, 11, 4);
	fill(graphics, outline, 9, 3, 16, 14);
	fill(graphics, palette.hair, 10, 4, 14, 7);
	fill(graphics, palette.hair, 8, 8, 6, 9);
	fill(graphics, skin, 15, 8, 10, 8);
	fill(graphics, skinLight, 18, 8, 5, 2);
	fill(graphics, skin, 24, 10, 3, 3);
	fill(graphics, palette.trim, 9, 6, 16, 2);
	fill(graphics, goldLight, 18, 5, 4, 3);
	fill(graphics, outline, 21, 11, 2, 2);
	fill(graphics, 0xf7e4bb, 22, 11, 1, 1);
	fill(graphics, outline, 9, 16, 15, 16);
	fill(graphics, palette.main, 11, 17, 12, 14);
	fill(graphics, palette.highlight, 14, 18, 7, 3);
	fill(graphics, gold, 9, 17, 5, 5);
	fill(graphics, leatherDark, 10, 27, 14, 4);
	fill(graphics, outline, 21, armY, 7, 5);
	fill(graphics, palette.main, 22, armY + 1, 5, 3);
	fill(graphics, skin, 27, armY + 2, 3, 2);
	fill(graphics, outline, 25, 18, 4, 19);
	fill(graphics, steelDark, 26, 21, 2, 14);
	fill(graphics, steelLight, 26, 21, 1, 11);
	fill(graphics, gold, 24, 18, 6, 3);
	fill(graphics, outline, backLegX, 30, 7, 9);
	fill(graphics, outline, frontLegX, 30, 7, 9);
	fill(graphics, palette.shadow, backLegX + 1, 31, 5, 6);
	fill(graphics, palette.shadow, frontLegX + 1, 31, 5, 6);
	fill(graphics, leatherDark, backLegX, 36, 7, 3);
	fill(graphics, leatherDark, frontLegX, 36, 7, 3);
};

const drawWarriorFront = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	frame: FieldWalkFrame,
): void => {
	const walk = walkOffsets(frame);
	fill(graphics, outline, 15, 0, 4, 6);
	fill(graphics, palette.accent, 16, 0, 2, 6);
	fill(graphics, outline, 7, 4, 19, 15);
	fill(graphics, steelDark, 8, 5, 17, 12);
	fill(graphics, steel, 10, 5, 13, 5);
	fill(graphics, steelLight, 12, 5, 7, 2);
	fill(graphics, outline, 8, 10, 17, 3);
	fill(graphics, palette.trim, 10, 11, 13, 1);
	fill(graphics, skin, 11, 13, 11, 5);
	fill(graphics, skinLight, 12, 13, 6, 2);
	fill(graphics, outline, 13, 14, 2, 2);
	fill(graphics, outline, 19, 14, 2, 2);
	fill(graphics, skinShadow, 16, 16, 3, 1);

	fill(graphics, outline, 4, 17 + walk.leftArm, 8, 9);
	fill(graphics, outline, 21, 17 + walk.rightArm, 8, 9);
	fill(graphics, steel, 5, 18 + walk.leftArm, 7, 6);
	fill(graphics, steelLight, 6, 18 + walk.leftArm, 4, 2);
	fill(graphics, steel, 21, 18 + walk.rightArm, 7, 6);
	fill(graphics, steelLight, 22, 18 + walk.rightArm, 4, 2);
	fill(graphics, outline, 8, 18, 18, 15);
	fill(graphics, palette.main, 9, 19, 16, 13);
	fill(graphics, steel, 11, 19, 12, 9);
	fill(graphics, steelLight, 12, 20, 8, 2);
	fill(graphics, steelDark, 11, 26, 12, 2);
	fill(graphics, palette.trim, 16, 20, 2, 7);
	fill(graphics, leatherDark, 8, 28, 18, 4);
	fill(graphics, gold, 15, 28, 4, 4);

	fill(graphics, outline, 1, 21, 9, 13);
	fill(graphics, steelDark, 2, 22, 7, 11);
	fill(graphics, steel, 3, 23, 5, 8);
	fill(graphics, palette.accent, 4, 25, 3, 5);
	fill(graphics, outline, 27, 17, 4, 19);
	fill(graphics, leather, 28, 20, 2, 16);
	fill(graphics, steel, 25, 16, 7, 5);
	fill(graphics, steelLight, 27, 17, 5, 2);

	fill(graphics, outline, 9, 31 + walk.leftStep, 7, 8);
	fill(graphics, outline, 18, 31 + walk.rightStep, 7, 8);
	fill(graphics, steelDark, 10, 32 + walk.leftStep, 5, 5);
	fill(graphics, steelDark, 19, 32 + walk.rightStep, 5, 5);
	fill(graphics, outline, 9, 36 + walk.leftStep, 7, 3);
	fill(graphics, outline, 18, 36 + walk.rightStep, 7, 3);
};

const drawWarriorBack = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	frame: FieldWalkFrame,
): void => {
	const walk = walkOffsets(frame);
	fill(graphics, outline, 15, 0, 4, 6);
	fill(graphics, palette.accent, 16, 0, 2, 6);
	fill(graphics, outline, 7, 4, 19, 15);
	fill(graphics, steelDark, 8, 5, 17, 13);
	fill(graphics, steel, 10, 5, 13, 7);
	fill(graphics, steelLight, 12, 5, 7, 2);
	fill(graphics, outline, 4, 17 + walk.leftArm, 8, 9);
	fill(graphics, outline, 21, 17 + walk.rightArm, 8, 9);
	fill(graphics, steel, 5, 18 + walk.leftArm, 7, 6);
	fill(graphics, steel, 21, 18 + walk.rightArm, 7, 6);
	fill(graphics, outline, 8, 18, 18, 15);
	fill(graphics, palette.main, 9, 19, 16, 13);
	fill(graphics, steelDark, 11, 20, 12, 9);
	fill(graphics, steel, 12, 21, 10, 7);
	fill(graphics, palette.accent, 15, 20, 4, 8);
	fill(graphics, outline, 7, 20, 20, 14);
	fill(graphics, steelDark, 8, 21, 18, 12);
	fill(graphics, steel, 10, 22, 14, 9);
	fill(graphics, palette.trim, 15, 24, 4, 5);
	fill(graphics, outline, 9, 31 + walk.leftStep, 7, 8);
	fill(graphics, outline, 18, 31 + walk.rightStep, 7, 8);
	fill(graphics, steelDark, 10, 32 + walk.leftStep, 5, 5);
	fill(graphics, steelDark, 19, 32 + walk.rightStep, 5, 5);
	fill(graphics, outline, 9, 36 + walk.leftStep, 7, 3);
	fill(graphics, outline, 18, 36 + walk.rightStep, 7, 3);
};

const drawWarriorSide = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	frame: FieldWalkFrame,
): void => {
	const frontLegX = frame === 1 ? 18 : frame === 2 ? 12 : 16;
	const backLegX = frame === 1 ? 10 : frame === 2 ? 17 : 12;
	const armY = frame === 1 ? 19 : frame === 2 ? 21 : 20;
	fill(graphics, outline, 15, 0, 4, 6);
	fill(graphics, palette.accent, 16, 0, 2, 6);
	fill(graphics, outline, 8, 4, 19, 15);
	fill(graphics, steelDark, 9, 5, 17, 13);
	fill(graphics, steel, 11, 5, 13, 7);
	fill(graphics, steelLight, 13, 5, 7, 2);
	fill(graphics, skin, 17, 12, 10, 6);
	fill(graphics, skinLight, 20, 12, 5, 2);
	fill(graphics, outline, 25, 14, 3, 3);
	fill(graphics, outline, 8, 18, 17, 15);
	fill(graphics, palette.main, 10, 19, 14, 13);
	fill(graphics, steel, 12, 19, 11, 9);
	fill(graphics, steelLight, 15, 20, 6, 2);
	fill(graphics, outline, 4, 19, 9, 15);
	fill(graphics, steelDark, 5, 20, 7, 13);
	fill(graphics, steel, 6, 21, 5, 10);
	fill(graphics, palette.accent, 7, 24, 3, 5);
	fill(graphics, outline, 21, armY, 7, 6);
	fill(graphics, steel, 22, armY + 1, 5, 4);
	fill(graphics, outline, 27, 17, 4, 20);
	fill(graphics, leather, 28, 20, 2, 17);
	fill(graphics, steel, 25, 16, 7, 5);
	fill(graphics, steelLight, 27, 17, 5, 2);
	fill(graphics, outline, backLegX, 31, 7, 8);
	fill(graphics, outline, frontLegX, 31, 7, 8);
	fill(graphics, steelDark, backLegX + 1, 32, 5, 5);
	fill(graphics, steelDark, frontLegX + 1, 32, 5, 5);
	fill(graphics, outline, backLegX, 36, 7, 3);
	fill(graphics, outline, frontLegX, 36, 7, 3);
};

const drawMageHat = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	direction: TextureDirection,
): void => {
	if (direction === "side") {
		fill(graphics, outline, 13, 0, 4, 3);
		fill(graphics, outline, 10, 2, 8, 4);
		fill(graphics, outline, 8, 5, 13, 4);
		fill(graphics, outline, 7, 8, 18, 6);
		fill(graphics, outline, 4, 13, 25, 4);
		fill(graphics, palette.shadow, 14, 1, 2, 3);
		fill(graphics, palette.main, 11, 3, 6, 3);
		fill(graphics, palette.main, 9, 6, 11, 5);
		fill(graphics, palette.highlight, 11, 6, 7, 2);
		fill(graphics, palette.main, 8, 9, 16, 4);
		fill(graphics, palette.trim, 8, 12, 16, 2);
		fill(graphics, palette.main, 5, 14, 23, 2);
		return;
	}
	fill(graphics, outline, 15, 0, 3, 3);
	fill(graphics, outline, 12, 2, 8, 4);
	fill(graphics, outline, 9, 5, 14, 5);
	fill(graphics, outline, 7, 9, 19, 6);
	fill(graphics, outline, 4, 14, 25, 4);
	fill(graphics, palette.shadow, 15, 1, 2, 3);
	fill(graphics, palette.main, 13, 3, 6, 3);
	fill(graphics, palette.main, 10, 6, 12, 5);
	fill(graphics, palette.highlight, 12, 6, 7, 2);
	fill(graphics, palette.main, 8, 10, 17, 4);
	fill(graphics, palette.trim, 8, 13, 17, 2);
	fill(graphics, palette.main, 5, 15, 23, 2);
};

const drawMageStaff = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
): void => {
	fill(graphics, outline, 27, 15, 4, 23);
	fill(graphics, leather, 28, 17, 2, 21);
	fill(graphics, outline, 25, 9, 7, 8);
	fill(graphics, palette.accent, 26, 10, 5, 6);
	fill(graphics, 0xa3edf0, 27, 11, 3, 3);
	fill(graphics, palette.trim, 26, 16, 5, 2);
};

const drawMageFront = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	frame: FieldWalkFrame,
): void => {
	const walk = walkOffsets(frame);
	drawMageStaff(graphics, palette);
	drawMageHat(graphics, palette, "down");
	fill(graphics, outline, 10, 16, 14, 7);
	fill(graphics, skin, 11, 17, 12, 5);
	fill(graphics, skinLight, 12, 17, 7, 2);
	fill(graphics, palette.hair, 9, 17, 4, 7);
	fill(graphics, palette.hair, 22, 17, 3, 7);
	fill(graphics, outline, 13, 19, 2, 2);
	fill(graphics, outline, 19, 19, 2, 2);
	fill(graphics, 0xb7f4ec, 14, 19, 1, 1);
	fill(graphics, 0xb7f4ec, 20, 19, 1, 1);
	fill(graphics, outline, 7, 22 + walk.leftArm, 6, 9);
	fill(graphics, outline, 22, 22 + walk.rightArm, 6, 9);
	fill(graphics, palette.highlight, 8, 23 + walk.leftArm, 5, 7);
	fill(graphics, palette.shadow, 22, 23 + walk.rightArm, 5, 7);
	fill(graphics, outline, 9, 21, 16, 17);
	fill(graphics, palette.main, 10, 22, 14, 15);
	fill(graphics, palette.highlight, 11, 23, 8, 3);
	fill(graphics, palette.trim, 10, 26, 14, 3);
	fill(graphics, palette.accent, 15, 26, 4, 3);
	fill(graphics, palette.shadow, 9, 33, 16, 5);
	fill(graphics, outline, 10, 36 + walk.leftStep, 6, 3);
	fill(graphics, outline, 19, 36 + walk.rightStep, 6, 3);
};

const drawMageBack = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	frame: FieldWalkFrame,
): void => {
	const walk = walkOffsets(frame);
	drawMageStaff(graphics, palette);
	drawMageHat(graphics, palette, "up");
	fill(graphics, outline, 10, 16, 14, 8);
	fill(graphics, palette.hair, 11, 17, 12, 7);
	fill(graphics, outline, 7, 22 + walk.leftArm, 6, 9);
	fill(graphics, outline, 22, 22 + walk.rightArm, 6, 9);
	fill(graphics, palette.highlight, 8, 23 + walk.leftArm, 5, 7);
	fill(graphics, palette.shadow, 22, 23 + walk.rightArm, 5, 7);
	fill(graphics, outline, 9, 21, 16, 17);
	fill(graphics, palette.main, 10, 22, 14, 15);
	fill(graphics, palette.trim, 10, 25, 14, 3);
	fill(graphics, palette.accent, 15, 25, 4, 3);
	fill(graphics, palette.shadow, 9, 33, 16, 5);
	fill(graphics, outline, 10, 36 + walk.leftStep, 6, 3);
	fill(graphics, outline, 19, 36 + walk.rightStep, 6, 3);
};

const drawMageSide = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	frame: FieldWalkFrame,
): void => {
	const frontLegX = frame === 1 ? 18 : frame === 2 ? 12 : 16;
	const backLegX = frame === 1 ? 10 : frame === 2 ? 17 : 12;
	const armY = frame === 1 ? 23 : frame === 2 ? 25 : 24;
	drawMageStaff(graphics, palette);
	drawMageHat(graphics, palette, "side");
	fill(graphics, outline, 10, 15, 15, 8);
	fill(graphics, palette.hair, 10, 16, 6, 8);
	fill(graphics, skin, 15, 17, 10, 5);
	fill(graphics, skinLight, 18, 17, 5, 2);
	fill(graphics, skin, 24, 19, 3, 2);
	fill(graphics, outline, 21, 19, 2, 2);
	fill(graphics, 0xb7f4ec, 22, 19, 1, 1);
	fill(graphics, outline, 8, 21, 17, 17);
	fill(graphics, palette.main, 10, 22, 14, 15);
	fill(graphics, palette.highlight, 12, 23, 8, 3);
	fill(graphics, palette.trim, 10, 27, 14, 3);
	fill(graphics, palette.shadow, 8, 33, 17, 5);
	fill(graphics, outline, 21, armY, 7, 6);
	fill(graphics, palette.highlight, 22, armY + 1, 5, 4);
	fill(graphics, outline, backLegX, 36, 6, 3);
	fill(graphics, outline, frontLegX, 36, 6, 3);
};

const drawCharacter = (
	graphics: Phaser.GameObjects.Graphics,
	palette: CharacterPalette,
	direction: TextureDirection,
	frame: FieldWalkFrame,
): void => {
	if (palette.role === "hero") {
		if (direction === "up") drawHeroBack(graphics, palette, frame);
		else if (direction === "side") drawHeroSide(graphics, palette, frame);
		else drawHeroFront(graphics, palette, frame);
		return;
	}
	if (palette.role === "warrior") {
		if (direction === "up") drawWarriorBack(graphics, palette, frame);
		else if (direction === "side") drawWarriorSide(graphics, palette, frame);
		else drawWarriorFront(graphics, palette, frame);
		return;
	}
	if (direction === "up") drawMageBack(graphics, palette, frame);
	else if (direction === "side") drawMageSide(graphics, palette, frame);
	else drawMageFront(graphics, palette, frame);
};

const generateCharacterTexture = (
	scene: Phaser.Scene,
	key: string,
	palette: CharacterPalette,
	direction: TextureDirection,
	frame: FieldWalkFrame,
): void => {
	if (scene.textures.exists(key)) return;
	const graphics = scene.add.graphics().setVisible(false);
	drawCharacter(graphics, palette, direction, frame);

	graphics.generateTexture(
		key,
		FIELD_CHARACTER_TEXTURE_WIDTH,
		FIELD_CHARACTER_TEXTURE_HEIGHT,
	);
	graphics.destroy();
};

const generateAshWisp = (scene: Phaser.Scene): void => {
	const key = "enemy-ash-wisp";
	if (scene.textures.exists(key)) return;
	const graphics = scene.add.graphics().setVisible(false);
	const deep = 0x17304b;
	const mid = 0x2c7c83;
	const glow = 0x67c8b8;
	const core = 0xb5ead4;

	fill(graphics, deep, 16, 1, 8, 3);
	fill(graphics, deep, 10, 4, 20, 4);
	fill(graphics, deep, 6, 8, 29, 20);
	fill(graphics, deep, 9, 28, 23, 6);
	fill(graphics, mid, 13, 4, 13, 4);
	fill(graphics, mid, 9, 8, 21, 18);
	fill(graphics, mid, 4, 13, 7, 12);
	fill(graphics, mid, 30, 10, 7, 13);
	fill(graphics, glow, 12, 10, 17, 14);
	fill(graphics, glow, 8, 15, 5, 8);
	fill(graphics, glow, 29, 13, 5, 7);
	fill(graphics, core, 15, 12, 11, 9);
	fill(graphics, 0xe2f4dc, 18, 14, 5, 4);
	fill(graphics, 0xf2d278, 16, 16, 2, 2);
	fill(graphics, 0xf2d278, 24, 16, 2, 2);
	fill(graphics, deep, 18, 21, 7, 2);
	fill(graphics, mid, 5, 7, 6, 5);
	fill(graphics, glow, 2, 4, 5, 6);
	fill(graphics, mid, 34, 5, 5, 6);
	fill(graphics, glow, 38, 2, 3, 6);
	fill(graphics, deep, 7, 26, 7, 6);
	fill(graphics, mid, 12, 32, 7, 8);
	fill(graphics, glow, 19, 29, 7, 10);
	fill(graphics, deep, 26, 28, 6, 8);
	graphics.generateTexture(key, 42, 42);
	graphics.destroy();
};

const generateBrassHound = (scene: Phaser.Scene): void => {
	const key = "enemy-brass-hound";
	if (scene.textures.exists(key)) return;
	const graphics = scene.add.graphics().setVisible(false);
	const brassDark = 0x76532e;
	const brass = 0xc29045;
	const brassLight = 0xe4bd68;

	fill(graphics, outline, 5, 9, 31, 16);
	fill(graphics, outline, 33, 5, 12, 17);
	fill(graphics, brassDark, 7, 11, 28, 12);
	fill(graphics, brass, 10, 9, 22, 10);
	fill(graphics, brassLight, 13, 10, 13, 3);
	fill(graphics, brassDark, 34, 7, 9, 13);
	fill(graphics, brass, 36, 9, 9, 9);
	fill(graphics, outline, 38, 12, 3, 3);
	fill(graphics, 0x72d7c0, 39, 12, 1, 1);
	fill(graphics, outline, 44, 15, 4, 4);
	fill(graphics, brassDark, 34, 2, 4, 7);
	fill(graphics, brass, 41, 3, 4, 6);
	fill(graphics, outline, 10, 23, 8, 10);
	fill(graphics, outline, 27, 23, 8, 10);
	fill(graphics, brassDark, 12, 23, 5, 7);
	fill(graphics, brassDark, 29, 23, 5, 7);
	fill(graphics, 0x111425, 9, 31, 10, 3);
	fill(graphics, 0x111425, 26, 31, 10, 3);
	fill(graphics, outline, 1, 10, 7, 5);
	fill(graphics, brass, 2, 8, 6, 4);
	fill(graphics, brassDark, 0, 4, 4, 7);
	fill(graphics, brassLight, 17, 15, 6, 5);
	fill(graphics, outline, 19, 16, 3, 3);
	fill(graphics, 0x3e8d91, 7, 17, 2, 3);
	fill(graphics, 0x3e8d91, 32, 17, 2, 3);
	fill(graphics, brassLight, 27, 12, 2, 7);
	graphics.generateTexture(key, 48, 35);
	graphics.destroy();
};

const generateSignalWarden = (scene: Phaser.Scene): void => {
	const key = "enemy-signal-warden";
	if (scene.textures.exists(key)) return;
	const graphics = scene.add.graphics().setVisible(false);
	const abyss = 0x0b1022;
	const armorDark = 0x202a48;
	const armor = 0x405579;
	const armorLight = 0x7185a0;
	const brass = 0xa77a3e;
	const brassLight = 0xe0b75e;
	const signal = 0x55c7bf;
	const signalLight = 0xc2fff0;
	const mantle = 0x432844;

	fill(graphics, outline, 7, 4, 21, 5);
	fill(graphics, outline, 44, 4, 21, 5);
	fill(graphics, outline, 4, 8, 18, 7);
	fill(graphics, outline, 50, 8, 18, 7);
	fill(graphics, brass, 8, 5, 19, 3);
	fill(graphics, brass, 45, 5, 19, 3);
	fill(graphics, brassLight, 5, 9, 15, 4);
	fill(graphics, brassLight, 52, 9, 15, 4);
	fill(graphics, armorDark, 16, 8, 9, 7);
	fill(graphics, armorDark, 47, 8, 9, 7);

	fill(graphics, outline, 23, 6, 26, 24);
	fill(graphics, armorDark, 25, 8, 22, 20);
	fill(graphics, armor, 28, 9, 16, 7);
	fill(graphics, armorLight, 30, 9, 10, 3);
	fill(graphics, abyss, 27, 17, 18, 8);
	fill(graphics, signal, 29, 19, 5, 3);
	fill(graphics, signal, 38, 19, 5, 3);
	fill(graphics, signalLight, 31, 19, 2, 2);
	fill(graphics, signalLight, 39, 19, 2, 2);
	fill(graphics, brass, 33, 24, 6, 4);

	fill(graphics, outline, 5, 25, 62, 19);
	fill(graphics, armorDark, 7, 27, 58, 15);
	fill(graphics, armor, 10, 28, 18, 10);
	fill(graphics, armor, 44, 28, 18, 10);
	fill(graphics, armorLight, 12, 28, 12, 3);
	fill(graphics, armorLight, 48, 28, 12, 3);
	fill(graphics, brass, 6, 35, 21, 5);
	fill(graphics, brass, 45, 35, 21, 5);

	fill(graphics, outline, 17, 28, 38, 34);
	fill(graphics, mantle, 19, 30, 34, 30);
	fill(graphics, armorDark, 21, 29, 30, 27);
	fill(graphics, armor, 24, 30, 24, 22);
	fill(graphics, armorLight, 26, 31, 13, 4);
	fill(graphics, brass, 22, 38, 28, 5);
	fill(graphics, outline, 27, 34, 18, 18);
	fill(graphics, signal, 29, 36, 14, 14);
	fill(graphics, signalLight, 32, 38, 8, 8);
	fill(graphics, 0xf5df8c, 34, 40, 4, 4);
	fill(graphics, armorDark, 31, 50, 10, 6);

	fill(graphics, outline, 2, 37, 17, 25);
	fill(graphics, outline, 53, 37, 17, 25);
	fill(graphics, armorDark, 4, 39, 13, 21);
	fill(graphics, armorDark, 55, 39, 13, 21);
	fill(graphics, armor, 6, 40, 9, 12);
	fill(graphics, armor, 57, 40, 9, 12);
	fill(graphics, brass, 3, 54, 15, 6);
	fill(graphics, brass, 54, 54, 15, 6);
	fill(graphics, signal, 7, 43, 3, 7);
	fill(graphics, signal, 62, 43, 3, 7);

	fill(graphics, outline, 15, 57, 18, 12);
	fill(graphics, outline, 39, 57, 18, 12);
	fill(graphics, armorDark, 17, 58, 14, 9);
	fill(graphics, armorDark, 41, 58, 14, 9);
	fill(graphics, mantle, 24, 56, 24, 14);
	fill(graphics, 0x291c35, 27, 62, 6, 9);
	fill(graphics, 0x291c35, 39, 62, 6, 9);
	fill(graphics, signal, 34, 58, 4, 9);
	graphics.generateTexture(key, 72, 72);
	graphics.destroy();
};

export function createPixelTextures(scene: Phaser.Scene): void {
	for (const [key, palette] of Object.entries(characterPalettes)) {
		generateCharacterTexture(scene, key, palette, "down", 0);
		for (const direction of ["up", "down", "side"] as const) {
			for (const frame of [0, 1, 2] as const) {
				generateCharacterTexture(
					scene,
					`${key}-${direction}-${frame}`,
					palette,
					direction,
					frame,
				);
			}
		}
	}
	generateAshWisp(scene);
	generateBrassHound(scene);
	generateSignalWarden(scene);
}
