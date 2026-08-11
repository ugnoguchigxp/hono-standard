import Phaser from "phaser";
import {
	ACTION_GAUGE_MAX,
	type BattleCombatant,
	type BattleEvent,
	type BattleState,
	type GameSession,
} from "@shared/game";
import { InputManager } from "../input/InputManager";
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

const commands = ["Attack", "Ability", "Defend"] as const;
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

export class BattleScene extends Phaser.Scene {
	private inputManager?: InputManager;
	private battleState!: BattleState;
	private commandIndex = 0;
	private targetIndex = 0;
	private actionAnimating = false;
	private status = "The encounter takes shape.";
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
		this.actionAnimating = false;
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
			this.updateStatus(events);
			this.playBattleEvents(events);
		} else if (this.battleState.phase === "awaiting-command") {
			this.handleCommandInput();
		} else if (this.inputManager?.justPressed("CONFIRM")) {
			if (this.battleState.phase === "victory") {
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
		const events = this.battleEvents(transition.events);
		this.updateStatus(events);
		this.playBattleEvents(events);
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
				this.status = event.abilityId
					? `${actor?.name ?? "Unknown"} uses ${actor?.ability.name ?? "an ability"}! ${event.amount} damage.`
					: `${actor?.name ?? "Unknown"} hits ${target?.name ?? "the target"} for ${event.amount}.`;
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
						: "The party was overwhelmed. Press confirm to retry.";
				break;
		}
	}

	private playBattleEvents(events: BattleEvent[]): void {
		const damage = events.find(
			(event): event is DamageBattleEvent => event.type === "action.damage",
		);
		if (damage) {
			this.playDamageAction(damage);
			return;
		}
		const defend = events.find((event) => event.type === "action.defend");
		if (defend?.type === "action.defend") {
			this.playDefendAction(defend.actorId);
		}
	}

	private playDamageAction(event: DamageBattleEvent): void {
		const actor = this.findCombatant(event.actorId);
		const actorSprite = this.combatantSprites.get(event.actorId);
		const targetSprite = this.combatantSprites.get(event.targetId);
		if (!actor || !actorSprite || !targetSprite) return;

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

	private playDefendAction(actorId: string): void {
		const sprite = this.combatantSprites.get(actorId);
		if (!sprite) return;
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
		this.cameras.main.shake(100, 0.004);
	}

	private findCombatant(combatantId: string): BattleCombatant | undefined {
		return [...this.battleState.party, ...this.battleState.enemies].find(
			(combatant) => combatant.id === combatantId,
		);
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
						`${member.name.padEnd(5)} HP ${String(member.hp).padStart(2)}/${member.maxHp}`,
				)
				.join("\n\n"),
		);
		this.enemyText
			?.setVisible(!this.isBossBattle())
			.setText(
				this.battleState.enemies
					.map(
						(enemy) =>
							`${enemy.name.toUpperCase()}  HP ${enemy.hp}/${enemy.maxHp}`,
					)
					.join("  /  "),
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
		if (this.isBossBattle()) {
			const boss = this.battleState.enemies[0];
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
