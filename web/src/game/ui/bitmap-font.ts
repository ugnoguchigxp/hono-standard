import Phaser from "phaser";

export const GAME_UI_BITMAP_FONT = "game-ui-bitmap-font";
const GAME_UI_BITMAP_TEXTURE = "game-ui-bitmap-font-texture";
const FONT_CHARACTERS = `${Phaser.GameObjects.RetroFont.TEXT_SET1}▶◀×…`;
const CELL_WIDTH = 18;
const CELL_HEIGHT = 24;
const GLYPH_ADVANCE = 11;
const CHARS_PER_ROW = 16;

export interface UiBitmapTextStyle {
	fontSize?: string | number;
	color?: string;
}

export function createGameUiBitmapFont(scene: Phaser.Scene): void {
	if (scene.cache.bitmapFont.exists(GAME_UI_BITMAP_FONT)) return;
	const rows = Math.ceil(FONT_CHARACTERS.length / CHARS_PER_ROW);
	const texture = scene.textures.createCanvas(
		GAME_UI_BITMAP_TEXTURE,
		CELL_WIDTH * CHARS_PER_ROW,
		CELL_HEIGHT * rows,
	);
	if (!texture) throw new Error("Could not create the game UI bitmap font.");
	const context = texture.getContext();
	context.clearRect(0, 0, texture.width, texture.height);
	context.fillStyle = "#ffffff";
	context.font = '700 20px "Trebuchet MS", Arial, sans-serif';
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.imageSmoothingEnabled = true;
	for (const [index, character] of [...FONT_CHARACTERS].entries()) {
		const column = index % CHARS_PER_ROW;
		const row = Math.floor(index / CHARS_PER_ROW);
		context.fillText(
			character,
			column * CELL_WIDTH + CELL_WIDTH / 2,
			row * CELL_HEIGHT + CELL_HEIGHT / 2 + 1,
		);
	}
	texture.refresh();
	const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
		image: GAME_UI_BITMAP_TEXTURE,
		"offset.x": 0,
		"offset.y": 0,
		width: CELL_WIDTH,
		height: CELL_HEIGHT,
		chars: FONT_CHARACTERS,
		charsPerRow: CHARS_PER_ROW,
		"spacing.x": 0,
		"spacing.y": 0,
		lineSpacing: 0,
	}) as unknown as {
		data: Phaser.Types.GameObjects.BitmapText.BitmapFontData;
		frame: null;
		texture: string;
	};
	if (!entry) throw new Error("Could not parse the game UI bitmap font.");
	for (const glyph of Object.values(entry.data.chars)) {
		(glyph as typeof glyph & { xAdvance: number }).xAdvance = GLYPH_ADVANCE;
	}
	scene.cache.bitmapFont.add(GAME_UI_BITMAP_FONT, entry);
}

export function addUiBitmapText(
	scene: Phaser.Scene,
	x: number,
	y: number,
	value: string,
	style: UiBitmapTextStyle = {},
): Phaser.GameObjects.BitmapText {
	const fontSize =
		typeof style.fontSize === "number"
			? style.fontSize
			: Number.parseFloat(style.fontSize ?? "6");
	const text = scene.add.bitmapText(x, y, GAME_UI_BITMAP_FONT, value, fontSize);
	if (style.color?.startsWith("#")) {
		text.setTint(Number.parseInt(style.color.slice(1), 16));
	}
	return text;
}
