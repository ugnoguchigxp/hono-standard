import {
	FIELD_EVENT_TILE,
	type FieldDirection,
	type FieldState,
	type GameSession,
} from "@shared/game";
import Phaser from "phaser";
import { InputManager } from "../input/InputManager";

const TILE_SIZE = 16;
const partyTextureKeys = ["field-mira", "field-sol", "field-lune"];

export class FieldScene extends Phaser.Scene {
	private inputManager?: InputManager;
	private fieldState!: FieldState;
	private partySprites: Phaser.GameObjects.Image[] = [];
	private partyShadows: Phaser.GameObjects.Ellipse[] = [];
	private lastMoveAt = 0;
	private eventStarted = false;

	constructor(private readonly gameSession: GameSession) {
		super("field");
	}

	create(data: { victory?: boolean } = {}): void {
		this.fieldState = this.gameSession.snapshot().field;
		this.eventStarted = false;
		this.partySprites = [];
		this.partyShadows = [];
		this.inputManager = new InputManager(this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.inputManager?.destroy();
		});

		this.drawMap();
		this.createAtmosphere();
		this.createParty();
		this.createLocationLabel();

		if (
			data.victory ||
			this.gameSession.snapshot().story.flags["signal-ruins-cleared"] === true
		) {
			this.showFieldMessage(
				"The signal is quiet. A path opens beyond the ruins.",
			);
		}
	}

	update(time: number): void {
		if (
			!this.inputManager ||
			this.eventStarted ||
			time - this.lastMoveAt < 125
		) {
			return;
		}

		const direction = this.readDirection();
		if (!direction) return;
		this.lastMoveAt = time;
		this.moveParty(direction);
	}

	private readDirection(): FieldDirection | null {
		if (this.inputManager?.isDown("UP")) return "UP";
		if (this.inputManager?.isDown("DOWN")) return "DOWN";
		if (this.inputManager?.isDown("LEFT")) return "LEFT";
		if (this.inputManager?.isDown("RIGHT")) return "RIGHT";
		return null;
	}

	private moveParty(direction: FieldDirection): void {
		const transition = this.gameSession.dispatch({
			type: "field.move",
			direction,
		});
		this.fieldState = transition.state.field;
		const moveEvent = transition.events.find(
			(envelope) => envelope.event.type === "field.moved",
		);
		if (moveEvent?.event.type !== "field.moved") return;
		this.syncPartySprites();

		if (moveEvent.event.eventTriggered) {
			this.eventStarted = true;
			this.gameSession.dispatch({ type: "mode.enter", mode: "event" });
			this.cameras.main.fadeOut(280, 12, 18, 38);
			this.time.delayedCall(300, () => this.scene.start("event"));
		}
	}

	private createParty(): void {
		this.partyShadows = this.fieldState.partyPositions.map(() =>
			this.add.ellipse(0, 0, 10, 4, 0x07101c, 0.55),
		);
		this.partySprites = this.fieldState.partyPositions.map((_position, index) =>
			this.add.image(0, 0, partyTextureKeys[index]).setOrigin(0.5, 1),
		);
		this.syncPartySprites();
	}

	private syncPartySprites(): void {
		this.fieldState.partyPositions.forEach((position, index) => {
			const x = position.x * TILE_SIZE + TILE_SIZE / 2;
			const footY = position.y * TILE_SIZE + TILE_SIZE - 1;
			this.partyShadows[index].setPosition(x, footY - 1).setDepth(footY - 1);
			this.partySprites[index].setPosition(x, footY).setDepth(footY);
		});
	}

	private drawMap(): void {
		this.cameras.main.setBackgroundColor("#091225");
		this.add.image(160, 96, "signal-ruins-field").setDepth(0);
		this.add.rectangle(160, 96, 320, 192, 0x07101d, 0.07).setDepth(0.5);

		const eventX = FIELD_EVENT_TILE.x * TILE_SIZE + TILE_SIZE / 2;
		const eventY = FIELD_EVENT_TILE.y * TILE_SIZE + TILE_SIZE / 2;
		const aura = this.add
			.circle(eventX, eventY, 5, 0x72d7c0, 0.08)
			.setStrokeStyle(1, 0x9ce6d1, 0.75)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setDepth(2);
		this.tweens.add({
			targets: aura,
			alpha: { from: 0.25, to: 0.75 },
			scale: { from: 0.8, to: 1.45 },
			duration: 1_400,
			yoyo: true,
			repeat: -1,
			ease: "Sine.easeInOut",
		});
	}

	private createAtmosphere(): void {
		const particles = [
			{ x: 38, y: 38, delay: 0 },
			{ x: 102, y: 76, delay: 500 },
			{ x: 190, y: 46, delay: 900 },
			{ x: 274, y: 122, delay: 1_300 },
			{ x: 148, y: 152, delay: 1_700 },
		];
		for (const particle of particles) {
			const mote = this.add
				.circle(particle.x, particle.y, 1, 0xc5e8dc, 0.45)
				.setDepth(190);
			this.tweens.add({
				targets: mote,
				x: particle.x + 9,
				y: particle.y - 7,
				alpha: { from: 0.12, to: 0.55 },
				duration: 3_200,
				delay: particle.delay,
				yoyo: true,
				repeat: -1,
				ease: "Sine.easeInOut",
			});
		}
	}

	private createLocationLabel(): void {
		this.add.rectangle(42, 13, 74, 18, 0x07101d, 0.78).setDepth(200);
		this.add
			.text(8, 6, "SIGNAL RUINS", {
				fontFamily: "monospace",
				fontSize: "8px",
				color: "#f2cf7a",
				shadow: { color: "#07101d", offsetX: 1, offsetY: 1, fill: true },
			})
			.setDepth(201);
	}

	private showFieldMessage(message: string): void {
		this.add
			.rectangle(160, 163, 294, 34, 0x07101d, 0.94)
			.setStrokeStyle(1, 0x9a7a45)
			.setDepth(220);
		this.add
			.text(20, 153, message, {
				fontFamily: "monospace",
				fontSize: "7px",
				color: "#f6edd4",
				wordWrap: { width: 280 },
			})
			.setDepth(221);
	}
}
