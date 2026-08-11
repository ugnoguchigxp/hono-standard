import { EMPTY_ACTION3D_INPUT, type Action3dInput } from "@shared/action3d";

const blockedKeys = new Set([
	"KeyW",
	"KeyA",
	"KeyS",
	"KeyD",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Space",
	"ShiftLeft",
	"ShiftRight",
	"ControlLeft",
	"ControlRight",
	"KeyE",
]);
export class Action3dInputController {
	private readonly down = new Set<string>();
	private readonly pressed = new Set<string>();
	private pointerAttack = false;
	private pointerLock = false;
	private gamepadAttack = false;
	private gamepadDodge = false;
	private gamepadJump = false;
	private gamepadLock = false;
	cameraYaw = 0;
	cameraPitch = -0.3;
	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly onPointerLock: (locked: boolean) => void,
	) {
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		document.addEventListener("mousemove", this.onMouseMove);
		document.addEventListener("pointerlockchange", this.onPointerLockChange);
		canvas.addEventListener("pointerdown", this.onPointerDown);
		canvas.addEventListener("contextmenu", this.onContextMenu);
	}
	private onKeyDown = (event: KeyboardEvent) => {
		if (blockedKeys.has(event.code)) event.preventDefault();
		if (!this.down.has(event.code)) this.pressed.add(event.code);
		this.down.add(event.code);
	};
	private onKeyUp = (event: KeyboardEvent) => {
		this.down.delete(event.code);
	};
	private onMouseMove = (event: MouseEvent) => {
		if (!this.pointerLock) return;
		this.cameraYaw -= event.movementX * 0.0028;
		this.cameraPitch = Math.min(
			0.2,
			Math.max(-0.72, this.cameraPitch - event.movementY * 0.0022),
		);
	};
	private onPointerDown = (event: PointerEvent) => {
		this.canvas.focus();
		if (document.pointerLockElement !== this.canvas)
			void this.canvas.requestPointerLock();
		if (event.button === 0) this.pointerAttack = true;
		if (event.button === 2) this.pressed.add("KeyE");
	};
	private onContextMenu = (event: Event) => event.preventDefault();
	private onPointerLockChange = () => {
		this.pointerLock = document.pointerLockElement === this.canvas;
		this.onPointerLock(this.pointerLock);
	};
	private buttonEdge(active: boolean, previous: boolean) {
		return active && !previous;
	}
	read(): Action3dInput {
		const gamepad = navigator.getGamepads?.()[0];
		const cameraX =
			Math.abs(gamepad?.axes[2] ?? 0) > 0.16 ? (gamepad?.axes[2] ?? 0) : 0;
		const cameraY =
			Math.abs(gamepad?.axes[3] ?? 0) > 0.16 ? (gamepad?.axes[3] ?? 0) : 0;
		this.cameraYaw -= cameraX * 0.045;
		this.cameraPitch = Math.min(
			0.2,
			Math.max(-0.72, this.cameraPitch - cameraY * 0.03),
		);
		const axisX =
			Math.abs(gamepad?.axes[0] ?? 0) > 0.16 ? (gamepad?.axes[0] ?? 0) : 0;
		const axisZ =
			Math.abs(gamepad?.axes[1] ?? 0) > 0.16 ? -(gamepad?.axes[1] ?? 0) : 0;
		const attack = Boolean(gamepad?.buttons[2]?.pressed);
		const dodge = Boolean(gamepad?.buttons[1]?.pressed);
		const jump = Boolean(gamepad?.buttons[0]?.pressed);
		const lock = Boolean(gamepad?.buttons[10]?.pressed);
		const result: Action3dInput = {
			...EMPTY_ACTION3D_INPUT,
			moveX:
				(this.down.has("KeyD") || this.down.has("ArrowRight") ? 1 : 0) -
				(this.down.has("KeyA") || this.down.has("ArrowLeft") ? 1 : 0) +
				axisX,
			moveZ:
				(this.down.has("KeyW") || this.down.has("ArrowUp") ? 1 : 0) -
				(this.down.has("KeyS") || this.down.has("ArrowDown") ? 1 : 0) +
				axisZ,
			cameraYaw: this.cameraYaw,
			jump:
				this.pressed.has("Space") || this.buttonEdge(jump, this.gamepadJump),
			sprint:
				this.down.has("ShiftLeft") ||
				this.down.has("ShiftRight") ||
				Boolean(gamepad?.buttons[6]?.pressed),
			dodge:
				this.pressed.has("ControlLeft") ||
				this.pressed.has("ControlRight") ||
				this.buttonEdge(dodge, this.gamepadDodge),
			attack:
				this.pointerAttack ||
				this.pressed.has("KeyF") ||
				this.buttonEdge(attack, this.gamepadAttack),
			lockOn:
				this.pressed.has("KeyE") || this.buttonEdge(lock, this.gamepadLock),
		};
		this.pressed.clear();
		this.pointerAttack = false;
		this.gamepadAttack = attack;
		this.gamepadDodge = dodge;
		this.gamepadJump = jump;
		this.gamepadLock = lock;
		return result;
	}
	dispose(): void {
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		document.removeEventListener("mousemove", this.onMouseMove);
		document.removeEventListener("pointerlockchange", this.onPointerLockChange);
		this.canvas.removeEventListener("pointerdown", this.onPointerDown);
		this.canvas.removeEventListener("contextmenu", this.onContextMenu);
		if (document.pointerLockElement === this.canvas)
			void document.exitPointerLock();
	}
}
