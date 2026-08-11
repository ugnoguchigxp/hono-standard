import type {
	BattleCombatant,
	BattleEvent,
	BattleState,
	GameSession,
} from "@shared/game";
import Phaser from "phaser";
import {
	getBattleCharacterTextureKey,
	getFieldCharacterTextureKey,
} from "../../art/pixel-textures";
import { battleSoundForEvent } from "../../audio/audio-catalog";
import type { GameAudioManager } from "../../audio/GameAudioManager";
import { GAME_TEXT_RESOLUTION } from "../../display";
import { splitBattlePresentationEvents } from "../../presentation/battle-presentation";
import { gameSettingsStore } from "../../settings/GameSettingsStore";

type DamageBattleEvent = Extract<BattleEvent, { type: "action.damage" }>;

export type BattleAnimationCallbacks = {
	getBattleState(): BattleState;
	setAnimating(animating: boolean): void;
	updateStatus(events: BattleEvent[]): void;
	renderHud(): void;
};

export class BattleAnimationDirector {
	constructor(
		private readonly scene: Phaser.Scene,
		private readonly gameSession: GameSession,
		private readonly audioManager: GameAudioManager,
		private readonly combatantSprites: ReadonlyMap<
			string,
			Phaser.GameObjects.Image
		>,
		private readonly callbacks: BattleAnimationCallbacks,
	) {}

	play(events: BattleEvent[]): void {
		const { action, afterAction } = splitBattlePresentationEvents(events);
		if (!action) {
			this.callbacks.updateStatus(afterAction);
			return;
		}
		this.callbacks.updateStatus([action]);
		const sound = battleSoundForEvent(action);
		if (sound) this.audioManager.playSe(sound);
		if (gameSettingsStore.getSnapshot().reducedMotion) {
			this.callbacks.updateStatus(afterAction);
			this.callbacks.renderHud();
			return;
		}
		const finish = () => {
			this.callbacks.updateStatus(afterAction);
			this.callbacks.renderHud();
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
		this.callbacks.setAnimating(true);
		const color =
			event.type === "status.applied"
				? 0xb398ef
				: event.type === "item.used"
					? 0xf2cf7a
					: 0x72d7c0;
		const centerY = targetSprite.y - targetSprite.displayHeight * 0.48;
		const ring = this.scene.add
			.circle(targetSprite.x, centerY, 8, color, 0.16)
			.setStrokeStyle(2, color, 1)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setDepth(36);
		for (let index = 0; index < 4; index += 1) {
			const mote = this.scene.add
				.circle(targetSprite.x - 7 + index * 5, centerY + 9, 1.5, color, 0.95)
				.setBlendMode(Phaser.BlendModes.ADD)
				.setDepth(37);
			this.scene.tweens.add({
				targets: mote,
				y: centerY - 13 - (index % 2) * 4,
				alpha: 0,
				duration: 320 + index * 45,
				onComplete: () => mote.destroy(),
			});
		}
		this.scene.tweens.add({
			targets: ring,
			alpha: 0,
			scale: 1.8,
			duration: 360,
			onComplete: () => {
				ring.destroy();
				this.callbacks.setAnimating(false);
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

		this.callbacks.setAnimating(true);
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

		this.scene.tweens.add({
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

				this.scene.time.delayedCall(event.abilityId ? 175 : 120, () => {
					this.scene.tweens.add({
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
							this.callbacks.setAnimating(false);
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
		const slash = this.scene.add
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
		this.scene.tweens.add({
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
			const arc = this.scene.add
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
			this.scene.tweens.add({
				targets: arc,
				angle: { from: -35, to: 20 },
				alpha: 0,
				scale: { from: 0.65, to: 1.18 },
				duration: 220,
				ease: "Cubic.easeOut",
				onComplete: () => arc.destroy(),
			});
			this.scene.time.delayedCall(65, () => {
				this.createImpactBurst(target.x, destinationY, 0xf2cf7a);
				onImpact();
			});
			return;
		}

		if (actorId === "lune") {
			const sigil = this.scene.add
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
			this.scene.tweens.add({
				targets: sigil,
				angle: 120,
				alpha: 0,
				scale: { from: 0.55, to: 1.35 },
				duration: 260,
				ease: "Cubic.easeOut",
				onComplete: () => sigil.destroy(),
			});
			this.scene.time.delayedCall(95, () => {
				this.createImpactBurst(target.x, destinationY, 0xb398ef);
				onImpact();
			});
			return;
		}

		const projectile = this.scene.add
			.container(actor.x - 8, actor.y - actor.displayHeight * 0.5)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setDepth(35);
		projectile.add([
			this.scene.add.circle(0, 0, 4, 0x72d7c0, 0.22),
			this.scene.add
				.circle(0, 0, 2.5, 0xbdf8ec, 1)
				.setStrokeStyle(1, 0xffffff, 0.9),
			this.scene.add.rectangle(6, 0, 7, 1, 0x72d7c0, 0.8),
			this.scene.add.rectangle(11, 0, 4, 1, 0xbdf8ec, 0.45),
		]);
		this.scene.tweens.add({
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
		const ring = this.scene.add
			.circle(x, y, 5, color, 0.18)
			.setStrokeStyle(2, color, 1)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setDepth(33);
		this.scene.tweens.add({
			targets: ring,
			alpha: 0,
			scale: 2.4,
			duration: 240,
			ease: "Cubic.easeOut",
			onComplete: () => ring.destroy(),
		});
		for (let index = 0; index < 6; index += 1) {
			const angle = (Math.PI * 2 * index) / 6;
			const spark = this.scene.add
				.rectangle(x, y, 3, 1, color, 0.95)
				.setRotation(angle)
				.setBlendMode(Phaser.BlendModes.ADD)
				.setDepth(34);
			this.scene.tweens.add({
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
		const number = this.scene.add
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
		this.scene.tweens.add({
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
		this.callbacks.setAnimating(true);
		const shield = this.scene.add
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
		this.scene.tweens.add({
			targets: shield,
			alpha: 0,
			scale: { from: 0.65, to: 1.5 },
			duration: 280,
			ease: "Cubic.easeOut",
			onComplete: () => {
				shield.destroy();
				this.callbacks.setAnimating(false);
				onComplete();
			},
		});
	}

	private flashCombatant(combatantId: string): void {
		const sprite = this.combatantSprites.get(combatantId);
		if (!sprite) return;
		const homeX = sprite.x;
		this.scene.tweens.add({
			targets: sprite,
			alpha: { from: 0.2, to: 1 },
			x: { from: homeX - 2, to: homeX + 2 },
			duration: 45,
			yoyo: true,
			repeat: 2,
			onComplete: () => sprite.setX(homeX),
		});
		if (!gameSettingsStore.getSnapshot().reducedMotion) {
			this.scene.cameras.main.shake(100, 0.004);
		}
	}

	private findCombatant(combatantId: string): BattleCombatant | undefined {
		const battleState = this.callbacks.getBattleState();
		return [...battleState.party, ...battleState.enemies].find(
			(combatant) => combatant.id === combatantId,
		);
	}
}
