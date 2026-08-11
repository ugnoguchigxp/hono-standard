import type {
	AbilityDefinition,
	BattleCombatant,
	BattleCommand,
	BattleItemStack,
	BattleState,
} from "@shared/game";
import type Phaser from "phaser";
import type { GameAudioManager } from "../../audio/GameAudioManager";
import { type GameAction, InputManager } from "../../input/InputManager";
import type { BattleMenuLayer } from "./BattleHud";

export const BATTLE_COMMAND_LABELS = [
	"Attack",
	"Abilities",
	"Items",
	"Defend",
	"Escape",
] as const;

type PendingBattleAction =
	| { type: "attack" }
	| { type: "ability"; ability: AbilityDefinition }
	| { type: "item"; item: BattleItemStack };

export type BattleInputSnapshot = {
	menuLayer: BattleMenuLayer;
	commandIndex: number;
	targetIndex: number;
	abilityIndex: number;
	itemIndex: number;
	availableItems: BattleItemStack[];
	targetCandidates: BattleCombatant[];
};

export class BattleInputController {
	private readonly input: InputManager;
	private commandIndex = 0;
	private targetIndex = 0;
	private abilityIndex = 0;
	private itemIndex = 0;
	private menuLayer: BattleMenuLayer = "commands";
	private pendingAction: PendingBattleAction | null = null;

	constructor(
		scene: Phaser.Scene,
		private readonly audioManager: GameAudioManager,
	) {
		this.input = new InputManager(scene);
	}

	update(actionAnimating: boolean): void {
		this.input.update();
		if (actionAnimating) return;
		if (
			this.input.justPressed("UP") ||
			this.input.justPressed("DOWN") ||
			this.input.justPressed("LEFT") ||
			this.input.justPressed("RIGHT")
		) {
			this.audioManager.playSe("se-ui-navigate");
		} else if (this.input.justPressed("CONFIRM")) {
			this.audioManager.playSe("se-ui-confirm");
		} else if (this.input.justPressed("CANCEL")) {
			this.audioManager.playSe("se-ui-cancel");
		}
	}

	justPressed(action: GameAction): boolean {
		return this.input.justPressed(action);
	}

	destroy(): void {
		this.input.destroy();
	}

	reset(): void {
		this.commandIndex = 0;
		this.targetIndex = 0;
		this.abilityIndex = 0;
		this.itemIndex = 0;
		this.menuLayer = "commands";
		this.pendingAction = null;
	}

	resetAfterCommand(): void {
		this.commandIndex = 0;
		this.targetIndex = 0;
		this.menuLayer = "commands";
		this.pendingAction = null;
	}

	handleCommandInput(
		battleState: BattleState,
		executeCommand: (command: BattleCommand) => void,
		setStatus: (status: string) => void,
	): void {
		if (this.input.justPressed("CANCEL")) {
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
			this.handleTargetInput(battleState, executeCommand);
			return;
		}

		const entries = this.currentMenuEntries(battleState);
		if (entries.length === 0) {
			if (this.input.justPressed("CONFIRM")) {
				setStatus("Nothing is available in this list.");
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
		if (this.input.justPressed("UP")) {
			nextIndex = (currentIndex + entries.length - 1) % entries.length;
		}
		if (this.input.justPressed("DOWN")) {
			nextIndex = (currentIndex + 1) % entries.length;
		}
		if (this.menuLayer === "commands") this.commandIndex = nextIndex;
		else if (this.menuLayer === "abilities") this.abilityIndex = nextIndex;
		else this.itemIndex = nextIndex;

		if (!this.input.justPressed("CONFIRM")) return;
		const actor = this.activeActor(battleState);
		if (!actor) return;
		if (this.menuLayer === "commands") {
			const selected = BATTLE_COMMAND_LABELS[this.commandIndex];
			if (selected === "Abilities") {
				this.menuLayer = "abilities";
				this.abilityIndex = 0;
			} else if (selected === "Items") {
				this.menuLayer = "items";
				this.itemIndex = 0;
			} else if (selected === "Defend") {
				executeCommand({ type: "defend", actorId: actor.id });
			} else if (selected === "Escape") {
				if (battleState.canEscape) {
					executeCommand({ type: "escape", actorId: actor.id });
				} else {
					setStatus("The boss field prevents escape.");
				}
			} else {
				this.beginTargeting(
					battleState,
					{ type: "attack" },
					executeCommand,
					setStatus,
				);
			}
			return;
		}
		if (this.menuLayer === "abilities") {
			const ability = actor.abilities[this.abilityIndex];
			if (!ability) return;
			if (actor.mp < ability.mpCost) {
				setStatus(`${actor.name} needs ${ability.mpCost} MP.`);
				return;
			}
			this.beginTargeting(
				battleState,
				{ type: "ability", ability },
				executeCommand,
				setStatus,
			);
			return;
		}
		const item = this.availableBattleItems(battleState)[this.itemIndex];
		if (item) {
			this.beginTargeting(
				battleState,
				{ type: "item", item },
				executeCommand,
				setStatus,
			);
		}
	}

	snapshot(battleState: BattleState): BattleInputSnapshot {
		return {
			menuLayer: this.menuLayer,
			commandIndex: this.commandIndex,
			targetIndex: this.targetIndex,
			abilityIndex: this.abilityIndex,
			itemIndex: this.itemIndex,
			availableItems: this.availableBattleItems(battleState),
			targetCandidates:
				this.menuLayer === "target" ? this.targetCandidates(battleState) : [],
		};
	}

	private currentMenuEntries(battleState: BattleState): readonly string[] {
		const actor = this.activeActor(battleState);
		if (this.menuLayer === "commands") return BATTLE_COMMAND_LABELS;
		if (this.menuLayer === "abilities") {
			return actor?.abilities.map(({ name }) => name) ?? [];
		}
		return this.availableBattleItems(battleState).map(({ name }) => name);
	}

	private availableBattleItems(battleState: BattleState): BattleItemStack[] {
		return battleState.items.filter(
			(item) => item.count > 0 && item.effect !== "none",
		);
	}

	private activeActor(battleState: BattleState): BattleCombatant | undefined {
		return battleState.party.find(
			(member) => member.id === battleState.activeActorId,
		);
	}

	private beginTargeting(
		battleState: BattleState,
		action: PendingBattleAction,
		executeCommand: (command: BattleCommand) => void,
		setStatus: (status: string) => void,
	): void {
		this.pendingAction = action;
		this.targetIndex = 0;
		const targets = this.targetCandidates(battleState, action);
		if (targets.length === 0) {
			setStatus("There is no valid target.");
			this.pendingAction = null;
			return;
		}
		if (
			action.type === "ability" &&
			(action.ability.target.endsWith("all") ||
				action.ability.target === "self")
		) {
			this.executePendingAction(battleState, targets[0].id, executeCommand);
			return;
		}
		this.menuLayer = "target";
	}

	private targetCandidates(
		battleState: BattleState,
		action = this.pendingAction,
	): BattleCombatant[] {
		const actor = this.activeActor(battleState);
		if (!action || !actor) return [];
		if (action.type === "attack") {
			return battleState.enemies.filter((enemy) => enemy.hp > 0);
		}
		if (action.type === "item") {
			return battleState.party.filter((member) =>
				action.item.effect === "revive" ? member.hp === 0 : member.hp > 0,
			);
		}
		if (action.ability.target === "self") return [actor];
		if (action.ability.target.startsWith("ally")) {
			return battleState.party.filter((member) => member.hp > 0);
		}
		return battleState.enemies.filter((enemy) => enemy.hp > 0);
	}

	private handleTargetInput(
		battleState: BattleState,
		executeCommand: (command: BattleCommand) => void,
	): void {
		if (!this.pendingAction) return;
		const targets = this.targetCandidates(battleState);
		if (targets.length === 0) return;
		if (this.input.justPressed("UP") || this.input.justPressed("LEFT")) {
			this.targetIndex =
				(this.targetIndex + targets.length - 1) % targets.length;
		}
		if (this.input.justPressed("DOWN") || this.input.justPressed("RIGHT")) {
			this.targetIndex = (this.targetIndex + 1) % targets.length;
		}
		if (this.input.justPressed("CONFIRM")) {
			this.executePendingAction(
				battleState,
				targets[this.targetIndex].id,
				executeCommand,
			);
		}
	}

	private executePendingAction(
		battleState: BattleState,
		targetId: string,
		executeCommand: (command: BattleCommand) => void,
	): void {
		const actorId = battleState.activeActorId;
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
		executeCommand(command);
	}
}
