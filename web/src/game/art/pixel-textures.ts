import type Phaser from "phaser";

const outline = 0x11182a;
const skin = 0xe3b58d;

type CharacterPalette = {
	main: number;
	shadow: number;
	accent: number;
	hair: number;
};

const characterPalettes: Record<string, CharacterPalette> = {
	"field-mira": {
		main: 0xd9aa57,
		shadow: 0x8f6239,
		accent: 0xc65e62,
		hair: 0x20263a,
	},
	"field-sol": {
		main: 0x52a8a2,
		shadow: 0x2c626b,
		accent: 0xe17450,
		hair: 0x5b3a2c,
	},
	"field-lune": {
		main: 0x8871b8,
		shadow: 0x4f426f,
		accent: 0xe0d1ad,
		hair: 0xc9c0ae,
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

const generateCharacterTexture = (
	scene: Phaser.Scene,
	key: string,
	palette: CharacterPalette,
): void => {
	if (scene.textures.exists(key)) return;
	const graphics = scene.add.graphics().setVisible(false);
	fill(graphics, outline, 4, 0, 8, 2);
	fill(graphics, outline, 3, 2, 10, 6);
	fill(graphics, palette.hair, 4, 1, 8, 4);
	fill(graphics, palette.hair, 3, 3, 2, 5);
	fill(graphics, palette.hair, 11, 3, 2, 4);
	fill(graphics, skin, 5, 4, 6, 5);
	fill(graphics, 0xf1dfae, 6, 5, 1, 1);
	fill(graphics, 0xf1dfae, 9, 5, 1, 1);
	fill(graphics, 0x9c5546, 7, 8, 2, 1);
	fill(graphics, outline, 3, 9, 10, 7);
	fill(graphics, outline, 1, 10, 3, 5);
	fill(graphics, outline, 12, 10, 3, 5);
	fill(graphics, palette.main, 4, 9, 8, 6);
	fill(graphics, palette.shadow, 4, 13, 8, 3);
	fill(graphics, palette.accent, 4, 10, 8, 2);
	fill(graphics, skin, 1, 11, 2, 3);
	fill(graphics, skin, 13, 11, 2, 3);
	fill(graphics, outline, 3, 16, 4, 4);
	fill(graphics, outline, 9, 16, 4, 4);
	fill(graphics, palette.shadow, 4, 16, 3, 2);
	fill(graphics, palette.shadow, 9, 16, 3, 2);
	fill(graphics, 0x111425, 3, 19, 4, 1);
	fill(graphics, 0x111425, 9, 19, 4, 1);
	graphics.generateTexture(key, 16, 20);
	graphics.destroy();
};

const generateAshWisp = (scene: Phaser.Scene): void => {
	const key = "enemy-ash-wisp";
	if (scene.textures.exists(key)) return;
	const graphics = scene.add.graphics().setVisible(false);
	fill(graphics, 0x17304b, 9, 2, 8, 23);
	fill(graphics, 0x17304b, 5, 7, 16, 14);
	fill(graphics, 0x2c7c83, 7, 5, 12, 17);
	fill(graphics, 0x67c8b8, 9, 8, 8, 11);
	fill(graphics, 0xb5ead4, 10, 10, 6, 6);
	fill(graphics, 0x67c8b8, 3, 10, 4, 7);
	fill(graphics, 0x2c7c83, 1, 13, 3, 7);
	fill(graphics, 0x67c8b8, 19, 8, 4, 7);
	fill(graphics, 0x2c7c83, 22, 6, 3, 6);
	fill(graphics, 0x2c7c83, 10, 0, 3, 5);
	fill(graphics, 0x67c8b8, 15, 1, 3, 5);
	fill(graphics, 0x17304b, 6, 21, 4, 4);
	fill(graphics, 0x2c7c83, 12, 21, 4, 6);
	fill(graphics, 0x17304b, 17, 20, 3, 5);
	fill(graphics, 0xf2d278, 11, 12, 1, 2);
	fill(graphics, 0xf2d278, 15, 12, 1, 2);
	fill(graphics, 0x17304b, 12, 16, 3, 1);
	graphics.generateTexture(key, 26, 28);
	graphics.destroy();
};

const generateBrassHound = (scene: Phaser.Scene): void => {
	const key = "enemy-brass-hound";
	if (scene.textures.exists(key)) return;
	const graphics = scene.add.graphics().setVisible(false);
	fill(graphics, outline, 4, 6, 21, 11);
	fill(graphics, 0x76532e, 6, 7, 18, 8);
	fill(graphics, 0xc29045, 8, 6, 15, 7);
	fill(graphics, 0xe4bd68, 10, 7, 9, 2);
	fill(graphics, outline, 23, 3, 7, 11);
	fill(graphics, 0x76532e, 24, 4, 5, 8);
	fill(graphics, 0xc29045, 25, 6, 5, 5);
	fill(graphics, 0x3e8d91, 26, 6, 1, 1);
	fill(graphics, 0x11182a, 30, 9, 2, 2);
	fill(graphics, 0x76532e, 23, 1, 3, 4);
	fill(graphics, 0xc29045, 28, 2, 2, 3);
	fill(graphics, outline, 7, 15, 5, 7);
	fill(graphics, outline, 19, 15, 5, 7);
	fill(graphics, 0x76532e, 8, 15, 3, 5);
	fill(graphics, 0x76532e, 20, 15, 3, 5);
	fill(graphics, 0xc29045, 1, 7, 5, 3);
	fill(graphics, 0x76532e, 0, 4, 3, 5);
	fill(graphics, 0xe4bd68, 13, 9, 4, 4);
	fill(graphics, 0x76532e, 14, 10, 2, 2);
	graphics.generateTexture(key, 32, 22);
	graphics.destroy();
};

export function createPixelTextures(scene: Phaser.Scene): void {
	for (const [key, palette] of Object.entries(characterPalettes)) {
		generateCharacterTexture(scene, key, palette);
	}
	generateAshWisp(scene);
	generateBrassHound(scene);
}
