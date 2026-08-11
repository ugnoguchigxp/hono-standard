import type { CharacterState, GameSession } from "@shared/game";
import Phaser from "phaser";
import {
	GAME_LOGICAL_HEIGHT,
	GAME_LOGICAL_WIDTH,
	GAME_RENDER_SCALE,
	GAME_TEXT_RESOLUTION,
} from "../display";
import { InputManager } from "../input/InputManager";
import { fieldMenuItems, getFieldMenuProfile } from "../menu/menu-data";

type MenuPage = "root" | "status" | "equipment" | "items";

const menuCommands = [
	{ id: "status", label: "STATUS" },
	{ id: "equipment", label: "EQUIPMENT" },
	{ id: "items", label: "ITEMS" },
	{ id: "return", label: "RETURN" },
] as const;

const baseTextStyle: Phaser.Types.GameObjects.Text.TextStyle = {
	fontFamily: '"Trebuchet MS", Arial, sans-serif',
	fontSize: "6px",
	fontStyle: "bold",
	color: "#f7f1df",
	resolution: GAME_TEXT_RESOLUTION,
};

export class FieldMenuScene extends Phaser.Scene {
	private inputManager?: InputManager;
	private page: MenuPage = "root";
	private menuIndex = 0;
	private actorIndex = 0;
	private itemIndex = 0;
	private contentObjects: Phaser.GameObjects.GameObject[] = [];

	constructor(private readonly gameSession: GameSession) {
		super("field-menu");
	}

	create(): void {
		this.page = "root";
		this.menuIndex = 0;
		this.actorIndex = 0;
		this.itemIndex = 0;
		this.contentObjects = [];
		this.inputManager = new InputManager(this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.inputManager?.destroy();
			this.clearContent();
		});

		this.cameras.main
			.setZoom(GAME_RENDER_SCALE)
			.setBounds(0, 0, GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT)
			.setRoundPixels(true)
			.setBackgroundColor("#081126");
		this.drawBackdrop();
		this.renderPage();
	}

	update(): void {
		if (!this.inputManager) return;
		if (this.inputManager.justPressed("MENU")) {
			this.closeMenu();
			return;
		}
		if (this.page === "root") {
			this.handleRootInput();
			return;
		}
		this.handleDetailInput();
	}

	private handleRootInput(): void {
		if (!this.inputManager) return;
		if (this.inputManager.justPressed("CANCEL")) {
			this.closeMenu();
			return;
		}
		if (this.inputManager.justPressed("UP")) {
			this.menuIndex =
				(this.menuIndex + menuCommands.length - 1) % menuCommands.length;
			this.renderPage();
		}
		if (this.inputManager.justPressed("DOWN")) {
			this.menuIndex = (this.menuIndex + 1) % menuCommands.length;
			this.renderPage();
		}
		if (!this.inputManager.justPressed("CONFIRM")) return;
		const selected = menuCommands[this.menuIndex];
		if (selected.id === "return") {
			this.closeMenu();
			return;
		}
		this.page = selected.id;
		this.renderPage();
	}

	private handleDetailInput(): void {
		if (!this.inputManager) return;
		if (this.inputManager.justPressed("CANCEL")) {
			this.page = "root";
			this.renderPage();
			return;
		}
		if (this.page === "items") {
			if (this.inputManager.justPressed("UP")) {
				this.itemIndex =
					(this.itemIndex + fieldMenuItems.length - 1) % fieldMenuItems.length;
				this.renderPage();
			}
			if (this.inputManager.justPressed("DOWN")) {
				this.itemIndex = (this.itemIndex + 1) % fieldMenuItems.length;
				this.renderPage();
			}
			return;
		}
		const partySize = this.gameSession.snapshot().party.members.length;
		if (this.inputManager.justPressed("LEFT")) {
			this.actorIndex = (this.actorIndex + partySize - 1) % partySize;
			this.renderPage();
		}
		if (this.inputManager.justPressed("RIGHT")) {
			this.actorIndex = (this.actorIndex + 1) % partySize;
			this.renderPage();
		}
	}

	private closeMenu(): void {
		this.scene.start("field");
	}

	private drawBackdrop(): void {
		this.add.rectangle(160, 96, 320, 192, 0x071126, 1);
		this.add
			.rectangle(160, 11, 310, 21, 0x101f45, 1)
			.setStrokeStyle(1, 0x82a8c6);
		this.add
			.rectangle(160, 177, 310, 23, 0x09172e, 1)
			.setStrokeStyle(1, 0x536f8b);
		for (let index = 0; index < 7; index += 1) {
			this.add
				.circle(30 + index * 45, 19 + (index % 2) * 3, 1, 0x72d7c0, 0.3)
				.setBlendMode(Phaser.BlendModes.ADD);
		}
	}

	private renderPage(): void {
		this.clearContent();
		const map = this.gameSession.content.getMap(
			this.gameSession.snapshot().location.mapId,
		);
		this.text(
			12,
			5,
			this.page === "root" ? "MAIN MENU" : this.page.toUpperCase(),
			{
				fontSize: "9px",
				color: "#f2cf7a",
			},
		);
		this.text(307, 7, map.displayName.toUpperCase(), {
			fontSize: "5px",
			color: "#a9d5d0",
		}).setOrigin(1, 0);

		if (this.page === "root") this.renderRoot();
		else if (this.page === "status") this.renderStatus();
		else if (this.page === "equipment") this.renderEquipment();
		else this.renderItems();
	}

	private renderRoot(): void {
		this.panel(5, 27, 74, 136);
		this.panel(83, 27, 232, 136);
		menuCommands.forEach((command, index) => {
			const y = 37 + index * 29;
			if (index === this.menuIndex) {
				this.track(
					this.add
						.rectangle(42, y + 8, 64, 21, 0x244d73, 0.95)
						.setStrokeStyle(1, 0x72d7c0),
				);
				this.text(12, y + 3, "▶", { color: "#f2cf7a" });
			}
			this.text(23, y + 3, command.label, {
				fontSize: "7px",
				color: index === this.menuIndex ? "#ffffff" : "#b9c8d2",
			});
		});

		const snapshot = this.gameSession.snapshot();
		snapshot.party.members.forEach((member, index) => {
			const rowY = 34 + index * 41;
			this.track(
				this.add
					.rectangle(199, rowY + 18, 220, 36, 0x0c1a35, 0.92)
					.setStrokeStyle(1, index === 0 ? 0x6f8eac : 0x314b66, 0.8),
			);
			const actor = this.gameSession.content.getActor(member.id);
			this.track(
				this.add
					.image(104, rowY + 32, actor.textureKey)
					.setOrigin(0.5, 1)
					.setScale(0.72),
			);
			const profile = getFieldMenuProfile(member.id);
			this.text(125, rowY + 4, member.name.toUpperCase(), {
				fontSize: "8px",
				color: "#f8edcf",
			});
			this.text(125, rowY + 16, profile.job, {
				fontSize: "5px",
				color: "#72d7c0",
			});
			this.text(210, rowY + 6, `LV ${member.level}`, { fontSize: "5px" });
			this.text(210, rowY + 18, `HP ${member.hp}/${member.maxHp}`, {
				fontSize: "6px",
			});
		});
		this.help("UP / DOWN  SELECT     Z / ENTER  OPEN     X / ESC  CLOSE");
	}

	private renderStatus(): void {
		this.panel(5, 27, 310, 136);
		const member = this.selectedMember();
		const actor = this.gameSession.content.getActor(member.id);
		const profile = getFieldMenuProfile(member.id);
		this.track(
			this.add
				.image(43, 148, actor.textureKey)
				.setOrigin(0.5, 1)
				.setScale(1.55),
		);
		this.text(78, 38, member.name.toUpperCase(), {
			fontSize: "11px",
			color: "#f2cf7a",
		});
		this.text(79, 54, profile.job, { fontSize: "6px", color: "#72d7c0" });
		this.text(298, 40, `◀  ${this.actorIndex + 1} / ${this.partySize()}  ▶`, {
			fontSize: "6px",
		}).setOrigin(1, 0);
		this.line(76, 66, 299, 66, 0x536f8b);
		this.labelValue(79, 73, "LEVEL", String(member.level));
		this.labelValue(158, 73, "HP", `${member.hp} / ${member.maxHp}`);
		this.labelValue(79, 91, "ATTACK", String(member.attack));
		this.labelValue(158, 91, "DEFENSE", String(member.defense));
		this.labelValue(237, 91, "SPEED", String(member.speed));
		this.text(79, 116, "SPECIAL ABILITY", {
			fontSize: "5px",
			color: "#839eb8",
		});
		this.text(79, 128, member.ability.name, {
			fontSize: "8px",
			color: "#f8edcf",
		});
		this.text(229, 130, `POWER ${member.ability.powerPercent}%`, {
			fontSize: "5px",
			color: "#72d7c0",
		});
		this.help("LEFT / RIGHT  PARTY MEMBER     X / ESC  BACK     M  CLOSE");
	}

	private renderEquipment(): void {
		this.panel(5, 27, 310, 136);
		const member = this.selectedMember();
		const actor = this.gameSession.content.getActor(member.id);
		const profile = getFieldMenuProfile(member.id);
		this.track(
			this.add.image(38, 97, actor.textureKey).setOrigin(0.5, 1).setScale(1.18),
		);
		this.text(16, 106, member.name.toUpperCase(), {
			fontSize: "8px",
			color: "#f2cf7a",
		});
		this.text(16, 119, profile.job, { fontSize: "5px", color: "#72d7c0" });
		this.text(16, 136, `ATK ${member.attack}   DEF ${member.defense}`, {
			fontSize: "5px",
		});
		this.text(298, 30, `◀  ${this.actorIndex + 1} / ${this.partySize()}  ▶`, {
			fontSize: "6px",
		}).setOrigin(1, 0);
		profile.equipment.forEach((equipment, index) => {
			const y = 43 + index * 27;
			this.track(
				this.add
					.rectangle(194, y + 10, 222, 24, 0x0c1a35, 0.92)
					.setStrokeStyle(1, 0x314b66),
			);
			this.text(89, y + 3, equipment.slot, {
				fontSize: "4px",
				color: "#839eb8",
			});
			this.text(138, y + 2, equipment.name, {
				fontSize: "7px",
				color: "#f8edcf",
			});
			this.text(138, y + 13, equipment.description, {
				fontSize: "4px",
				color: "#9fb5c4",
			});
		});
		this.help("LEFT / RIGHT  PARTY MEMBER     X / ESC  BACK     M  CLOSE");
	}

	private renderItems(): void {
		this.panel(5, 27, 310, 136);
		this.text(15, 34, "INVENTORY", { fontSize: "6px", color: "#72d7c0" });
		this.text(302, 35, "VIEW ONLY", {
			fontSize: "4px",
			color: "#839eb8",
		}).setOrigin(1, 0);
		fieldMenuItems.forEach((item, index) => {
			const y = 45 + index * 19;
			if (index === this.itemIndex) {
				this.track(
					this.add
						.rectangle(160, y + 7, 286, 18, 0x244d73, 0.95)
						.setStrokeStyle(1, 0x72d7c0),
				);
				this.text(14, y + 2, "▶", { color: "#f2cf7a" });
			}
			this.text(27, y + 2, item.name, {
				fontSize: "7px",
				color: index === this.itemIndex ? "#ffffff" : "#c4d0d8",
			});
			this.text(296, y + 2, `× ${item.count}`, { fontSize: "6px" }).setOrigin(
				1,
				0,
			);
		});
		this.line(14, 143, 304, 143, 0x536f8b);
		this.text(18, 149, fieldMenuItems[this.itemIndex].description, {
			fontSize: "5px",
			color: "#bcd1d7",
		});
		this.help("UP / DOWN  SELECT ITEM     X / ESC  BACK     M  CLOSE");
	}

	private selectedMember(): CharacterState {
		return this.gameSession.snapshot().party.members[this.actorIndex];
	}

	private partySize(): number {
		return this.gameSession.snapshot().party.members.length;
	}

	private labelValue(x: number, y: number, label: string, value: string): void {
		this.text(x, y, label, { fontSize: "4px", color: "#839eb8" });
		this.text(x, y + 7, value, { fontSize: "7px", color: "#f8edcf" });
	}

	private panel(x: number, y: number, width: number, height: number): void {
		this.track(
			this.add
				.rectangle(x + width / 2, y + height / 2, width, height, 0x0a1832, 0.97)
				.setStrokeStyle(1, 0x718aa2),
		);
	}

	private line(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		color: number,
	): void {
		const line = this.add.graphics().lineStyle(1, color, 0.8);
		line.beginPath();
		line.moveTo(x1, y1);
		line.lineTo(x2, y2);
		line.strokePath();
		this.track(line);
	}

	private help(message: string): void {
		this.text(160, 173, message, {
			fontSize: "5px",
			color: "#bcd1d7",
		}).setOrigin(0.5, 0);
	}

	private text(
		x: number,
		y: number,
		value: string,
		style: Phaser.Types.GameObjects.Text.TextStyle = {},
	): Phaser.GameObjects.Text {
		return this.track(
			this.add.text(x, y, value, {
				...baseTextStyle,
				...style,
			}),
		);
	}

	private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
		this.contentObjects.push(object);
		return object;
	}

	private clearContent(): void {
		for (const object of this.contentObjects) object.destroy();
		this.contentObjects = [];
	}
}
