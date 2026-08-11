import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	battleMusicForEncounter,
	battleSoundForEvent,
	fieldMusicForMap,
	gameAudioCatalog,
} from "./audio-catalog";

describe("game audio catalog", () => {
	it("offers Chromium-first Opus and MP3 fallback URLs for every cue", () => {
		expect(new Set(gameAudioCatalog.map(({ id }) => id))).toHaveLength(
			gameAudioCatalog.length,
		);
		for (const audio of gameAudioCatalog) {
			expect(audio.urls[0]).toMatch(/^\/assets\/game\/audio\/.+\.opus$/);
			expect(audio.urls[1]).toMatch(/^\/assets\/game\/audio\/.+\.mp3$/);
			expect(audio.volume).toBeGreaterThan(0);
			expect(audio.volume).toBeLessThanOrEqual(1);
			for (const url of audio.urls) {
				expect(
					existsSync(path.join(process.cwd(), "web/public", url.slice(1))),
					`Missing runtime audio file: ${url}`,
				).toBe(true);
			}
		}
	});

	it("selects distinct field and boss battle music", () => {
		expect(fieldMusicForMap("relay-camp")).toBe("bgm-field-relay-camp");
		expect(fieldMusicForMap("signal-ruins")).toBe(
			"bgm-field-signal-ruins",
		);
		expect(battleMusicForEncounter("signal-ruins-encounter")).toBe(
			"bgm-battle-boss",
		);
		expect(battleMusicForEncounter("ash-road-ambush")).toBe(
			"bgm-battle-standard",
		);
	});

	it("keeps battle action sounds independent from motion effects", () => {
		expect(
			battleSoundForEvent({
				type: "action.damage",
				actorId: "mira",
				targetId: "wisp",
				amount: 10,
				element: "physical",
				multiplier: 1,
			}),
		).toBe("se-battle-attack");
		expect(
			battleSoundForEvent({
				type: "action.damage",
				actorId: "lune",
				targetId: "wisp",
				abilityId: "spark",
				amount: 10,
				element: "lightning",
				multiplier: 1,
			}),
		).toBe("se-battle-ability");
		expect(
			battleSoundForEvent({ type: "gauge.ready", actorId: "mira" }),
		).toBeNull();
	});
});
