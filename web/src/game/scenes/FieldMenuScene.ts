import {
	type CharacterState,
	experienceRequiredForLevel,
	type GameSession,
} from "@shared/game";
import Phaser from "phaser";
import {
	GAME_LOGICAL_HEIGHT,
	GAME_LOGICAL_WIDTH,
	GAME_RENDER_SCALE,
} from "../display";
import { InputManager } from "../input/InputManager";
import {
	equipmentSlotLabel,
	equipmentSlots,
	getCharacterJob,
	getEquipmentRows,
	getFieldMenuItems,
	nextEquipmentCandidate,
} from "../menu/menu-data";
import type { GameAudioManager } from "../audio/GameAudioManager";
import { addUiBitmapText, type UiBitmapTextStyle } from "../ui/bitmap-font";
import { OPEN_GAME_SETTINGS_EVENT } from "../settings/settings-events";

type MenuPage = "root" | "status" | "equipment" | "items";

const menuCommands = [
	{ id: "status", label: "STATUS" },
	{ id: "equipment", label: "EQUIPMENT" },
	{ id: "items", label: "ITEMS" },
	{ id: "settings", label: "SETTINGS" },
	{ id: "return", label: "RETURN" },
] as const;

export class FieldMenuScene extends Phaser.Scene {
	private inputManager?: InputManager;
	private page: MenuPage = "root";
	private menuIndex = 0;
	private actorIndex = 0;
	private itemIndex = 0;
	private equipmentIndex = 0;
	private itemTargeting = false;
	private feedback = "";
	private contentObjects: Phaser.GameObjects.GameObject[] = [];

	constructor(
		private readonly gameSession: GameSession,
		private readonly audioManager: GameAudioManager,
	) {
		super("field-menu");
	}

	create(): void {
		this.page = "root";
		this.menuIndex = 0;
		this.actorIndex = 0;
		this.itemIndex = 0;
		this.equipmentIndex = 0;
		this.itemTargeting = false;
		this.feedback = "";
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
		this.inputManager.update();
		this.playInputAudio();
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

	private playInputAudio(): void {
		if (!this.inputManager) return;
		if (
			this.inputManager.justPressed("UP") ||
			this.inputManager.justPressed("DOWN") ||
			this.inputManager.justPressed("LEFT") ||
			this.inputManager.justPressed("RIGHT")
		) {
			this.audioManager.playSe("se-ui-navigate");
		} else if (this.inputManager.justPressed("CONFIRM")) {
			this.audioManager.playSe("se-ui-confirm");
		} else if (
			this.inputManager.justPressed("CANCEL") ||
			this.inputManager.justPressed("MENU")
		) {
			this.audioManager.playSe("se-ui-cancel");
		}
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
		if (selected.id === "settings") {
			window.dispatchEvent(new Event(OPEN_GAME_SETTINGS_EVENT));
			return;
		}
		this.page = selected.id;
		this.renderPage();
	}

	private handleDetailInput(): void {
		if (!this.inputManager) return;
		if (this.inputManager.justPressed("CANCEL")) {
			if (this.page === "items" && this.itemTargeting) {
				this.itemTargeting = false;
				this.feedback = "";
				this.renderPage();
				return;
			}
			this.page = "root";
			this.feedback = "";
			this.renderPage();
			return;
		}
		if (this.page === "items") {
			this.handleItemInput();
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
		if (this.page === "equipment") {
			if (this.inputManager.justPressed("UP")) {
				this.equipmentIndex =
					(this.equipmentIndex + equipmentSlots.length - 1) %
					equipmentSlots.length;
				this.renderPage();
			}
			if (this.inputManager.justPressed("DOWN")) {
				this.equipmentIndex = (this.equipmentIndex + 1) % equipmentSlots.length;
				this.renderPage();
			}
			if (this.inputManager.justPressed("CONFIRM")) {
				this.changeEquipment();
			}
		}
	}

	private handleItemInput(): void {
		if (!this.inputManager) return;
		const snapshot = this.gameSession.snapshot();
		const items = getFieldMenuItems(snapshot, this.gameSession.content);
		if (items.length === 0) return;
		this.itemIndex %= items.length;
		if (this.itemTargeting) {
			const partySize = snapshot.party.members.length;
			if (this.inputManager.justPressed("LEFT")) {
				this.actorIndex = (this.actorIndex + partySize - 1) % partySize;
				this.renderPage();
			}
			if (this.inputManager.justPressed("RIGHT")) {
				this.actorIndex = (this.actorIndex + 1) % partySize;
				this.renderPage();
			}
			if (this.inputManager.justPressed("CONFIRM")) {
				const target = snapshot.party.members[this.actorIndex];
				const item = items[this.itemIndex];
				try {
					const transition = this.gameSession.dispatch({
						type: "party.item.use",
						itemId: item.id,
						targetId: target.id,
					});
					const used = transition.events.find(
						({ event }) => event.type === "party.item.used",
					);
					this.feedback = used
						? `${item.name} used on ${target.name}.`
						: `${item.name} had no effect.`;
					this.itemTargeting = false;
					const remaining = getFieldMenuItems(
						transition.state,
						this.gameSession.content,
					);
					this.itemIndex = Math.min(
						this.itemIndex,
						Math.max(0, remaining.length - 1),
					);
				} catch {
					this.feedback = `${item.name} cannot be used on ${target.name}.`;
				}
				this.renderPage();
			}
			return;
		}
		if (this.inputManager.justPressed("UP")) {
			this.itemIndex = (this.itemIndex + items.length - 1) % items.length;
			this.feedback = "";
			this.renderPage();
		}
		if (this.inputManager.justPressed("DOWN")) {
			this.itemIndex = (this.itemIndex + 1) % items.length;
			this.feedback = "";
			this.renderPage();
		}
		if (this.inputManager.justPressed("CONFIRM")) {
			const item = items[this.itemIndex];
			if (item.usable) {
				this.itemTargeting = true;
				this.feedback = "Choose a party member.";
			} else {
				this.feedback = "This is a key item and cannot be used.";
			}
			this.renderPage();
		}
	}

	private changeEquipment(): void {
		const snapshot = this.gameSession.snapshot();
		const actor = snapshot.party.members[this.actorIndex];
		const slot = equipmentSlots[this.equipmentIndex];
		const equipmentId = nextEquipmentCandidate(
			snapshot,
			this.gameSession.content,
			actor.id,
			slot,
		);
		try {
			this.gameSession.dispatch({
				type: "party.equipment.change",
				actorId: actor.id,
				slot,
				equipmentId,
			});
			this.feedback = equipmentId
				? `${this.gameSession.content.getEquipment(equipmentId).displayName} equipped.`
				: `${equipmentSlotLabel(slot)} removed.`;
		} catch {
			this.feedback = "No compatible equipment is available.";
		}
		this.renderPage();
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
			const y = 34 + index * 25;
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
			this.text(125, rowY + 4, member.name.toUpperCase(), {
				fontSize: "8px",
				color: "#f8edcf",
			});
			this.text(
				125,
				rowY + 16,
				getCharacterJob(this.gameSession.content, member.id),
				{
					fontSize: "5px",
					color: "#72d7c0",
				},
			);
			this.text(210, rowY + 6, `LV ${member.level}`, { fontSize: "5px" });
			this.text(210, rowY + 18, `HP ${member.hp}/${member.maxHp}`, {
				fontSize: "6px",
			});
			this.text(268, rowY + 18, `MP ${member.mp}/${member.maxMp}`, {
				fontSize: "5px",
				color: "#8bd8ed",
			});
		});
		this.help("UP / DOWN  SELECT     Z / ENTER  OPEN     X / ESC  CLOSE");
	}

	private renderStatus(): void {
		this.panel(5, 27, 310, 136);
		const member = this.selectedMember();
		const actor = this.gameSession.content.getActor(member.id);
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
		this.text(79, 54, getCharacterJob(this.gameSession.content, member.id), {
			fontSize: "6px",
			color: "#72d7c0",
		});
		this.text(298, 40, `◀  ${this.actorIndex + 1} / ${this.partySize()}  ▶`, {
			fontSize: "6px",
		}).setOrigin(1, 0);
		this.line(76, 66, 299, 66, 0x536f8b);
		this.labelValue(79, 73, "LEVEL", String(member.level));
		this.labelValue(132, 73, "HP", `${member.hp} / ${member.maxHp}`);
		this.labelValue(220, 73, "MP", `${member.mp} / ${member.maxMp}`);
		const nextLevel = Math.min(50, member.level + 1);
		this.labelValue(
			79,
			91,
			"EXP",
			member.level >= 50
				? `${member.experience} / MAX`
				: `${member.experience} / ${experienceRequiredForLevel(nextLevel)}`,
		);
		this.labelValue(165, 91, "ATTACK", String(member.attack));
		this.labelValue(220, 91, "DEFENSE", String(member.defense));
		this.labelValue(270, 91, "SPEED", String(member.speed));
		this.text(79, 116, "LEARNED ABILITIES", {
			fontSize: "5px",
			color: "#839eb8",
		});
		this.text(
			79,
			128,
			member.abilities
				.map((ability) => `${ability.name}  ${ability.mpCost} MP`)
				.join("   "),
			{
				fontSize: "6px",
				color: "#f8edcf",
			},
		);
		this.help("LEFT / RIGHT  PARTY MEMBER     X / ESC  BACK     M  CLOSE");
	}

	private renderEquipment(): void {
		this.panel(5, 27, 310, 136);
		const member = this.selectedMember();
		const actor = this.gameSession.content.getActor(member.id);
		const snapshot = this.gameSession.snapshot();
		const loadout = snapshot.party.equipment[member.id];
		const rows = getEquipmentRows(
			this.gameSession.content,
			loadout ?? { weapon: null, armor: null, "off-hand": null, relic: null },
		);
		this.track(
			this.add.image(38, 97, actor.textureKey).setOrigin(0.5, 1).setScale(1.18),
		);
		this.text(16, 106, member.name.toUpperCase(), {
			fontSize: "8px",
			color: "#f2cf7a",
		});
		this.text(16, 119, getCharacterJob(this.gameSession.content, member.id), {
			fontSize: "5px",
			color: "#72d7c0",
		});
		this.text(16, 136, `ATK ${member.attack}   DEF ${member.defense}`, {
			fontSize: "5px",
		});
		this.text(298, 30, `◀  ${this.actorIndex + 1} / ${this.partySize()}  ▶`, {
			fontSize: "6px",
		}).setOrigin(1, 0);
		rows.forEach((equipment, index) => {
			const y = 43 + index * 27;
			this.track(
				this.add
					.rectangle(194, y + 10, 222, 24, 0x0c1a35, 0.92)
					.setStrokeStyle(
						1,
						index === this.equipmentIndex ? 0x72d7c0 : 0x314b66,
					),
			);
			if (index === this.equipmentIndex) {
				this.text(85, y + 3, "▶", { color: "#f2cf7a" });
			}
			this.text(94, y + 3, equipmentSlotLabel(equipment.slot), {
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
		if (this.feedback) {
			this.text(194, 151, this.feedback, {
				fontSize: "4px",
				color: "#72d7c0",
			}).setOrigin(0.5, 0);
		}
		this.help("UP/DOWN SLOT  LEFT/RIGHT MEMBER  Z CHANGE  X BACK");
	}

	private renderItems(): void {
		this.panel(5, 27, 310, 136);
		const snapshot = this.gameSession.snapshot();
		const items = getFieldMenuItems(snapshot, this.gameSession.content);
		if (items.length > 0) this.itemIndex %= items.length;
		this.text(15, 34, "INVENTORY", { fontSize: "6px", color: "#72d7c0" });
		this.text(302, 35, this.itemTargeting ? "SELECT TARGET" : "USE ITEM", {
			fontSize: "4px",
			color: "#839eb8",
		}).setOrigin(1, 0);
		const firstVisibleItem = Math.floor(this.itemIndex / 5) * 5;
		items
			.slice(firstVisibleItem, firstVisibleItem + 5)
			.forEach((item, index) => {
				const absoluteIndex = firstVisibleItem + index;
				const y = 45 + index * 19;
				if (absoluteIndex === this.itemIndex) {
					this.track(
						this.add
							.rectangle(160, y + 7, 286, 18, 0x244d73, 0.95)
							.setStrokeStyle(1, 0x72d7c0),
					);
					this.text(14, y + 2, "▶", { color: "#f2cf7a" });
				}
				this.text(27, y + 2, item.name, {
					fontSize: "7px",
					color: absoluteIndex === this.itemIndex ? "#ffffff" : "#c4d0d8",
				});
				this.text(296, y + 2, `× ${item.count}`, { fontSize: "6px" }).setOrigin(
					1,
					0,
				);
			});
		this.line(14, 143, 304, 143, 0x536f8b);
		const selected = items[this.itemIndex];
		this.text(
			18,
			145,
			this.feedback || selected?.description || "The inventory is empty.",
			{
				fontSize: "5px",
				color: this.feedback ? "#72d7c0" : "#bcd1d7",
			},
		);
		if (this.itemTargeting) {
			const member = snapshot.party.members[this.actorIndex];
			this.text(
				296,
				145,
				`◀ ${member.name.toUpperCase()} HP ${member.hp}/${member.maxHp} MP ${member.mp}/${member.maxMp} ▶`,
				{ fontSize: "4px", color: "#f2cf7a" },
			).setOrigin(1, 0);
		}
		this.help(
			this.itemTargeting
				? "LEFT / RIGHT TARGET   Z USE   X BACK"
				: "UP / DOWN ITEM   Z SELECT   X BACK   M CLOSE",
		);
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
		style: UiBitmapTextStyle = {},
	): Phaser.GameObjects.BitmapText {
		return this.track(
			addUiBitmapText(this, x, y, value, {
				fontSize: "6px",
				color: "#f7f1df",
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
