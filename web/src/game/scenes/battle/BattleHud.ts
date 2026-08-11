import {
	ACTION_GAUGE_MAX,
	type BattleCombatant,
	type BattleItemStack,
	type BattleState,
} from "@shared/game";
import type Phaser from "phaser";
import { GAME_TEXT_RESOLUTION } from "../../display";
import { getNextEnemyIntentLabel } from "../../presentation/battle-presentation";

export type BattleMenuLayer = "commands" | "abilities" | "items" | "target";

export type BattleHudRenderState = {
	battleState: BattleState;
	isBossBattle: boolean;
	menuLayer: BattleMenuLayer;
	commandIndex: number;
	abilityIndex: number;
	itemIndex: number;
	status: string;
	actionAnimating: boolean;
	commands: readonly string[];
	availableItems: readonly BattleItemStack[];
	targetCandidates: readonly BattleCombatant[];
	targetIndex: number;
	combatantSprites: ReadonlyMap<string, Phaser.GameObjects.Image>;
	targetCursor?: Phaser.GameObjects.Triangle;
};

export class BattleHud {
	private partyText?: Phaser.GameObjects.Text;
	private enemyText?: Phaser.GameObjects.Text;
	private commandText?: Phaser.GameObjects.Text;
	private statusText?: Phaser.GameObjects.Text;
	private bossIntentText?: Phaser.GameObjects.Text;
	private gaugeGraphics?: Phaser.GameObjects.Graphics;
	private readonly cache = new Map<string, string>();

	constructor(private readonly scene: Phaser.Scene) {}

	create(isBossBattle: boolean): void {
		this.cache.clear();
		this.bossIntentText = undefined;
		const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
			fontFamily: '"Trebuchet MS", Arial, sans-serif',
			fontSize: "6px",
			fontStyle: "bold",
			color: "#f6edd4",
			lineSpacing: 1,
			resolution: GAME_TEXT_RESOLUTION,
		};
		if (isBossBattle) {
			this.bossIntentText = this.scene.add
				.text(11, 17, "", {
					fontFamily: '"Trebuchet MS", Arial, sans-serif',
					fontSize: "4px",
					fontStyle: "bold",
					color: "#72d7c0",
					resolution: GAME_TEXT_RESOLUTION,
				})
				.setDepth(21);
		}
		this.scene.add
			.rectangle(160, 164, 316, 54, 0x07101d, 0.96)
			.setStrokeStyle(1, 0x9a7a45)
			.setDepth(40);
		this.scene.add.rectangle(138, 164, 1, 48, 0x536879, 0.7).setDepth(41);
		const labelStyle = {
			...textStyle,
			fontSize: "4px",
			color: "#e4bd68",
		};
		this.scene.add.text(9, 139, "COMMAND", labelStyle).setDepth(42);
		this.scene.add.text(146, 139, "PARTY", labelStyle).setDepth(42);
		this.partyText = this.scene.add.text(146, 147, "", textStyle).setDepth(42);
		this.enemyText = this.scene.add
			.text(11, 26, "", {
				...textStyle,
				fontSize: "5px",
				color: "#e8eee9",
				backgroundColor: "#07101dcc",
				padding: { x: 3, y: 2 },
			})
			.setDepth(22);
		this.commandText = this.scene.add.text(9, 147, "", textStyle).setDepth(42);
		this.statusText = this.scene.add
			.text(160, 134, "", {
				...textStyle,
				fontSize: "6px",
				color: "#d6e1df",
				backgroundColor: "#07101dcc",
				padding: { x: 4, y: 2 },
				wordWrap: { width: 294, useAdvancedWrap: true },
				align: "center",
			})
			.setOrigin(0.5, 1)
			.setDepth(42);
		this.gaugeGraphics = this.scene.add.graphics().setDepth(43);
	}

	render(state: BattleHudRenderState): void {
		const boss = state.isBossBattle ? state.battleState.enemies[0] : undefined;
		this.setText(
			"boss-intent",
			this.bossIntentText,
			boss && boss.hp > 0 ? `NEXT ${getNextEnemyIntentLabel(boss)}` : "",
		);
		this.setText(
			"party",
			this.partyText,
			state.battleState.party
				.map(
					(member) =>
						`${member.name.padEnd(5)} HP ${String(member.hp).padStart(2)}/${member.maxHp}  MP ${member.mp}/${member.maxMp}${member.statuses.length > 0 ? `  ${member.statuses.map(({ id }) => id.toUpperCase()).join(",")}` : ""}`,
				)
				.join("\n"),
		);
		const showEnemyText = !state.isBossBattle;
		if (this.cache.get("enemy-visible") !== String(showEnemyText)) {
			this.enemyText?.setVisible(showEnemyText);
			this.cache.set("enemy-visible", String(showEnemyText));
		}
		this.setText(
			"enemy",
			this.enemyText,
			state.battleState.enemies
				.map(
					(enemy) =>
						`${enemy.name.toUpperCase()}  HP ${enemy.hp}/${enemy.maxHp}${enemy.statuses.length > 0 ? ` [${enemy.statuses.map(({ id }) => id.toUpperCase()).join(",")}]` : ""}`,
				)
				.join("  /  "),
		);

		const actor = state.battleState.party.find(
			(member) => member.id === state.battleState.activeActorId,
		);
		if (state.battleState.phase === "awaiting-command" && actor) {
			let entries: readonly string[];
			let selectedIndex: number;
			if (state.menuLayer === "abilities") {
				entries = actor.abilities.map(
					(ability) =>
						`${ability.name} ${ability.mpCost}MP ${ability.target.replace("-", " ")}`,
				);
				selectedIndex = state.abilityIndex;
			} else if (state.menuLayer === "items") {
				entries = state.availableItems.map(
					(item) => `${item.name} ×${item.count}`,
				);
				selectedIndex = state.itemIndex;
			} else if (state.menuLayer === "target") {
				entries = ["SELECT TARGET", "Z CONFIRM", "X BACK"];
				selectedIndex = -1;
			} else {
				entries = state.commands.map((command) =>
					command === "Escape" && !state.battleState.canEscape
						? "Escape —"
						: command,
				);
				selectedIndex = state.commandIndex;
			}
			this.setText(
				"command",
				this.commandText,
				entries
					.map(
						(entry, index) => `${index === selectedIndex ? ">" : " "} ${entry}`,
					)
					.join("\n"),
			);
		} else {
			this.setText(
				"command",
				this.commandText,
				state.battleState.phase === "running"
					? "ACTIVE TIME\n\nWAIT"
					: state.battleState.phase.toUpperCase(),
			);
		}
		this.setText("status", this.statusText, state.status);

		const gaugeSignature = JSON.stringify({
			boss: boss ? [boss.hp, boss.maxHp] : null,
			party: state.battleState.party.map(({ id, actionGauge }) => [
				id,
				actionGauge,
			]),
		});
		if (this.cache.get("gauges") !== gaugeSignature) {
			this.cache.set("gauges", gaugeSignature);
			this.gaugeGraphics?.clear();
			if (state.isBossBattle) {
				const ratio = boss ? boss.hp / boss.maxHp : 0;
				this.gaugeGraphics?.fillStyle(0x36101f, 1);
				this.gaugeGraphics?.fillRect(101, 17, 205, 4);
				this.gaugeGraphics?.fillStyle(0xc24f52, 1);
				this.gaugeGraphics?.fillRect(101, 17, 205 * ratio, 4);
				this.gaugeGraphics?.fillStyle(0xf2cf7a, 1);
				this.gaugeGraphics?.fillRect(101, 17, 205 * ratio, 1);
			}
			state.battleState.party.forEach((member, index) => {
				const width = 45 * (member.actionGauge / ACTION_GAUGE_MAX);
				this.gaugeGraphics?.fillStyle(0x243149, 1);
				this.gaugeGraphics?.fillRect(262, 150 + index * 15, 45, 3);
				this.gaugeGraphics?.fillStyle(
					member.actionGauge >= ACTION_GAUGE_MAX ? 0x72d7c0 : 0xe4bd68,
					1,
				);
				this.gaugeGraphics?.fillRect(262, 150 + index * 15, width, 3);
			});
		}

		for (const combatant of [
			...state.battleState.party,
			...state.battleState.enemies,
		]) {
			if (!state.actionAnimating) {
				state.combatantSprites
					.get(combatant.id)
					?.setAlpha(combatant.hp > 0 ? 1 : 0.18);
			}
		}

		const target =
			state.targetCandidates[state.targetIndex % state.targetCandidates.length];
		const targetSprite = target
			? state.combatantSprites.get(target.id)
			: undefined;
		state.targetCursor
			?.setVisible(
				state.battleState.phase === "awaiting-command" &&
					state.menuLayer === "target" &&
					Boolean(targetSprite),
			)
			.setPosition(
				targetSprite?.x ?? 0,
				(targetSprite?.y ?? 0) - (targetSprite?.displayHeight ?? 34) - 4,
			);
	}

	private setText(
		key: string,
		text: Phaser.GameObjects.Text | undefined,
		value: string,
	): void {
		if (!text || this.cache.get(key) === value) return;
		this.cache.set(key, value);
		text.setText(value);
	}
}
