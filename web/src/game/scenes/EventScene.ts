import type {
	ActiveEventState,
	GameSession,
	GameSessionTransition,
} from "@shared/game";
import Phaser from "phaser";
import {
	GAME_LOGICAL_HEIGHT,
	GAME_LOGICAL_WIDTH,
	GAME_RENDER_SCALE,
	GAME_TEXT_RESOLUTION,
} from "../display";
import { InputManager } from "../input/InputManager";
import {
	type EventPresentationStep,
	getEventPresentationSteps,
} from "../presentation/event-presentation";
import type { GameAudioManager } from "../audio/GameAudioManager";
import {
	gameSettingsStore,
	getTextCharacterDelay,
} from "../settings/GameSettingsStore";

const slotX: Record<ActiveEventState["actors"][number]["slot"], number> = {
	left: 40,
	center: 160,
	right: 280,
	hidden: -40,
};
const ACTOR_BASELINE_Y = 148;
const ACTOR_SCALE = 0.78;

export class EventScene extends Phaser.Scene {
	private inputManager?: InputManager;
	private choiceIndex = 0;
	private speakerText?: Phaser.GameObjects.Text;
	private dialogueText?: Phaser.GameObjects.Text;
	private choicesText?: Phaser.GameObjects.Text;
	private helpText?: Phaser.GameObjects.Text;
	private presenting = false;
	private typing = false;
	private fullDialogue = "";
	private renderedDialogueKey = "";
	private dialogueTimer?: Phaser.Time.TimerEvent;
	private shuttingDown = false;
	private readonly actorSprites = new Map<string, Phaser.GameObjects.Image>();
	private readonly actorExpressions = new Map<string, string>();

	constructor(
		private readonly gameSession: GameSession,
		private readonly audioManager: GameAudioManager,
	) {
		super("event");
	}

	create(): void {
		const active = this.gameSession.snapshot().event;
		if (!active) throw new Error("EventScene requires an active event.");
		const definition = this.gameSession.content.getEvent(active.eventId);
		this.choiceIndex = 0;
		this.presenting = false;
		this.typing = false;
		this.fullDialogue = "";
		this.renderedDialogueKey = "";
		this.dialogueTimer = undefined;
		this.shuttingDown = false;
		this.actorSprites.clear();
		this.actorExpressions.clear();
		this.inputManager = new InputManager(this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.shuttingDown = true;
			this.presenting = false;
			this.typing = false;
			this.dialogueTimer?.remove();
			this.dialogueTimer = undefined;
			this.inputManager?.destroy();
			this.time.removeAllEvents();
			this.tweens.killAll();
			this.actorSprites.clear();
			this.actorExpressions.clear();
		});
		this.configureCamera();

		this.add
			.image(160, 96, definition.presentation.backgroundAssetId)
			.setTint(0x6a7690)
			.setDepth(0);
		this.add.rectangle(160, 96, 320, 192, 0x050916, 0.58).setDepth(1);
		for (const actorState of active.actors) {
			this.actorExpressions.set(actorState.actorId, actorState.expression);
			const actor = this.gameSession.content.getActor(actorState.actorId);
			const sprite = this.add
				.image(slotX[actorState.slot], ACTOR_BASELINE_Y, actor.textureKey)
				.setOrigin(0.5, 1)
				.setScale(ACTOR_SCALE)
				.setVisible(actorState.slot !== "hidden")
				.setDepth(3);
			this.actorSprites.set(actorState.actorId, sprite);
		}

		this.add
			.rectangle(160, 108, 284, 116, 0x0a1324, 0.96)
			.setStrokeStyle(1, 0xa88147)
			.setDepth(2);
		this.add.rectangle(160, 110, 276, 1, 0x41516b, 0.48).setDepth(3);
		this.add
			.text(22, 54, definition.title.toUpperCase(), {
				fontFamily: '"Trebuchet MS", Arial, sans-serif',
				fontSize: "8px",
				fontStyle: "bold",
				color: "#f2cf7a",
				resolution: GAME_TEXT_RESOLUTION,
				shadow: { color: "#050916", offsetX: 1, offsetY: 1, fill: true },
			})
			.setDepth(4);
		this.speakerText = this.add
			.text(22, 73, "", {
				fontFamily: '"Trebuchet MS", Arial, sans-serif',
				fontSize: "7px",
				fontStyle: "bold",
				color: "#72d7c0",
				resolution: GAME_TEXT_RESOLUTION,
			})
			.setDepth(4);
		this.dialogueText = this.add
			.text(22, 86, "", {
				fontFamily: '"Trebuchet MS", Arial, sans-serif',
				fontSize: "8px",
				color: "#f6edd4",
				resolution: GAME_TEXT_RESOLUTION,
				wordWrap: { width: 276 },
				lineSpacing: 2,
			})
			.setDepth(4);
		this.choicesText = this.add
			.text(28, 115, "", {
				fontFamily: '"Trebuchet MS", Arial, sans-serif',
				fontSize: "7px",
				fontStyle: "bold",
				color: "#e4bd68",
				resolution: GAME_TEXT_RESOLUTION,
				wordWrap: { width: 264 },
				lineSpacing: 2,
			})
			.setDepth(4);
		this.helpText = this.add
			.text(22, 153, "", {
				fontFamily: '"Trebuchet MS", Arial, sans-serif',
				fontSize: "6px",
				fontStyle: "bold",
				color: "#8fb7bd",
				resolution: GAME_TEXT_RESOLUTION,
			})
			.setDepth(4);
		this.renderEvent(active);
	}

	update(): void {
		if (!this.inputManager) return;
		this.inputManager.update();
		if (
			this.inputManager.justPressed("UP") ||
			this.inputManager.justPressed("DOWN")
		) {
			this.audioManager.playSe("se-ui-navigate");
		} else if (this.inputManager.justPressed("CONFIRM")) {
			this.audioManager.playSe("se-ui-confirm");
		}
		if (this.presenting) return;
		if (this.typing) {
			if (this.inputManager.justPressed("CONFIRM")) this.finishTyping();
			return;
		}
		const active = this.gameSession.snapshot().event;
		if (!active) return;
		if (active.status === "awaiting-choice") {
			if (this.inputManager.justPressed("UP")) {
				this.choiceIndex =
					(this.choiceIndex + active.choices.length - 1) %
					active.choices.length;
				this.renderEvent(active);
			}
			if (this.inputManager.justPressed("DOWN")) {
				this.choiceIndex = (this.choiceIndex + 1) % active.choices.length;
				this.renderEvent(active);
			}
			if (!this.inputManager.justPressed("CONFIRM")) return;
			const choice = active.choices[this.choiceIndex];
			if (!choice) return;
			this.handleTransition(
				this.gameSession.dispatch({
					type: "event.choose",
					choiceId: choice.id,
				}),
			);
			return;
		}
		if (this.inputManager.justPressed("CONFIRM")) {
			this.handleTransition(
				this.gameSession.dispatch({ type: "event.advance" }),
			);
		}
	}

	private handleTransition(transition: GameSessionTransition): void {
		const steps = getEventPresentationSteps(transition.events);
		if (steps.length > 0) {
			this.presenting = true;
			this.helpText?.setText("");
			this.playPresentationSteps(steps, 0, () =>
				this.completeTransition(transition),
			);
			return;
		}
		this.completeTransition(transition);
	}

	private completeTransition(transition: GameSessionTransition): void {
		if (this.shuttingDown) return;
		this.presenting = false;
		if (transition.state.mode === "battle") {
			if (!gameSettingsStore.getSnapshot().reducedMotion) {
				this.cameras.main.flash(160, 230, 214, 168);
			}
			this.scene.start("battle");
			return;
		}
		if (transition.state.mode === "field") {
			this.scene.start("field");
			return;
		}
		if (transition.state.event) {
			this.choiceIndex = 0;
			this.renderEvent(transition.state.event);
		}
	}

	private playPresentationSteps(
		steps: readonly EventPresentationStep[],
		index: number,
		onComplete: () => void,
	): void {
		if (this.shuttingDown) return;
		const step = steps[index];
		if (!step) {
			onComplete();
			return;
		}
		const next = () => this.playPresentationSteps(steps, index + 1, onComplete);
		if (gameSettingsStore.getSnapshot().reducedMotion) {
			if (step.type === "actor.move") {
				this.actorSprites
					.get(step.actorId)
					?.setPosition(slotX[step.slot], ACTOR_BASELINE_Y)
					.setVisible(step.slot !== "hidden");
			} else if (step.type === "actor.expression") {
				this.actorExpressions.set(step.actorId, step.expression);
			}
			next();
			return;
		}
		if (step.type === "wait") {
			this.time.delayedCall(step.durationMs, next);
			return;
		}
		const sprite = this.actorSprites.get(step.actorId);
		if (step.type === "actor.move") {
			if (!sprite) {
				next();
				return;
			}
			if (step.slot !== "hidden") sprite.setVisible(true);
			this.tweens.add({
				targets: sprite,
				x: slotX[step.slot],
				duration: 180,
				ease: "Quad.easeInOut",
				onComplete: () => {
					sprite.setVisible(step.slot !== "hidden");
					next();
				},
			});
			return;
		}
		this.actorExpressions.set(step.actorId, step.expression);
		if (!sprite?.visible) {
			next();
			return;
		}
		sprite.setTint(0xf2cf7a);
		this.tweens.add({
			targets: sprite,
			alpha: { from: 0.72, to: 1 },
			duration: 90,
			yoyo: true,
			onComplete: () => {
				sprite.clearTint().setAlpha(1);
				next();
			},
		});
	}

	private renderEvent(active: ActiveEventState): void {
		for (const actor of active.actors) {
			this.actorSprites
				.get(actor.actorId)
				?.setPosition(slotX[actor.slot], ACTOR_BASELINE_Y)
				.setVisible(
					actor.slot !== "hidden" && active.status !== "awaiting-choice",
				);
		}
		const speaker = active.visibleLine
			? this.gameSession.content.getActor(active.visibleLine.speakerId)
			: null;
		const speakerExpression = active.visibleLine
			? (this.actorExpressions.get(active.visibleLine.speakerId) ??
				active.actors.find(
					(actor) => actor.actorId === active.visibleLine?.speakerId,
				)?.expression)
			: null;
		this.speakerText?.setText(
			speaker
				? `${speaker.displayName.toUpperCase()}${speakerExpression ? ` · ${speakerExpression.toUpperCase()}` : ""}`
				: "",
		);
		this.renderDialogue(
			active.visibleLine?.text ?? "",
			`${active.eventId}:${active.nodeId}`,
		);
		if (active.status === "awaiting-choice") {
			this.choicesText?.setText(
				active.choices
					.map(
						(choice, index) =>
							`${index === this.choiceIndex ? ">" : " "} ${choice.text}`,
					)
					.join("\n"),
			);
			this.helpText?.setText("UP / DOWN  CHOOSE     Z / ENTER  CONFIRM");
		} else {
			this.choicesText?.setText("");
			this.helpText?.setText("Z / ENTER  CONTINUE");
		}
	}

	private renderDialogue(value: string, key: string): void {
		if (key === this.renderedDialogueKey) return;
		this.renderedDialogueKey = key;
		this.dialogueTimer?.remove();
		this.fullDialogue = value;
		const delay = getTextCharacterDelay(
			gameSettingsStore.getSnapshot().textSpeed,
		);
		if (delay === 0 || value.length === 0) {
			this.typing = false;
			this.dialogueText?.setText(value);
			return;
		}
		this.typing = true;
		let characterIndex = 0;
		this.dialogueText?.setText("");
		this.dialogueTimer = this.time.addEvent({
			delay,
			repeat: value.length - 1,
			callback: () => {
				characterIndex += 1;
				this.dialogueText?.setText(value.slice(0, characterIndex));
				if (characterIndex >= value.length) this.typing = false;
			},
		});
	}

	private finishTyping(): void {
		this.dialogueTimer?.remove();
		this.typing = false;
		this.dialogueText?.setText(this.fullDialogue);
	}

	private configureCamera(): void {
		this.cameras.main
			.setZoom(GAME_RENDER_SCALE)
			.setBounds(0, 0, GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT)
			.setRoundPixels(true);
	}
}
