import Phaser from "phaser";
import {
	ACTION_GAUGE_MAX,
	createSignalRuinsEncounterState,
	type BattleCombatant,
	type BattleEvent,
	type BattleState,
	type GameSession,
} from "@shared/game";
import { InputManager } from "../input/InputManager";

const commands = ["Attack", "Ability", "Defend"] as const;
const partyTextureKeys = ["field-mira", "field-sol", "field-lune"];
const enemyTextureKeys = ["enemy-ash-wisp", "enemy-brass-hound"];

export class BattleScene extends Phaser.Scene {
	private inputManager?: InputManager;
	private battleState!: BattleState;
	private commandIndex = 0;
	private targetIndex = 0;
	private status = "The dormant signal takes shape.";
	private partyText?: Phaser.GameObjects.Text;
	private enemyText?: Phaser.GameObjects.Text;
	private commandText?: Phaser.GameObjects.Text;
	private statusText?: Phaser.GameObjects.Text;
	private gaugeGraphics?: Phaser.GameObjects.Graphics;
	private targetCursor?: Phaser.GameObjects.Triangle;
	private readonly combatantSprites = new Map<
		string,
		Phaser.GameObjects.Image
	>();

	constructor(private readonly gameSession: GameSession) {
		super("battle");
	}

	create(): void {
		this.inputManager = new InputManager(this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.inputManager?.destroy();
		});

		const battle = this.gameSession.snapshot().battle;
		if (!battle) throw new Error("BattleScene requires an active battle.");
		this.battleState = battle;
		this.commandIndex = 0;
		this.targetIndex = 0;
		this.status = "The dormant signal takes shape.";
		this.combatantSprites.clear();

		this.drawStage();
		this.createCombatants();
		this.createHud();
		this.renderHud();
	}

	update(_time: number, delta: number): void {
		if (this.battleState.phase === "running") {
			const transition = this.gameSession.dispatch({
				type: "battle.tick",
				deltaMs: Math.min(delta, 250),
			});
			if (transition.state.battle) this.battleState = transition.state.battle;
			this.updateStatus(this.battleEvents(transition.events));
		} else if (this.battleState.phase === "awaiting-command") {
			this.handleCommandInput();
		} else if (this.inputManager?.justPressed("CONFIRM")) {
			if (this.battleState.phase === "victory") {
				const completed = this.gameSession.dispatch({
					type: "battle.complete",
				});
				this.gameSession.dispatch({
					type: "story.flag.set",
					flagId: "signal-ruins-cleared",
					value: true,
				});
				const checkpoint = completed.state.field.partyPositions[0];
				this.gameSession.dispatch({
					type: "checkpoint.reached",
					mapId: completed.state.currentMap.id,
					checkpoint,
				});
				this.scene.start("field", { victory: true });
			} else {
				this.gameSession.dispatch({
					type: "battle.start",
					battle: createSignalRuinsEncounterState(
						this.gameSession.snapshot().party.members,
					),
				});
				this.scene.restart();
			}
		}
		this.renderHud();
	}

	private handleCommandInput(): void {
		if (!this.inputManager) return;
		if (this.inputManager.justPressed("UP")) {
			this.commandIndex =
				(this.commandIndex + commands.length - 1) % commands.length;
		}
		if (this.inputManager.justPressed("DOWN")) {
			this.commandIndex = (this.commandIndex + 1) % commands.length;
		}

		const livingEnemies = this.battleState.enemies.filter(
			(enemy) => enemy.hp > 0,
		);
		if (livingEnemies.length > 0) {
			if (this.inputManager.justPressed("LEFT")) {
				this.targetIndex =
					(this.targetIndex + livingEnemies.length - 1) % livingEnemies.length;
			}
			if (this.inputManager.justPressed("RIGHT")) {
				this.targetIndex = (this.targetIndex + 1) % livingEnemies.length;
			}
		}

		if (!this.inputManager.justPressed("CONFIRM")) return;
		const actorId = this.battleState.activeActorId;
		if (!actorId) return;
		const actor = this.battleState.party.find(
			(member) => member.id === actorId,
		);
		if (!actor) return;

		const selected = commands[this.commandIndex];
		const target = livingEnemies[this.targetIndex % livingEnemies.length];
		if (selected !== "Defend" && !target) return;
		const battleCommand =
			selected === "Defend"
				? ({
						type: "defend",
						actorId,
					} as const)
				: selected === "Ability"
					? ({
							type: "ability",
							actorId,
							targetId: target.id,
							abilityId: actor.ability.id,
						} as const)
					: ({
							type: "attack",
							actorId,
							targetId: target.id,
						} as const);
		const transition = this.gameSession.dispatch({
			type: "battle.command",
			command: battleCommand,
		});
		if (transition.state.battle) this.battleState = transition.state.battle;
		this.commandIndex = 0;
		this.targetIndex = 0;
		this.updateStatus(this.battleEvents(transition.events));
	}

	private battleEvents(
		events: ReturnType<GameSession["dispatch"]>["events"],
	): BattleEvent[] {
		return events.flatMap((envelope) =>
			envelope.event.type === "battle.event"
				? [envelope.event.battleEvent]
				: [],
		);
	}

	private updateStatus(events: BattleEvent[]): void {
		const event = events.at(-1);
		if (!event) return;
		switch (event.type) {
			case "gauge.ready": {
				const actor = this.findCombatant(event.actorId);
				this.status = `${actor?.name ?? "An ally"} is ready.`;
				break;
			}
			case "action.damage": {
				const actor = this.findCombatant(event.actorId);
				const target = this.findCombatant(event.targetId);
				this.status = `${actor?.name ?? "Unknown"} hits ${target?.name ?? "the target"} for ${event.amount}.`;
				this.flashCombatant(event.targetId);
				break;
			}
			case "action.defend": {
				const actor = this.findCombatant(event.actorId);
				this.status = `${actor?.name ?? "An ally"} braces for impact.`;
				break;
			}
			case "combatant.defeated": {
				const target = this.findCombatant(event.combatantId);
				this.status = `${target?.name ?? "The target"} falls.`;
				break;
			}
			case "battle.ended":
				this.status =
					event.result === "victory"
						? "Victory. Press confirm to return to the ruins."
						: "The party was overwhelmed. Press confirm to retry.";
				break;
		}
	}

	private flashCombatant(combatantId: string): void {
		const sprite = this.combatantSprites.get(combatantId);
		if (!sprite) return;
		this.tweens.add({
			targets: sprite,
			alpha: { from: 0.25, to: 1 },
			duration: 70,
			repeat: 2,
		});
		this.cameras.main.shake(80, 0.003);
	}

	private findCombatant(combatantId: string): BattleCombatant | undefined {
		return [...this.battleState.party, ...this.battleState.enemies].find(
			(combatant) => combatant.id === combatantId,
		);
	}

	private drawStage(): void {
		this.cameras.main.setBackgroundColor("#091225");
		this.add.image(160, 96, "signal-ruins-battle").setDepth(0);
		this.add.rectangle(160, 96, 320, 192, 0x07101d, 0.08).setDepth(0.5);
		this.add.rectangle(63, 12, 108, 17, 0x07101d, 0.78).setDepth(20);
		this.add
			.text(11, 6, "DORMANT SIGNAL", {
				fontFamily: "monospace",
				fontSize: "8px",
				color: "#f2cf7a",
				shadow: { color: "#07101d", offsetX: 1, offsetY: 1, fill: true },
			})
			.setDepth(21);
	}

	private createCombatants(): void {
		const enemyPositions = [
			{ x: 76, y: 98, scale: 1.6 },
			{ x: 121, y: 112, scale: 1.5 },
		];
		this.battleState.enemies.forEach((enemy, index) => {
			const position = enemyPositions[index];
			this.add
				.ellipse(position.x, position.y + 4, 28, 7, 0x050914, 0.55)
				.setDepth(4);
			const sprite = this.add
				.image(position.x, position.y, enemyTextureKeys[index])
				.setOrigin(0.5, 1)
				.setScale(position.scale)
				.setDepth(5);
			this.combatantSprites.set(enemy.id, sprite);
			this.tweens.add({
				targets: sprite,
				y: position.y - 2,
				duration: 1_250 + index * 170,
				yoyo: true,
				repeat: -1,
				ease: "Sine.easeInOut",
			});
		});

		const partyPositions = [
			{ x: 244, y: 91 },
			{ x: 269, y: 107 },
			{ x: 294, y: 123 },
		];
		this.battleState.party.forEach((member, index) => {
			const position = partyPositions[index];
			this.add
				.ellipse(position.x, position.y + 1, 17, 5, 0x050914, 0.58)
				.setDepth(4 + index * 2);
			const sprite = this.add
				.image(position.x, position.y, partyTextureKeys[index])
				.setOrigin(0.5, 1)
				.setScale(1.5)
				.setDepth(5 + index * 2);
			this.combatantSprites.set(member.id, sprite);
		});

		this.targetCursor = this.add
			.triangle(0, 0, 0, 0, 6, 0, 3, 5, 0xf2cf7a)
			.setDepth(30)
			.setVisible(false);
		this.tweens.add({
			targets: this.targetCursor,
			y: "+=3",
			duration: 360,
			yoyo: true,
			repeat: -1,
			ease: "Sine.easeInOut",
		});
	}

	private createHud(): void {
		const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
			fontFamily: "monospace",
			fontSize: "6px",
			color: "#f6edd4",
			lineSpacing: 1,
		};
		this.add
			.rectangle(160, 164, 316, 54, 0x07101d, 0.96)
			.setStrokeStyle(1, 0x9a7a45)
			.setDepth(40);
		this.add.rectangle(107, 164, 1, 48, 0x536879, 0.7).setDepth(41);
		this.add.rectangle(213, 164, 1, 48, 0x536879, 0.7).setDepth(41);
		this.partyText = this.add.text(8, 142, "", textStyle).setDepth(42);
		this.enemyText = this.add.text(114, 142, "", textStyle).setDepth(42);
		this.commandText = this.add.text(221, 142, "", textStyle).setDepth(42);
		this.statusText = this.add
			.text(160, 130, "", {
				...textStyle,
				fontSize: "6px",
				color: "#d6e1df",
				backgroundColor: "#07101dcc",
				padding: { x: 4, y: 2 },
			})
			.setOrigin(0.5, 1)
			.setDepth(42);
		this.gaugeGraphics = this.add.graphics().setDepth(43);
	}

	private renderHud(): void {
		this.partyText?.setText(
			this.battleState.party
				.map(
					(member) =>
						`${member.name.padEnd(5)} ${String(member.hp).padStart(2)}/${member.maxHp}`,
				)
				.join("\n\n"),
		);
		this.enemyText?.setText(
			this.battleState.enemies
				.map((enemy) => `${enemy.name}\nHP ${enemy.hp}/${enemy.maxHp}`)
				.join("\n"),
		);

		const actor = this.battleState.party.find(
			(member) => member.id === this.battleState.activeActorId,
		);
		if (this.battleState.phase === "awaiting-command" && actor) {
			this.commandText?.setText(
				commands
					.map((command, index) => {
						const label = command === "Ability" ? actor.ability.name : command;
						return `${index === this.commandIndex ? ">" : " "} ${label}`;
					})
					.join("\n"),
			);
		} else {
			this.commandText?.setText(
				this.battleState.phase === "running"
					? "ACTIVE TIME\n\nWAIT"
					: this.battleState.phase.toUpperCase(),
			);
		}
		this.statusText?.setText(this.status);

		this.gaugeGraphics?.clear();
		this.battleState.party.forEach((member, index) => {
			const width = 38 * (member.actionGauge / ACTION_GAUGE_MAX);
			this.gaugeGraphics?.fillStyle(0x243149, 1);
			this.gaugeGraphics?.fillRect(66, 149 + index * 15, 38, 3);
			this.gaugeGraphics?.fillStyle(
				member.actionGauge >= ACTION_GAUGE_MAX ? 0x72d7c0 : 0xe4bd68,
				1,
			);
			this.gaugeGraphics?.fillRect(66, 149 + index * 15, width, 3);
		});

		for (const combatant of [
			...this.battleState.party,
			...this.battleState.enemies,
		]) {
			this.combatantSprites
				.get(combatant.id)
				?.setAlpha(combatant.hp > 0 ? 1 : 0.18);
		}

		const livingEnemies = this.battleState.enemies.filter(
			(enemy) => enemy.hp > 0,
		);
		const target = livingEnemies[this.targetIndex % livingEnemies.length];
		const targetSprite = target
			? this.combatantSprites.get(target.id)
			: undefined;
		this.targetCursor
			?.setVisible(
				this.battleState.phase === "awaiting-command" && Boolean(targetSprite),
			)
			.setPosition(targetSprite?.x ?? 0, (targetSprite?.y ?? 0) - 38);
	}
}
