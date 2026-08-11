import {
	type AbilityDefinition,
	ACTION_GAUGE_MAX,
	type BattleCombatant,
	type BattleCommand,
	type BattleEvent,
	type BattleItemStack,
	type BattleState,
	type GameSession,
	levelForExperience,
} from "@shared/game";
import Phaser from "phaser";
import {
	getBattleCharacterTextureKey,
	getFieldCharacterTextureKey,
} from "../art/pixel-textures";
import {
	GAME_LOGICAL_HEIGHT,
	GAME_LOGICAL_WIDTH,
	GAME_RENDER_SCALE,
	GAME_TEXT_RESOLUTION,
} from "../display";
import { InputManager } from "../input/InputManager";
import {
	getNextEnemyIntentLabel,
	splitBattlePresentationEvents,
} from "../presentation/battle-presentation";
import {
	battleMusicForEncounter,
	battleSoundForEvent,
} from "../audio/audio-catalog";
import type { GameAudioManager } from "../audio/GameAudioManager";
import { gameSettingsStore } from "../settings/GameSettingsStore";

const commands = ["Attack", "Abilities", "Items", "Defend", "Escape"] as const;
const enemyTextureKeys: Readonly<Record<string, string>> = {
	"ash-wisp": "enemy-ash-wisp",
	"brass-hound": "enemy-brass-hound",
	"signal-warden": "enemy-signal-warden",
};
const SIGNAL_RUINS_BOSS_ID = "signal-ruins-encounter";
const partyBattlePositions = [
	{ x: 272, y: 62 },
	{ x: 272, y: 94 },
	{ x: 272, y: 126 },
] as const;

type DamageBattleEvent = Extract<BattleEvent, { type: "action.damage" }>;
type BattleMenuLayer = "commands" | "abilities" | "items" | "target";
type PendingBattleAction =
	| { type: "attack" }
	| { type: "ability"; ability: AbilityDefinition }
	| { type: "item"; item: BattleItemStack };

export class BattleScene extends Phaser.Scene {
	private inputManager?: InputManager;
	private battleState!: BattleState;
	private commandIndex = 0;
	private targetIndex = 0;
	private abilityIndex = 0;
	private itemIndex = 0;
	private menuLayer: BattleMenuLayer = "commands";
	private pendingAction: PendingBattleAction | null = null;
	private actionAnimating = false;
	private victoryAcknowledged = false;
	private status = "The encounter takes shape.";
	private partyText?: Phaser.GameObjects.Text;
	private enemyText?: Phaser.GameObjects.Text;
	private commandText?: Phaser.GameObjects.Text;
	private statusText?: Phaser.GameObjects.Text;
	private bossIntentText?: Phaser.GameObjects.Text;
	private gaugeGraphics?: Phaser.GameObjects.Graphics;
	private targetCursor?: Phaser.GameObjects.Triangle;
	private readonly combatantSprites = new Map<
		string,
		Phaser.GameObjects.Image
	>();

	constructor(
		private readonly gameSession: GameSession,
		private readonly audioManager: GameAudioManager,
	) {
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
		this.audioManager.playBgm(battleMusicForEncounter(battle.id));
		if (battle.id === SIGNAL_RUINS_BOSS_ID) {
			this.audioManager.playSe("se-battle-boss-roar");
		}
		this.commandIndex = 0;
		this.targetIndex = 0;
		this.abilityIndex = 0;
		this.itemIndex = 0;
		this.menuLayer = "commands";
		this.pendingAction = null;
		this.actionAnimating = false;
		this.victoryAcknowledged = false;
		this.status =
			battle.id === SIGNAL_RUINS_BOSS_ID
				? "The Signal Warden awakens."
				: "Enemies emerge from the dark.";
		this.combatantSprites.clear();

		this.configureCamera();
		this.drawStage();
		this.createCombatants();
		this.createHud();
		this.renderHud();
	}

	update(_time: number, delta: number): void {
		this.inputManager?.update();
		this.playInputAudio();
		if (this.actionAnimating) {
			this.renderHud();
			return;
		}
		if (this.battleState.phase === "running") {
			const transition = this.gameSession.dispatch({
				type: "battle.tick",
				deltaMs: Math.min(delta, 250),
			});
			if (transition.state.battle) this.battleState = transition.state.battle;
			const events = this.battleEvents(transition.events);
			this.playBattleEvents(events);
		} else if (this.battleState.phase === "awaiting-command") {
			this.handleCommandInput();
		} else if (this.inputManager?.justPressed("CONFIRM")) {
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

	private playInputAudio(): void {
		if (!this.inputManager || this.actionAnimating) return;
		if (
			this.inputManager.justPressed("UP") ||
			this.inputManager.justPressed("DOWN") ||
			this.inputManager.justPressed("LEFT") ||
			this.inputManager.justPressed("RIGHT")
		) {
			this.audioManager.playSe("se-ui-navigate");
		} else if (this.inputManager.justPressed("CONFIRM")) {
			this.audioManager.playSe("se-ui-confirm");
		} else if (this.inputManager.justPressed("CANCEL")) {
			this.audioManager.playSe("se-ui-cancel");
		}
	}

	private handleCommandInput(): void {
		if (!this.inputManager) return;
		if (this.inputManager.justPressed("CANCEL")) {
			if (this.menuLayer === "target") {
				this.menuLayer =
					this.pendingAction?.type === "ability"
						? "abilities"
						: this.pendingAction?.type === "item"
							? "items"
							: "commands";
				this.pendingAction = null;
				this.targetIndex = 0;
			} else if (this.menuLayer !== "commands") {
				this.menuLayer = "commands";
			}
			return;
		}
		if (this.menuLayer === "target") {
			this.handleTargetInput();
			return;
		}

		const entries = this.currentMenuEntries();
		if (entries.length === 0) {
			if (this.inputManager.justPressed("CONFIRM")) {
				this.status = "Nothing is available in this list.";
			}
			return;
		}
		const currentIndex =
			this.menuLayer === "commands"
				? this.commandIndex
				: this.menuLayer === "abilities"
					? this.abilityIndex
					: this.itemIndex;
		let nextIndex = currentIndex;
		if (this.inputManager.justPressed("UP")) {
			nextIndex = (currentIndex + entries.length - 1) % entries.length;
		}
		if (this.inputManager.justPressed("DOWN")) {
			nextIndex = (currentIndex + 1) % entries.length;
		}
		if (this.menuLayer === "commands") this.commandIndex = nextIndex;
		else if (this.menuLayer === "abilities") this.abilityIndex = nextIndex;
		else this.itemIndex = nextIndex;

		if (!this.inputManager.justPressed("CONFIRM")) return;
		const actor = this.activeActor();
		if (!actor) return;
		if (this.menuLayer === "commands") {
			const selected = commands[this.commandIndex];
			if (selected === "Abilities") {
				this.menuLayer = "abilities";
				this.abilityIndex = 0;
			} else if (selected === "Items") {
				this.menuLayer = "items";
				this.itemIndex = 0;
			} else if (selected === "Defend") {
				this.executeCommand({ type: "defend", actorId: actor.id });
			} else if (selected === "Escape") {
				if (this.battleState.canEscape) {
					this.executeCommand({ type: "escape", actorId: actor.id });
				} else {
					this.status = "The boss field prevents escape.";
				}
			} else {
				this.beginTargeting({ type: "attack" });
			}
			return;
		}
		if (this.menuLayer === "abilities") {
			const ability = actor.abilities[this.abilityIndex];
			if (!ability) return;
			if (actor.mp < ability.mpCost) {
				this.status = `${actor.name} needs ${ability.mpCost} MP.`;
				return;
			}
			this.beginTargeting({ type: "ability", ability });
			return;
		}
		const item = this.availableBattleItems()[this.itemIndex];
		if (item) this.beginTargeting({ type: "item", item });
	}

	private currentMenuEntries(): readonly string[] {
		const actor = this.activeActor();
		if (this.menuLayer === "commands") return commands;
		if (this.menuLayer === "abilities") {
			return actor?.abilities.map(({ name }) => name) ?? [];
		}
		return this.availableBattleItems().map(({ name }) => name);
	}

	private availableBattleItems(): BattleItemStack[] {
		return this.battleState.items.filter(
			(item) => item.count > 0 && item.effect !== "none",
		);
	}

	private activeActor(): BattleCombatant | undefined {
		return this.battleState.party.find(
			(member) => member.id === this.battleState.activeActorId,
		);
	}

	private beginTargeting(action: PendingBattleAction): void {
		this.pendingAction = action;
		this.targetIndex = 0;
		const targets = this.targetCandidates(action);
		if (targets.length === 0) {
			this.status = "There is no valid target.";
			this.pendingAction = null;
			return;
		}
		if (
			action.type === "ability" &&
			(action.ability.target.endsWith("all") ||
				action.ability.target === "self")
		) {
			this.executePendingAction(targets[0].id);
			return;
		}
		this.menuLayer = "target";
	}

	private targetCandidates(action = this.pendingAction): BattleCombatant[] {
		const actor = this.activeActor();
		if (!action || !actor) return [];
		if (action.type === "attack") {
			return this.battleState.enemies.filter((enemy) => enemy.hp > 0);
		}
		if (action.type === "item") {
			return this.battleState.party.filter((member) =>
				action.item.effect === "revive" ? member.hp === 0 : member.hp > 0,
			);
		}
		if (action.ability.target === "self") return [actor];
		if (action.ability.target.startsWith("ally")) {
			return this.battleState.party.filter((member) => member.hp > 0);
		}
		return this.battleState.enemies.filter((enemy) => enemy.hp > 0);
	}

	private handleTargetInput(): void {
		if (!this.inputManager || !this.pendingAction) return;
		const targets = this.targetCandidates();
		if (targets.length === 0) return;
		if (
			this.inputManager.justPressed("UP") ||
			this.inputManager.justPressed("LEFT")
		) {
			this.targetIndex =
				(this.targetIndex + targets.length - 1) % targets.length;
		}
		if (
			this.inputManager.justPressed("DOWN") ||
			this.inputManager.justPressed("RIGHT")
		) {
			this.targetIndex = (this.targetIndex + 1) % targets.length;
		}
		if (this.inputManager.justPressed("CONFIRM")) {
			this.executePendingAction(targets[this.targetIndex].id);
		}
	}

	private executePendingAction(targetId: string): void {
		const actorId = this.battleState.activeActorId;
		const action = this.pendingAction;
		if (!actorId || !action) return;
		const command: BattleCommand =
			action.type === "attack"
				? { type: "attack", actorId, targetId }
				: action.type === "ability"
					? {
							type: "ability",
							actorId,
							targetId,
							abilityId: action.ability.id,
						}
					: {
							type: "item",
							actorId,
							targetId,
							itemId: action.item.id,
						};
		this.executeCommand(command);
	}

	private executeCommand(command: BattleCommand): void {
		try {
			const transition = this.gameSession.dispatch({
				type: "battle.command",
				command,
			});
			if (transition.state.battle) this.battleState = transition.state.battle;
			this.commandIndex = 0;
			this.targetIndex = 0;
			this.menuLayer = "commands";
			this.pendingAction = null;
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
		const { action, afterAction } = splitBattlePresentationEvents(events);
		if (!action) {
			this.updateStatus(afterAction);
			return;
		}
		this.updateStatus([action]);
		const sound = battleSoundForEvent(action);
		if (sound) this.audioManager.playSe(sound);
		if (gameSettingsStore.getSnapshot().reducedMotion) {
			this.updateStatus(afterAction);
			this.renderHud();
			return;
		}
		const finish = () => {
			this.updateStatus(afterAction);
			this.renderHud();
		};
		if (action.type === "action.damage") {
			this.playDamageAction(action, finish);
		} else if (action.type === "action.defend") {
			this.playDefendAction(action.actorId, finish);
		} else {
			this.playSupportAction(action, finish);
		}
	}

	private playSupportAction(
		event: Extract<
			BattleEvent,
			{ type: "action.heal" | "item.used" | "status.applied" }
		>,
		onComplete: () => void,
	): void {
		const targetSprite = this.combatantSprites.get(event.targetId);
		if (!targetSprite) {
			onComplete();
			return;
		}
		this.actionAnimating = true;
		const color =
			event.type === "status.applied"
				? 0xb398ef
				: event.type === "item.used"
					? 0xf2cf7a
					: 0x72d7c0;
		const centerY = targetSprite.y - targetSprite.displayHeight * 0.48;
		const ring = this.add
			.circle(targetSprite.x, centerY, 8, color, 0.16)
			.setStrokeStyle(2, color, 1)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setDepth(36);
		for (let index = 0; index < 4; index += 1) {
			const mote = this.add
				.circle(targetSprite.x - 7 + index * 5, centerY + 9, 1.5, color, 0.95)
				.setBlendMode(Phaser.BlendModes.ADD)
				.setDepth(37);
			this.tweens.add({
				targets: mote,
				y: centerY - 13 - (index % 2) * 4,
				alpha: 0,
				duration: 320 + index * 45,
				onComplete: () => mote.destroy(),
			});
		}
		this.tweens.add({
			targets: ring,
			alpha: 0,
			scale: 1.8,
			duration: 360,
			onComplete: () => {
				ring.destroy();
				this.actionAnimating = false;
				onComplete();
			},
		});
	}

	private playDamageAction(
		event: DamageBattleEvent,
		onComplete: () => void,
	): void {
		const actor = this.findCombatant(event.actorId);
		const actorSprite = this.combatantSprites.get(event.actorId);
		const targetSprite = this.combatantSprites.get(event.targetId);
		if (!actor || !actorSprite || !targetSprite) {
			onComplete();
			return;
		}

		this.actionAnimating = true;
		const homeX = actorSprite.x;
		const lungeDistance = actor.side === "party" ? -17 : 13;
		if (actor.side === "party") {
			const actorDefinition = this.gameSession.content.getActor(actor.id);
			actorSprite
				.setTexture(
					getFieldCharacterTextureKey(actorDefinition.textureKey, "LEFT", 1),
				)
				.setFlipX(true);
		}

		this.tweens.add({
			targets: actorSprite,
			x: homeX + lungeDistance,
			duration: 90,
			ease: "Quad.easeOut",
			onComplete: () => {
				const impact = () => {
					this.flashCombatant(event.targetId);
					this.showDamageNumber(targetSprite, event.amount);
				};
				if (event.abilityId) {
					this.createAbilityEffect(
						actorSprite,
						targetSprite,
						event.actorId,
						impact,
					);
				} else {
					this.createAttackEffect(targetSprite, actor.side === "enemy");
					impact();
				}

				this.time.delayedCall(event.abilityId ? 175 : 120, () => {
					this.tweens.add({
						targets: actorSprite,
						x: homeX,
						duration: 90,
						ease: "Quad.easeIn",
						onComplete: () => {
							if (actor.side === "party") {
								const actorDefinition = this.gameSession.content.getActor(
									actor.id,
								);
								actorSprite
									.setTexture(
										getBattleCharacterTextureKey(actorDefinition.textureKey),
									)
									.setFlipX(true);
							}
							this.actionAnimating = false;
							onComplete();
						},
					});
				});
			},
		});
	}

	private createAttackEffect(
		target: Phaser.GameObjects.Image,
		enemyAttack: boolean,
	): void {
		const centerY = target.y - target.displayHeight * 0.48;
		const color = enemyAttack ? 0xff765f : 0xffedaf;
		const slash = this.add
			.graphics()
			.setPosition(target.x, centerY)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setDepth(34);
		slash.lineStyle(2, color, 1);
		slash.beginPath();
		slash.moveTo(-12, 9);
		slash.lineTo(11, -10);
		slash.strokePath();
		slash.lineStyle(1, 0xffffff, 0.95);
		slash.beginPath();
		slash.moveTo(-6, 11);
		slash.lineTo(13, -5);
		slash.strokePath();
		this.createImpactBurst(target.x, centerY, color);
		this.tweens.add({
			targets: slash,
			alpha: 0,
			scale: { from: 0.72, to: 1.2 },
			duration: 190,
			ease: "Cubic.easeOut",
			onComplete: () => slash.destroy(),
		});
	}

	private createAbilityEffect(
		actor: Phaser.GameObjects.Image,
		target: Phaser.GameObjects.Image,
		actorId: string,
		onImpact: () => void,
	): void {
		const destinationY = target.y - target.displayHeight * 0.48;
		if (actorId === "mira") {
			const arc = this.add
				.graphics()
				.setPosition(target.x, destinationY)
				.setBlendMode(Phaser.BlendModes.ADD)
				.setDepth(35);
			arc.lineStyle(3, 0xf2cf7a, 1);
			arc.beginPath();
			arc.arc(0, 0, 16, -1.1, 1.15, false);
			arc.strokePath();
			arc.lineStyle(1, 0xffffff, 0.95);
			arc.beginPath();
			arc.arc(0, 0, 11, -1.05, 1.1, false);
			arc.strokePath();
			this.tweens.add({
				targets: arc,
				angle: { from: -35, to: 20 },
				alpha: 0,
				scale: { from: 0.65, to: 1.18 },
				duration: 220,
				ease: "Cubic.easeOut",
				onComplete: () => arc.destroy(),
			});
			this.time.delayedCall(65, () => {
				this.createImpactBurst(target.x, destinationY, 0xf2cf7a);
				onImpact();
			});
			return;
		}

		if (actorId === "lune") {
			const sigil = this.add
				.graphics()
				.setPosition(target.x, destinationY)
				.setBlendMode(Phaser.BlendModes.ADD)
				.setDepth(35);
			sigil.lineStyle(2, 0xb398ef, 1);
			sigil.strokeCircle(0, 0, 13);
			sigil.lineStyle(1, 0xeee4ff, 0.95);
			sigil.strokeCircle(0, 0, 7);
			sigil.beginPath();
			sigil.moveTo(0, -12);
			sigil.lineTo(10, 7);
			sigil.lineTo(-10, 7);
			sigil.closePath();
			sigil.strokePath();
			this.tweens.add({
				targets: sigil,
				angle: 120,
				alpha: 0,
				scale: { from: 0.55, to: 1.35 },
				duration: 260,
				ease: "Cubic.easeOut",
				onComplete: () => sigil.destroy(),
			});
			this.time.delayedCall(95, () => {
				this.createImpactBurst(target.x, destinationY, 0xb398ef);
				onImpact();
			});
			return;
		}

		const projectile = this.add
			.container(actor.x - 8, actor.y - actor.displayHeight * 0.5)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setDepth(35);
		projectile.add([
			this.add.circle(0, 0, 4, 0x72d7c0, 0.22),
			this.add.circle(0, 0, 2.5, 0xbdf8ec, 1).setStrokeStyle(1, 0xffffff, 0.9),
			this.add.rectangle(6, 0, 7, 1, 0x72d7c0, 0.8),
			this.add.rectangle(11, 0, 4, 1, 0xbdf8ec, 0.45),
		]);
		this.tweens.add({
			targets: projectile,
			x: target.x,
			y: destinationY,
			scale: { from: 0.7, to: 1.25 },
			duration: 130,
			ease: "Quad.easeIn",
			onComplete: () => {
				projectile.destroy();
				this.createImpactBurst(target.x, destinationY, 0x72d7c0);
				onImpact();
			},
		});
	}

	private createImpactBurst(x: number, y: number, color: number): void {
		const ring = this.add
			.circle(x, y, 5, color, 0.18)
			.setStrokeStyle(2, color, 1)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setDepth(33);
		this.tweens.add({
			targets: ring,
			alpha: 0,
			scale: 2.4,
			duration: 240,
			ease: "Cubic.easeOut",
			onComplete: () => ring.destroy(),
		});
		for (let index = 0; index < 6; index += 1) {
			const angle = (Math.PI * 2 * index) / 6;
			const spark = this.add
				.rectangle(x, y, 3, 1, color, 0.95)
				.setRotation(angle)
				.setBlendMode(Phaser.BlendModes.ADD)
				.setDepth(34);
			this.tweens.add({
				targets: spark,
				x: x + Math.cos(angle) * 15,
				y: y + Math.sin(angle) * 15,
				alpha: 0,
				duration: 230,
				ease: "Quad.easeOut",
				onComplete: () => spark.destroy(),
			});
		}
	}

	private showDamageNumber(
		target: Phaser.GameObjects.Image,
		amount: number,
	): void {
		const number = this.add
			.text(target.x, target.y - target.displayHeight - 3, String(amount), {
				fontFamily: '"Trebuchet MS", Arial, sans-serif',
				fontSize: "9px",
				fontStyle: "bold",
				color: "#ffffff",
				stroke: "#190817",
				strokeThickness: 2,
				resolution: GAME_TEXT_RESOLUTION,
			})
			.setOrigin(0.5)
			.setDepth(50);
		this.tweens.add({
			targets: number,
			y: number.y - 11,
			alpha: 0,
			duration: 520,
			ease: "Cubic.easeOut",
			onComplete: () => number.destroy(),
		});
	}

	private playDefendAction(actorId: string, onComplete: () => void): void {
		const sprite = this.combatantSprites.get(actorId);
		if (!sprite) {
			onComplete();
			return;
		}
		this.actionAnimating = true;
		const shield = this.add
			.circle(
				sprite.x,
				sprite.y - sprite.displayHeight * 0.48,
				10,
				0x72d7c0,
				0.14,
			)
			.setStrokeStyle(2, 0xbdf8ec, 0.95)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setDepth(35);
		this.tweens.add({
			targets: shield,
			alpha: 0,
			scale: { from: 0.65, to: 1.5 },
			duration: 280,
			ease: "Cubic.easeOut",
			onComplete: () => {
				shield.destroy();
				this.actionAnimating = false;
				onComplete();
			},
		});
	}

	private flashCombatant(combatantId: string): void {
		const sprite = this.combatantSprites.get(combatantId);
		if (!sprite) return;
		const homeX = sprite.x;
		this.tweens.add({
			targets: sprite,
			alpha: { from: 0.2, to: 1 },
			x: { from: homeX - 2, to: homeX + 2 },
			duration: 45,
			yoyo: true,
			repeat: 2,
			onComplete: () => sprite.setX(homeX),
		});
		if (!gameSettingsStore.getSnapshot().reducedMotion) {
			this.cameras.main.shake(100, 0.004);
		}
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
			this.bossIntentText = this.add
				.text(11, 17, "", {
					fontFamily: '"Trebuchet MS", Arial, sans-serif',
					fontSize: "4px",
					fontStyle: "bold",
					color: "#72d7c0",
					resolution: GAME_TEXT_RESOLUTION,
				})
				.setDepth(21);
			this.cameras.main.flash(420, 126, 28, 45);
			this.cameras.main.shake(260, 0.002);
		}
	}

	private createCombatants(): void {
		const enemyPositions = this.isBossBattle()
			? [{ x: 92, y: 124, scale: 0.88 }]
			: [
					{ x: 76, y: 98, scale: 0.98 },
					{ x: 121, y: 112, scale: 0.96 },
				];
		this.battleState.enemies.forEach((enemy, index) => {
			const position = enemyPositions[index] ?? {
				x: 42 + (index % 5) * 34,
				y: 84 + Math.floor(index / 5) * 30,
				scale: 0.92,
			};
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
			const position = partyBattlePositions[index] ?? {
				x: 272,
				y: 126 + (index - partyBattlePositions.length + 1) * 28,
			};
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

	private createHud(): void {
		const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
			fontFamily: '"Trebuchet MS", Arial, sans-serif',
			fontSize: "6px",
			fontStyle: "bold",
			color: "#f6edd4",
			lineSpacing: 1,
			resolution: GAME_TEXT_RESOLUTION,
		};
		this.add
			.rectangle(160, 164, 316, 54, 0x07101d, 0.96)
			.setStrokeStyle(1, 0x9a7a45)
			.setDepth(40);
		this.add.rectangle(138, 164, 1, 48, 0x536879, 0.7).setDepth(41);
		const labelStyle = {
			...textStyle,
			fontSize: "4px",
			color: "#e4bd68",
		};
		this.add.text(9, 139, "COMMAND", labelStyle).setDepth(42);
		this.add.text(146, 139, "PARTY", labelStyle).setDepth(42);
		this.partyText = this.add.text(146, 147, "", textStyle).setDepth(42);
		this.enemyText = this.add
			.text(11, 26, "", {
				...textStyle,
				fontSize: "5px",
				color: "#e8eee9",
				backgroundColor: "#07101dcc",
				padding: { x: 3, y: 2 },
			})
			.setDepth(22);
		this.commandText = this.add.text(9, 147, "", textStyle).setDepth(42);
		this.statusText = this.add
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
		this.gaugeGraphics = this.add.graphics().setDepth(43);
	}

	private renderHud(): void {
		const boss = this.isBossBattle() ? this.battleState.enemies[0] : undefined;
		this.bossIntentText?.setText(
			boss && boss.hp > 0 ? `NEXT ${getNextEnemyIntentLabel(boss)}` : "",
		);
		this.partyText?.setText(
			this.battleState.party
				.map(
					(member) =>
						`${member.name.padEnd(5)} HP ${String(member.hp).padStart(2)}/${member.maxHp}  MP ${member.mp}/${member.maxMp}${member.statuses.length > 0 ? `  ${member.statuses.map(({ id }) => id.toUpperCase()).join(",")}` : ""}`,
				)
				.join("\n"),
		);
		this.enemyText
			?.setVisible(!this.isBossBattle())
			.setText(
				this.battleState.enemies
					.map(
						(enemy) =>
							`${enemy.name.toUpperCase()}  HP ${enemy.hp}/${enemy.maxHp}${enemy.statuses.length > 0 ? ` [${enemy.statuses.map(({ id }) => id.toUpperCase()).join(",")}]` : ""}`,
					)
					.join("  /  "),
			);

		const actor = this.battleState.party.find(
			(member) => member.id === this.battleState.activeActorId,
		);
		if (this.battleState.phase === "awaiting-command" && actor) {
			let entries: string[];
			let selectedIndex: number;
			if (this.menuLayer === "abilities") {
				entries = actor.abilities.map(
					(ability) =>
						`${ability.name} ${ability.mpCost}MP ${ability.target.replace("-", " ")}`,
				);
				selectedIndex = this.abilityIndex;
			} else if (this.menuLayer === "items") {
				entries = this.availableBattleItems().map(
					(item) => `${item.name} ×${item.count}`,
				);
				selectedIndex = this.itemIndex;
			} else if (this.menuLayer === "target") {
				entries = ["SELECT TARGET", "Z CONFIRM", "X BACK"];
				selectedIndex = -1;
			} else {
				entries = commands.map((command) =>
					command === "Escape" && !this.battleState.canEscape
						? "Escape —"
						: command,
				);
				selectedIndex = this.commandIndex;
			}
			this.commandText?.setText(
				entries
					.map(
						(entry, index) => `${index === selectedIndex ? ">" : " "} ${entry}`,
					)
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
		if (this.isBossBattle()) {
			const ratio = boss ? boss.hp / boss.maxHp : 0;
			this.gaugeGraphics?.fillStyle(0x36101f, 1);
			this.gaugeGraphics?.fillRect(101, 17, 205, 4);
			this.gaugeGraphics?.fillStyle(0xc24f52, 1);
			this.gaugeGraphics?.fillRect(101, 17, 205 * ratio, 4);
			this.gaugeGraphics?.fillStyle(0xf2cf7a, 1);
			this.gaugeGraphics?.fillRect(101, 17, 205 * ratio, 1);
		}
		this.battleState.party.forEach((member, index) => {
			const width = 45 * (member.actionGauge / ACTION_GAUGE_MAX);
			this.gaugeGraphics?.fillStyle(0x243149, 1);
			this.gaugeGraphics?.fillRect(262, 150 + index * 15, 45, 3);
			this.gaugeGraphics?.fillStyle(
				member.actionGauge >= ACTION_GAUGE_MAX ? 0x72d7c0 : 0xe4bd68,
				1,
			);
			this.gaugeGraphics?.fillRect(262, 150 + index * 15, width, 3);
		});

		for (const combatant of [
			...this.battleState.party,
			...this.battleState.enemies,
		]) {
			if (!this.actionAnimating) {
				this.combatantSprites
					.get(combatant.id)
					?.setAlpha(combatant.hp > 0 ? 1 : 0.18);
			}
		}

		const targets = this.menuLayer === "target" ? this.targetCandidates() : [];
		const target = targets[this.targetIndex % targets.length];
		const targetSprite = target
			? this.combatantSprites.get(target.id)
			: undefined;
		this.targetCursor
			?.setVisible(
				this.battleState.phase === "awaiting-command" &&
					this.menuLayer === "target" &&
					Boolean(targetSprite),
			)
			.setPosition(
				targetSprite?.x ?? 0,
				(targetSprite?.y ?? 0) - (targetSprite?.displayHeight ?? 34) - 4,
			);
	}

	private configureCamera(): void {
		this.cameras.main
			.setZoom(GAME_RENDER_SCALE)
			.setBounds(0, 0, GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT)
			.setRoundPixels(true);
	}
}
