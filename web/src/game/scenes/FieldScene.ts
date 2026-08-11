import {
	evaluateContentCondition,
	type FieldDirection,
	type FieldState,
	type GameSession,
	type MapDefinitionV1,
} from "@shared/game";
import Phaser from "phaser";
import {
	type FieldWalkFrame,
	getFieldCharacterTextureKey,
} from "../art/pixel-textures";
import { getRequiredAssetIdsForMap } from "../content/content-assets";
import {
	ContentLoadError,
	type GameContentLoader,
} from "../content/GameContentLoader";
import { GAME_RENDER_SCALE, GAME_TEXT_RESOLUTION } from "../display";
import { InputManager } from "../input/InputManager";
import { getPendingFieldTriggerAction } from "../presentation/field-transition";
import type { GameRuntimeError } from "../runtime-errors";
import { fieldMusicForMap } from "../audio/audio-catalog";
import type { GameAudioManager } from "../audio/GameAudioManager";
import { gameSettingsStore } from "../settings/GameSettingsStore";

const parseColor = (color: string): number =>
	Number.parseInt(color.slice(1), 16);

class ReportedRuntimeError extends Error {}

const directionBetween = (
	from: { x: number; y: number },
	to: { x: number; y: number },
): FieldDirection | null => {
	if (to.x > from.x) return "RIGHT";
	if (to.x < from.x) return "LEFT";
	if (to.y > from.y) return "DOWN";
	if (to.y < from.y) return "UP";
	return null;
};

export class FieldScene extends Phaser.Scene {
	private inputManager?: InputManager;
	private fieldState!: FieldState;
	private map!: MapDefinitionV1;
	private partySprites: Phaser.GameObjects.Image[] = [];
	private partyShadows: Phaser.GameObjects.Ellipse[] = [];
	private partyTextureKeys: string[] = [];
	private partyFacings: FieldDirection[] = [];
	private walkFrame: Exclude<FieldWalkFrame, 0> = 1;
	private lastMoveAt = Number.NEGATIVE_INFINITY;
	private transitionStarted = false;
	private contentAbortController?: AbortController;
	private sceneActive = false;

	constructor(
		private readonly gameSession: GameSession,
		private readonly contentLoader: GameContentLoader,
		private readonly onRuntimeError: (error: GameRuntimeError) => void,
		private readonly audioManager: GameAudioManager,
	) {
		super("field");
	}

	create(): void {
		const snapshot = this.gameSession.snapshot();
		this.fieldState = snapshot.field;
		this.map = this.gameSession.content.getMap(snapshot.location.mapId);
		this.audioManager.playBgm(fieldMusicForMap(this.map.id));
		this.transitionStarted = true;
		this.sceneActive = true;
		this.partySprites = [];
		this.partyShadows = [];
		this.partyTextureKeys = [];
		this.partyFacings = [];
		this.walkFrame = 1;
		this.lastMoveAt = Number.NEGATIVE_INFINITY;
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.sceneActive = false;
			this.contentAbortController?.abort();
			this.inputManager?.destroy();
		});

		this.setMapBackgroundStatus("loading");
		if (!this.textures.exists(this.map.backgroundAssetId)) {
			void this.restoreCurrentMapAssets();
			return;
		}
		this.initializeField();
	}

	private initializeField(): void {
		if (!this.sceneActive) return;
		if (!this.textures.exists(this.map.backgroundAssetId)) {
			this.reportAssetFailure(this.map.backgroundAssetId);
			return;
		}
		this.inputManager = new InputManager(this);
		this.drawMap();
		this.createAtmosphere();
		this.createParty();
		this.configureCamera();
		this.setMapBackgroundStatus("ready");
		if (!this.resumePendingTrigger()) this.transitionStarted = false;
	}

	update(time: number): void {
		if (!this.inputManager || this.transitionStarted) return;
		this.inputManager.update();
		if (
			this.inputManager.justPressed("CANCEL") ||
			this.inputManager.justPressed("MENU")
		) {
			this.audioManager.playSe("se-ui-confirm");
			this.transitionStarted = true;
			this.scene.start("field-menu");
			return;
		}
		if (time - this.lastMoveAt < 125) return;

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
		const previousPositions = this.fieldState.partyPositions.map(
			(position) => ({
				...position,
			}),
		);
		const transition = this.gameSession.dispatch({
			type: "field.move",
			direction,
		});
		this.fieldState = transition.state.field;
		const moveEvent = transition.events.find(
			(envelope) => envelope.event.type === "field.moved",
		);
		if (moveEvent?.event.type !== "field.moved") return;
		this.walkFrame = this.walkFrame === 1 ? 2 : 1;
		this.syncPartySprites(
			!gameSettingsStore.getSnapshot().reducedMotion,
			previousPositions,
		);

		if (transition.state.mode === "battle") {
			this.transitionStarted = true;
			this.cameras.main.fadeOut(240, 64, 8, 24);
			this.time.delayedCall(260, () => this.scene.start("battle"));
			return;
		}
		const pendingTriggerId = moveEvent.event.pendingTriggerId;
		if (!pendingTriggerId) return;
		this.transitionStarted = true;
		this.continuePendingTrigger(pendingTriggerId);
	}

	private resumePendingTrigger(): boolean {
		const pendingTriggerId = this.fieldState.pendingTriggerId;
		if (!pendingTriggerId) return false;
		this.transitionStarted = true;
		this.continuePendingTrigger(pendingTriggerId);
		return true;
	}

	private continuePendingTrigger(pendingTriggerId: string): void {
		const action = getPendingFieldTriggerAction(
			pendingTriggerId,
			this.map.triggers,
			(mapId) => Boolean(this.gameSession.content.mapsById[mapId]),
		);
		if (action?.type === "load-map") {
			void this.loadTargetMapAndResolve(action.mapId);
			return;
		}
		if (action?.type === "invalid") {
			this.onRuntimeError({
				code: "content",
				retryable: false,
				message: `The pending world trigger '${action.triggerId}' no longer exists.`,
			});
			return;
		}
		if (action?.type === "resolve") this.resolvePendingTrigger();
	}

	private resolvePendingTrigger(): void {
		const resolved = this.gameSession.dispatch({
			type: "field.trigger.resolve",
		});
		const recovery = resolved.events.find(
			(envelope) => envelope.event.type === "party.recovered",
		);
		if (recovery?.event.type === "party.recovered") {
			this.showRecovery(recovery.event.restoredHp, recovery.event.restoredMp);
			return;
		}
		this.cameras.main.fadeOut(240, 12, 18, 38);
		this.time.delayedCall(260, () => {
			if (resolved.state.mode === "event") {
				this.scene.start("event");
			} else if (resolved.state.mode === "battle") {
				this.scene.start("battle");
			} else {
				this.scene.restart();
			}
		});
	}

	private async loadTargetMapAndResolve(mapId: string): Promise<void> {
		this.contentAbortController?.abort();
		const controller = new AbortController();
		this.contentAbortController = controller;
		try {
			const registry = await this.contentLoader.loadMap(
				mapId,
				controller.signal,
			);
			if (controller.signal.aborted) return;
			await this.loadRequiredAssets(registry, mapId);
			if (controller.signal.aborted) return;
			this.gameSession.replaceContent(registry);
			this.resolvePendingTrigger();
		} catch (error) {
			if (controller.signal.aborted || error instanceof ReportedRuntimeError)
				return;
			this.onRuntimeError({
				code: "content",
				retryable: error instanceof ContentLoadError ? error.retryable : true,
				message:
					error instanceof Error
						? error.message
						: "The next world area could not be loaded.",
			});
		} finally {
			if (this.contentAbortController === controller) {
				this.contentAbortController = undefined;
			}
		}
	}

	private loadRequiredAssets(
		registry: GameSession["content"],
		mapId: string,
	): Promise<void> {
		const assets = getRequiredAssetIdsForMap(registry, mapId)
			.filter((assetId) => !this.textures.exists(assetId))
			.map((assetId) => registry.getAsset(assetId));
		if (assets.length === 0) return Promise.resolve();
		return new Promise((resolve, reject) => {
			const cleanup = () => {
				this.load.off("complete", completed);
				this.load.off("loaderror", failed);
			};
			const completed = () => {
				cleanup();
				const missingAsset = assets.find(
					(asset) => !this.textures.exists(asset.id),
				);
				if (missingAsset) {
					this.reportAssetFailure(missingAsset.id);
					reject(new ReportedRuntimeError());
					return;
				}
				resolve();
			};
			const failed = (file: { key: string }) => {
				cleanup();
				this.reportAssetFailure(file.key);
				reject(new ReportedRuntimeError());
			};
			this.load.once("complete", completed);
			this.load.once("loaderror", failed);
			for (const asset of assets) this.load.image(asset.id, asset.url);
			this.load.start();
		});
	}

	private async restoreCurrentMapAssets(): Promise<void> {
		try {
			await this.loadRequiredAssets(this.gameSession.content, this.map.id);
			if (!this.sceneActive) return;
			this.initializeField();
		} catch (error) {
			if (!this.sceneActive || error instanceof ReportedRuntimeError) return;
			this.reportAssetFailure(this.map.backgroundAssetId);
		}
	}

	private reportAssetFailure(assetId: string): void {
		this.setMapBackgroundStatus("error");
		this.onRuntimeError({
			code: "asset",
			assetId,
			retryable: true,
			message: `A required world image (${assetId}) could not be loaded.`,
		});
	}

	private setMapBackgroundStatus(status: "loading" | "ready" | "error"): void {
		this.game.canvas.dataset.mapBackground = status;
		this.game.canvas.dataset.mapBackgroundId = this.map.backgroundAssetId;
	}

	private showRecovery(restoredHp: number, restoredMp: number): void {
		this.audioManager.playSe("se-field-recovery");
		const camera = this.cameras.main;
		const centerX = camera.worldView.centerX;
		const centerY = camera.worldView.centerY;
		camera.stopFollow();
		if (!gameSettingsStore.getSnapshot().reducedMotion) {
			camera.flash(280, 114, 215, 192);
		}
		this.add
			.rectangle(centerX, centerY, 174, 28, 0x071523, 0.92)
			.setStrokeStyle(1, 0x72d7c0, 0.9)
			.setDepth(10_000);
		this.add
			.text(
				centerX,
				centerY,
				restoredHp > 0 || restoredMp > 0
					? `THE SPRING RESTORES ${restoredHp} HP / ${restoredMp} MP`
					: "THE PARTY IS ALREADY RESTORED",
				{
					fontFamily: '"Trebuchet MS", Arial, sans-serif',
					fontSize: "7px",
					fontStyle: "bold",
					color: "#c5f5e7",
					resolution: GAME_TEXT_RESOLUTION,
				},
			)
			.setOrigin(0.5)
			.setDepth(10_001);
		this.time.delayedCall(720, () => {
			this.cameras.main.fadeOut(220, 20, 80, 88);
			this.time.delayedCall(240, () => this.scene.restart());
		});
	}

	private createParty(): void {
		const members = this.gameSession.snapshot().party.members;
		this.partyShadows = this.fieldState.partyPositions.map(() =>
			this.add.ellipse(0, 0, 12, 4, 0x07101c, 0.55),
		);
		this.partySprites = this.fieldState.partyPositions.map(
			(_position, index) => {
				const actor = this.gameSession.content.getActor(members[index].id);
				this.partyTextureKeys[index] = actor.textureKey;
				this.partyFacings[index] = this.fieldState.facing;
				return this.add
					.image(
						0,
						0,
						getFieldCharacterTextureKey(
							actor.textureKey,
							this.fieldState.facing,
							0,
						),
					)
					.setOrigin(0.5, 1)
					.setScale(0.66)
					.setFlipX(this.fieldState.facing === "LEFT");
			},
		);
		this.syncPartySprites();
	}

	private syncPartySprites(
		animated = false,
		previousPositions?: FieldState["partyPositions"],
	): void {
		this.fieldState.partyPositions.forEach((position, index) => {
			const x = position.x * this.map.tileSize + this.map.tileSize / 2;
			const footY = position.y * this.map.tileSize + this.map.tileSize - 1;
			const shadow = this.partyShadows[index];
			const sprite = this.partySprites[index];
			const facing = previousPositions
				? (directionBetween(previousPositions[index], position) ??
					this.partyFacings[index])
				: (this.partyFacings[index] ?? this.fieldState.facing);
			this.partyFacings[index] = facing;
			sprite
				.setTexture(
					getFieldCharacterTextureKey(
						this.partyTextureKeys[index],
						facing,
						animated ? this.walkFrame : 0,
					),
				)
				.setFlipX(facing === "LEFT");
			shadow.setDepth(footY - 1);
			sprite.setDepth(footY);
			if (!animated) {
				shadow.setPosition(x, footY - 1);
				sprite.setPosition(x, footY);
				return;
			}
			this.tweens.killTweensOf([shadow, sprite]);
			this.tweens.add({
				targets: shadow,
				x,
				y: footY - 1,
				duration: 105,
				ease: "Sine.easeOut",
			});
			this.tweens.add({
				targets: sprite,
				x,
				y: footY,
				duration: 105,
				ease: "Sine.easeOut",
				onComplete: () => {
					const idleFacing = this.partyFacings[index];
					sprite
						.setTexture(
							getFieldCharacterTextureKey(
								this.partyTextureKeys[index],
								idleFacing,
								0,
							),
						)
						.setFlipX(idleFacing === "LEFT");
				},
			});
		});
	}

	private drawMap(): void {
		const worldWidth = this.map.width * this.map.tileSize;
		const worldHeight = this.map.height * this.map.tileSize;
		this.cameras.main.setBackgroundColor("#091225");
		this.add
			.image(0, 0, this.map.backgroundAssetId)
			.setOrigin(0)
			.setDisplaySize(worldWidth, worldHeight)
			.setDepth(0);
		this.add
			.rectangle(
				worldWidth / 2,
				worldHeight / 2,
				worldWidth,
				worldHeight,
				0x07101d,
				0.06,
			)
			.setDepth(0.5);
		const story = this.gameSession.snapshot().story;
		for (const trigger of this.map.triggers) {
			if (
				!trigger.marker ||
				!evaluateContentCondition(trigger.condition, story)
			) {
				continue;
			}
			const x = trigger.position.x * this.map.tileSize + this.map.tileSize / 2;
			const y = trigger.position.y * this.map.tileSize + this.map.tileSize / 2;
			const color = parseColor(trigger.marker.color);
			const marker =
				trigger.marker.shape === "diamond"
					? this.add.rectangle(x, y, 8, 8, color, 0.08).setAngle(45)
					: trigger.marker.shape === "gate"
						? this.add.rectangle(x, y, 10, 12, color, 0.08)
						: trigger.marker.shape === "spring"
							? this.add.circle(x, y, 7, 0x082b3b, 0.88)
							: this.add.circle(x, y, 5, color, 0.08);
			marker
				.setStrokeStyle(1, color, 0.75)
				.setBlendMode(Phaser.BlendModes.ADD)
				.setDepth(2);
			if (trigger.marker.shape === "spring") {
				this.add
					.circle(x, y, 4, color, 0.58)
					.setStrokeStyle(1, 0xc5f5e7, 0.9)
					.setBlendMode(Phaser.BlendModes.ADD)
					.setDepth(2.1);
				this.add.circle(x - 1, y - 1, 1.5, 0xe8fff8, 0.95).setDepth(2.2);
			}
			if (
				trigger.marker.pulse &&
				!gameSettingsStore.getSnapshot().reducedMotion
			) {
				this.tweens.add({
					targets: marker,
					alpha: { from: 0.25, to: 0.75 },
					scale: { from: 0.8, to: 1.45 },
					duration: 1_400,
					yoyo: true,
					repeat: -1,
					ease: "Sine.easeInOut",
				});
			}
		}
	}

	private createAtmosphere(): void {
		const worldWidth = this.map.width * this.map.tileSize;
		const worldHeight = this.map.height * this.map.tileSize;
		const particles = [
			{ x: worldWidth * 0.08, y: worldHeight * 0.16, delay: 0 },
			{ x: worldWidth * 0.22, y: worldHeight * 0.42, delay: 500 },
			{ x: worldWidth * 0.37, y: worldHeight * 0.2, delay: 900 },
			{ x: worldWidth * 0.52, y: worldHeight * 0.68, delay: 1_300 },
			{ x: worldWidth * 0.68, y: worldHeight * 0.34, delay: 1_700 },
			{ x: worldWidth * 0.82, y: worldHeight * 0.72, delay: 2_100 },
			{ x: worldWidth * 0.94, y: worldHeight * 0.18, delay: 2_500 },
		];
		for (const particle of particles) {
			const mote = this.add
				.circle(particle.x, particle.y, 1, 0xc5e8dc, 0.45)
				.setDepth(190);
			if (gameSettingsStore.getSnapshot().reducedMotion) continue;
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

	private configureCamera(): void {
		const worldWidth = this.map.width * this.map.tileSize;
		const worldHeight = this.map.height * this.map.tileSize;
		const leader = this.partySprites[0];
		this.cameras.main
			.setZoom(GAME_RENDER_SCALE)
			.setBounds(0, 0, worldWidth, worldHeight)
			.setRoundPixels(true);
		if (leader) {
			this.cameras.main.startFollow(leader, true, 0.16, 0.16);
		}
	}
}
