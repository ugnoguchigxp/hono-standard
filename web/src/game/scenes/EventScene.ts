import Phaser from "phaser";
import {
	createSignalRuinsEncounterState,
	type GameSession,
} from "@shared/game";
import { InputManager } from "../input/InputManager";

const dialogue = [
	"Mira: The signal is coming from beneath the stone.",
	"Lune: Something heard us. Stay close.",
];

export class EventScene extends Phaser.Scene {
	private inputManager?: InputManager;
	private dialogueIndex = 0;
	private dialogueText?: Phaser.GameObjects.Text;

	constructor(private readonly gameSession: GameSession) {
		super("event");
	}

	create(): void {
		this.dialogueIndex = 0;
		this.inputManager = new InputManager(this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.inputManager?.destroy();
		});

		this.add.image(160, 96, "signal-ruins-field").setTint(0x6a7690).setDepth(0);
		this.add.rectangle(160, 96, 320, 192, 0x050916, 0.58).setDepth(1);
		this.add.image(40, 116, "field-mira").setScale(2).setDepth(3);
		this.add.image(280, 116, "field-lune").setScale(2).setDepth(3);

		this.add
			.rectangle(160, 108, 272, 84, 0x0a1324, 0.96)
			.setStrokeStyle(1, 0xa88147)
			.setDepth(2);
		this.add
			.text(28, 72, "THE DORMANT SIGNAL", {
				fontFamily: "monospace",
				fontSize: "9px",
				color: "#f2cf7a",
				shadow: { color: "#050916", offsetX: 1, offsetY: 1, fill: true },
			})
			.setDepth(4);
		this.dialogueText = this.add
			.text(28, 101, dialogue[0], {
				fontFamily: "monospace",
				fontSize: "8px",
				color: "#f6edd4",
				wordWrap: { width: 264 },
				lineSpacing: 2,
			})
			.setDepth(4);
		this.add
			.text(28, 138, "Z / ENTER  CONTINUE", {
				fontFamily: "monospace",
				fontSize: "6px",
				color: "#8fb7bd",
			})
			.setDepth(4);
		this.add.triangle(288, 139, 0, 0, 5, 0, 2.5, 3, 0xe4bd68).setDepth(4);
	}

	update(): void {
		if (!this.inputManager?.justPressed("CONFIRM")) return;
		this.dialogueIndex += 1;
		if (this.dialogueIndex < dialogue.length) {
			this.dialogueText?.setText(dialogue[this.dialogueIndex]);
			return;
		}
		this.cameras.main.flash(160, 230, 214, 168);
		this.gameSession.dispatch({
			type: "story.flag.set",
			flagId: "signal-contacted",
			value: true,
		});
		this.gameSession.dispatch({
			type: "battle.start",
			battle: createSignalRuinsEncounterState(
				this.gameSession.snapshot().party.members,
			),
		});
		this.scene.start("battle");
	}
}
