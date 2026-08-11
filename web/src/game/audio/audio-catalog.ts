import type { BattleEvent } from "@shared/game";

export type GameAudioBus = "bgm" | "environment" | "ui" | "battle" | "voice";

export interface GameAudioDefinition {
	id: string;
	urls: readonly [string, string];
	bus: GameAudioBus;
	loop: boolean;
	volume: number;
}

const audioPath = (path: string): readonly [string, string] => [
	`/assets/game/audio/${path}.opus`,
	`/assets/game/audio/${path}.mp3`,
];

export const gameAudioCatalog = [
	{
		id: "bgm-field-signal-ruins",
		urls: audioPath("bgm/field-dark-shrine"),
		bus: "bgm",
		loop: true,
		volume: 0.74,
	},
	{
		id: "bgm-field-relay-camp",
		urls: audioPath("bgm/field-relay-camp"),
		bus: "bgm",
		loop: true,
		volume: 0.7,
	},
	{
		id: "bgm-battle-standard",
		urls: audioPath("bgm/battle-standard"),
		bus: "bgm",
		loop: true,
		volume: 0.78,
	},
	{
		id: "bgm-battle-boss",
		urls: audioPath("bgm/battle-boss"),
		bus: "bgm",
		loop: true,
		volume: 0.82,
	},
	{
		id: "se-ui-navigate",
		urls: audioPath("se/ui/navigate"),
		bus: "ui",
		loop: false,
		volume: 0.55,
	},
	{
		id: "se-ui-confirm",
		urls: audioPath("se/ui/confirm"),
		bus: "ui",
		loop: false,
		volume: 0.68,
	},
	{
		id: "se-ui-cancel",
		urls: audioPath("se/ui/cancel"),
		bus: "ui",
		loop: false,
		volume: 0.64,
	},
	{
		id: "se-battle-attack",
		urls: audioPath("se/battle/attack"),
		bus: "battle",
		loop: false,
		volume: 0.84,
	},
	{
		id: "se-battle-ability",
		urls: audioPath("se/battle/ability"),
		bus: "battle",
		loop: false,
		volume: 0.78,
	},
	{
		id: "se-battle-boss-roar",
		urls: audioPath("se/battle/boss-roar"),
		bus: "battle",
		loop: false,
		volume: 0.82,
	},
	{
		id: "se-field-recovery",
		urls: audioPath("se/field/recovery"),
		bus: "environment",
		loop: false,
		volume: 0.78,
	},
] as const satisfies readonly GameAudioDefinition[];

export type GameAudioId = (typeof gameAudioCatalog)[number]["id"];

export const gameAudioById: Readonly<Record<GameAudioId, GameAudioDefinition>> =
	Object.fromEntries(
		gameAudioCatalog.map((audio) => [audio.id, audio]),
	) as Record<GameAudioId, GameAudioDefinition>;

export const fieldMusicForMap = (mapId: string): GameAudioId =>
	mapId === "relay-camp" ? "bgm-field-relay-camp" : "bgm-field-signal-ruins";

export const battleMusicForEncounter = (encounterId: string): GameAudioId =>
	encounterId === "signal-ruins-encounter"
		? "bgm-battle-boss"
		: "bgm-battle-standard";

export const battleSoundForEvent = (event: BattleEvent): GameAudioId | null => {
	if (event.type === "action.damage") {
		return event.abilityId ? "se-battle-ability" : "se-battle-attack";
	}
	if (
		event.type === "action.heal" ||
		event.type === "action.defend" ||
		event.type === "item.used" ||
		event.type === "status.applied"
	) {
		return "se-battle-ability";
	}
	return null;
};
