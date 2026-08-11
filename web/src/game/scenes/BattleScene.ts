import {
	type BattleCombatant,
	type BattleCommand,
	type BattleEvent,
	type BattleState,
	createGameCorrelationId,
	type GameSession,
	levelForExperience,
} from "@shared/game";
import Phaser from "phaser";
import { getBattleCharacterTextureKey } from "../art/pixel-textures";
import { battleMusicForEncounter } from "../audio/audio-catalog";
import type { GameAudioManager } from "../audio/GameAudioManager";
import { browserGameDiagnostics } from "../diagnostics/BrowserGameDiagnostics";
import {
	GAME_LOGICAL_HEIGHT,
	GAME_LOGICAL_WIDTH,
	GAME_RENDER_SCALE,
	GAME_TEXT_RESOLUTION,
} from "../display";
import { BattleAnimationDirector } from "./battle/BattleAnimationDirector";
import { BattleHud } from "./battle/BattleHud";
import {
	BATTLE_COMMAND_LABELS,
	BattleInputController,
} from "./battle/BattleInputController";
import {
	BATTLE_LOGICAL_STEP_MS,
	BattleSimulationClock,
} from "./battle/BattleSimulationClock";
import {
	battleEnemyPosition,
	battlePartyPosition,
} from "./battle/battle-layout";

const enemyTextureKeys: Readonly<Record<string, string>> = {
	"ash-wisp": "enemy-ash-wisp",
	"brass-hound": "enemy-brass-hound",
	"signal-warden": "enemy-signal-warden",
};
const SIGNAL_RUINS_BOSS_ID = "signal-ruins-encounter";
export class BattleScene extends Phaser.Scene {
	private inputController?: BattleInputController;
	private battleState!: BattleState;
	private actionAnimating = false;
	private victoryAcknowledged = false;
	private status = "The encounter takes shape.";
	private targetCursor?: Phaser.GameObjects.Triangle;
	private readonly combatantSprites = new Map<
		string,
		Phaser.GameObjects.Image
	>();
	private readonly simulationClock = new BattleSimulationClock();
	private readonly hud = new BattleHud(this);
	private readonly animationDirector: BattleAnimationDirector;

	constructor(
		private readonly gameSession: GameSession,
		private readonly audioManager: GameAudioManager,
	) {
		super("battle");
		this.animationDirector = new BattleAnimationDirector(
			this,
			this.gameSession,
			this.audioManager,
			this.combatantSprites,
			{
				getBattleState: () => this.battleState,
				setAnimating: (animating) => {
					this.actionAnimating = animating;
				},
				updateStatus: (events) => this.updateStatus(events),
				renderHud: () => this.renderHud(),
			},
		);
	}

	create(): void {
		this.inputController = new BattleInputController(this, this.audioManager);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.inputController?.destroy();
		});

		const battle = this.gameSession.snapshot().battle;
		if (!battle) throw new Error("BattleScene requires an active battle.");
		this.battleState = battle;
		this.audioManager.playBgm(battleMusicForEncounter(battle.id));
		if (battle.id === SIGNAL_RUINS_BOSS_ID) {
			this.audioManager.playSe("se-battle-boss-roar");
		}
		this.inputController.reset();
		this.actionAnimating = false;
		this.victoryAcknowledged = false;
		this.status =
			battle.id === SIGNAL_RUINS_BOSS_ID
				? "The Signal Warden awakens."
				: "Enemies emerge from the dark.";
		this.combatantSprites.clear();
		this.simulationClock.reset();

		this.configureCamera();
		this.drawStage();
		this.createCombatants();
		this.hud.create(this.isBossBattle());
		this.renderHud();
	}

	update(_time: number, delta: number): void {
		this.inputController?.update(this.actionAnimating);
		if (this.actionAnimating) {
			this.simulationClock.advance(delta, false);
			this.renderHud();
			return;
		}
		if (this.battleState.phase === "running") {
			const clock = this.simulationClock.advance(delta, true);
			if (clock.droppedMs > 0) {
				browserGameDiagnostics.capture({
					event: "battle.catch-up-clamped",
					correlationId: createGameCorrelationId(),
					sessionId: this.gameSession.id,
					stateRevision: this.gameSession.revision,
					mode: "battle",
					mapId: this.gameSession.snapshot().location.mapId,
					count: Math.min(1_000_000, Math.round(clock.droppedMs)),
				});
			}
			for (let step = 0; step < clock.steps; step += 1) {
				if (this.battleState.phase !== "running" || this.actionAnimating) break;
				const transition = this.gameSession.dispatch({
					type: "battle.tick",
					deltaMs: BATTLE_LOGICAL_STEP_MS,
				});
				if (transition.state.battle) this.battleState = transition.state.battle;
				const events = this.battleEvents(transition.events);
				this.playBattleEvents(events);
			}
		} else if (this.battleState.phase === "awaiting-command") {
			this.simulationClock.advance(delta, false);
			this.inputController?.handleCommandInput(
				this.battleState,
				(command) => this.executeCommand(command),
				(status) => {
					this.status = status;
				},
			);
		} else if (this.inputController?.justPressed("CONFIRM")) {
			this.simulationClock.advance(delta, false);
			if (
				this.battleState.phase === "victory" ||
				this.battleState.phase === "escaped"
			) {
				if (this.battleState.phase === "victory" && !this.victoryAcknowledged) {
					this.victoryAcknowledged = true;
					this.status = this.createVictorySummary();
					return;
				}
				const completed = this.gameSession.dispatch({
					type: "battle.complete",
				});
				this.scene.start(completed.state.mode);
			} else {
				this.gameSession.dispatch({ type: "battle.retry" });
				this.scene.restart();
			}
		}
		this.renderHud();
	}

	private executeCommand(command: BattleCommand): void {
		try {
			const transition = this.gameSession.dispatch({
				type: "battle.command",
				command,
			});
			if (transition.state.battle) this.battleState = transition.state.battle;
			this.inputController?.resetAfterCommand();
			this.playBattleEvents(this.battleEvents(transition.events));
		} catch (error) {
			this.status =
				error instanceof Error ? error.message : "The command failed.";
		}
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
				const ability = actor?.abilities.find(
					({ id }) => id === event.abilityId,
				);
				const affinity =
					event.multiplier > 1
						? " Weakness!"
						: event.multiplier < 1
							? " Resisted."
							: "";
				this.status = event.abilityId
					? `${actor?.name ?? "Unknown"} uses ${ability?.name ?? "an ability"}! ${event.amount} damage.${affinity}`
					: `${actor?.name ?? "Unknown"} hits ${target?.name ?? "the target"} for ${event.amount}.${affinity}`;
				break;
			}
			case "action.heal": {
				const target = this.findCombatant(event.targetId);
				this.status = `${target?.name ?? "An ally"} recovers ${event.amount} HP.`;
				break;
			}
			case "resource.spent":
				break;
			case "item.used": {
				const item = this.battleState.items.find(
					({ id }) => id === event.itemId,
				);
				const target = this.findCombatant(event.targetId);
				this.status = `${item?.name ?? "Item"} used on ${target?.name ?? "an ally"}.`;
				break;
			}
			case "status.applied": {
				const target = this.findCombatant(event.targetId);
				this.status = `${target?.name ?? "The target"} gains ${event.statusId.toUpperCase()}.`;
				break;
			}
			case "status.damage": {
				const target = this.findCombatant(event.combatantId);
				this.status = `${target?.name ?? "The target"} suffers ${event.amount} ${event.statusId} damage.`;
				break;
			}
			case "status.expired": {
				const target = this.findCombatant(event.combatantId);
				this.status = `${event.statusId.toUpperCase()} fades from ${target?.name ?? "the target"}.`;
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
						? this.isBossBattle()
							? "The Warden's signal breaks. Press confirm to continue."
							: "Victory. Press confirm to continue."
						: event.result === "escaped"
							? "The party escaped. Press confirm to return."
							: "The party was overwhelmed. Press confirm to retry.";
				break;
		}
	}

	private playBattleEvents(events: BattleEvent[]): void {
		this.animationDirector.play(events);
	}
	private findCombatant(combatantId: string): BattleCombatant | undefined {
		return [...this.battleState.party, ...this.battleState.enemies].find(
			(combatant) => combatant.id === combatantId,
		);
	}

	private createVictorySummary(): string {
		const encounter = this.gameSession.content.getEncounter(
			this.battleState.id,
		);
		const persistentParty = this.gameSession.snapshot().party;
		const levelNames = persistentParty.members.flatMap((member) =>
			levelForExperience(member.experience + encounter.rewards.experience) >
			member.level
				? [member.name]
				: [],
		);
		const summary = [
			`${encounter.rewards.experience} EXP`,
			...encounter.rewards.items
				.filter(({ chance }) => chance >= 1)
				.map(
					({ itemId, quantity }) =>
						`${this.gameSession.content.getItem(itemId).displayName} ×${quantity}`,
				),
		];
		if (levelNames.length > 0) {
			summary.push(`LEVEL UP: ${levelNames.join(", ")}`);
		}
		return `VICTORY! ${summary.join(" · ")}\nPress confirm to continue.`;
	}

	private isBossBattle(): boolean {
		return this.battleState.id === SIGNAL_RUINS_BOSS_ID;
	}

	private drawStage(): void {
		this.cameras.main.setBackgroundColor("#091225");
		const snapshot = this.gameSession.snapshot();
		const map = this.gameSession.content.getMap(snapshot.location.mapId);
		this.add.image(160, 96, map.battleBackgroundAssetId).setDepth(0);
		this.add
			.rectangle(
				160,
				96,
				320,
				192,
				this.isBossBattle() ? 0x2a0717 : 0x07101d,
				this.isBossBattle() ? 0.18 : 0.08,
			)
			.setDepth(0.5);
		this.add
			.rectangle(
				this.isBossBattle() ? 160 : 63,
				12,
				this.isBossBattle() ? 310 : 108,
				this.isBossBattle() ? 23 : 17,
				this.isBossBattle() ? 0x190817 : 0x07101d,
				0.9,
			)
			.setStrokeStyle(1, this.isBossBattle() ? 0xc24f52 : 0x07101d, 0.9)
			.setDepth(20);
		this.add
			.text(11, 5, this.isBossBattle() ? "BOSS BATTLE" : "ENCOUNTER", {
				fontFamily: '"Trebuchet MS", Arial, sans-serif',
				fontSize: "8px",
				fontStyle: "bold",
				color: this.isBossBattle() ? "#ff8b79" : "#f2cf7a",
				resolution: GAME_TEXT_RESOLUTION,
				shadow: { color: "#07101d", offsetX: 1, offsetY: 1, fill: true },
			})
			.setDepth(21);
		if (this.isBossBattle()) {
			this.add
				.text(101, 5, "SIGNAL WARDEN", {
					fontFamily: '"Trebuchet MS", Arial, sans-serif',
					fontSize: "7px",
					fontStyle: "bold",
					color: "#f6edd4",
					resolution: GAME_TEXT_RESOLUTION,
				})
				.setDepth(21);
			this.cameras.main.flash(420, 126, 28, 45);
			this.cameras.main.shake(260, 0.002);
		}
	}

	private createCombatants(): void {
		this.battleState.enemies.forEach((enemy, index) => {
			const position = battleEnemyPosition(this.isBossBattle(), index);
			const textureKey =
				enemyTextureKeys[enemy.id] ?? enemyTextureKeys["ash-wisp"];
			if (this.isBossBattle()) {
				const aura = this.add
					.circle(position.x, position.y - 34, 34, 0x7d2847, 0.12)
					.setStrokeStyle(2, 0x72d7c0, 0.35)
					.setBlendMode(Phaser.BlendModes.ADD)
					.setDepth(3);
				this.tweens.add({
					targets: aura,
					alpha: { from: 0.18, to: 0.48 },
					scale: { from: 0.92, to: 1.08 },
					duration: 1_100,
					yoyo: true,
					repeat: -1,
					ease: "Sine.easeInOut",
				});
			}
			this.add
				.ellipse(
					position.x,
					position.y + 4,
					this.isBossBattle() ? 56 : 28,
					this.isBossBattle() ? 11 : 7,
					0x050914,
					0.62,
				)
				.setDepth(4);
			const sprite = this.add
				.image(position.x, position.y, textureKey)
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

		this.battleState.party.forEach((member, index) => {
			const position = battlePartyPosition(index);
			const actor = this.gameSession.content.getActor(member.id);
			this.add
				.ellipse(position.x, position.y + 1, 18, 5, 0x050914, 0.58)
				.setDepth(4 + index * 2);
			const sprite = this.add
				.image(
					position.x,
					position.y,
					getBattleCharacterTextureKey(actor.textureKey),
				)
				.setOrigin(0.5, 1)
				.setScale(0.88)
				.setFlipX(true)
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

	private renderHud(): void {
		const input = this.inputController?.snapshot(this.battleState);
		if (!input) return;
		this.hud.render({
			battleState: this.battleState,
			isBossBattle: this.isBossBattle(),
			menuLayer: input.menuLayer,
			commandIndex: input.commandIndex,
			abilityIndex: input.abilityIndex,
			itemIndex: input.itemIndex,
			status: this.status,
			actionAnimating: this.actionAnimating,
			commands: BATTLE_COMMAND_LABELS,
			availableItems: input.availableItems,
			targetCandidates: input.targetCandidates,
			targetIndex: input.targetIndex,
			combatantSprites: this.combatantSprites,
			targetCursor: this.targetCursor,
		});
	}

	private configureCamera(): void {
		this.cameras.main
			.setZoom(GAME_RENDER_SCALE)
			.setBounds(0, 0, GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT)
			.setRoundPixels(true);
	}
}
