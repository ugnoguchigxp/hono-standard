import type { GameSaveSlotId } from "@shared/game";

export const REQUEST_MANUAL_GAME_SAVE_EVENT =
	"hono-standard:rpg-request-manual-save";

export type ManualGameSaveRequestDetail = {
	slotId: GameSaveSlotId;
};

export const requestManualGameSave = (slotId: GameSaveSlotId): void => {
	window.dispatchEvent(
		new CustomEvent<ManualGameSaveRequestDetail>(
			REQUEST_MANUAL_GAME_SAVE_EVENT,
			{
				detail: { slotId },
			},
		),
	);
};
