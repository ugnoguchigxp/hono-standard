import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	ContentValidationError,
	evaluateContentCondition,
	parseContentManifest,
	parseGameContentBundle,
	type RawGameContentBundle,
} from "./registry";
import type { ContentManifestV1 } from "./schema";

const contentRoot = path.join(
	process.cwd(),
	"web/public/game-content/data-driven-world-1",
);
const readJson = (filePath: string) =>
	JSON.parse(readFileSync(path.join(contentRoot, filePath), "utf8"));

const loadRawBundle = (): RawGameContentBundle => {
	const manifest = readJson("manifest.json") as ContentManifestV1;
	return {
		manifest,
		maps: manifest.documents.maps.map((documentPath) => ({
			path: documentPath,
			data: readJson(documentPath),
		})),
		events: manifest.documents.events.map((documentPath) => ({
			path: documentPath,
			data: readJson(documentPath),
		})),
	};
};

const cloneBundle = (): RawGameContentBundle => structuredClone(loadRawBundle());

const captureIssues = (bundle: RawGameContentBundle) => {
	try {
		parseGameContentBundle(bundle);
		throw new Error("Expected content validation to fail.");
	} catch (error) {
		expect(error).toBeInstanceOf(ContentValidationError);
		return (error as ContentValidationError).issues;
	}
};

describe("game content registry", () => {
	it("builds immutable ID indexes and collision lookups", () => {
		const registry = parseGameContentBundle(loadRawBundle());
		expect(registry.contentVersion).toBe("data-driven-world-1");
		expect(Object.keys(registry.mapsById)).toEqual([
			"signal-ruins",
			"relay-camp",
		]);
		expect(registry.getMap("relay-camp").displayName).toBe("Relay Camp");
		expect(registry.getEvent("relay-camp-council").nodes.length).toBeGreaterThan(2);
		expect(registry.getAsset("relay-camp-field").type).toBe("image");
		expect(registry.getActor("mira").displayName).toBe("Mira");
		expect(registry.getStatusEffect("valor").polarity).toBe("positive");
		expect(registry.getAbility("mend").kind).toBe("heal");
		expect(registry.getCharacter("mira").job).toBe("HERO");
		expect(registry.getItem("potion").effect).toBe("restore-hp");
		expect(registry.getEquipment("rune-blade").slot).toBe("weapon");
		expect(registry.getEnemy("ash-wisp").level).toBe(1);
		expect(registry.getEncounter("signal-ruins-roamers").boss).toBe(false);
		expect(registry.hasEncounter("signal-ruins-encounter")).toBe(true);
		expect(registry.hasEncounter("signal-ruins-roamers")).toBe(true);
		expect(registry.hasEncounter("missing-encounter")).toBe(false);
		expect(registry.getMap("signal-ruins").randomEncounter).toEqual({
			encounterId: "signal-ruins-roamers",
			minimumSteps: 14,
			chance: 0.12,
		});
		expect(
			registry
				.getMap("signal-ruins")
				.triggers.find(({ id }) => id === "restoring-spring"),
		).toMatchObject({
			kind: "recovery",
			targetId: "party",
			marker: { shape: "spring" },
		});
		expect(registry.isCollision("signal-ruins", 2, 18)).toBe(true);
		expect(registry.isCollision("signal-ruins", 3, 18)).toBe(false);
		expect(registry.isCollision("signal-ruins", 13, 12)).toBe(true);
		expect(registry.isCollision("signal-ruins", 12, 12)).toBe(false);
		expect(registry.isCollision("signal-ruins", 27, 10)).toBe(true);
		expect(registry.isCollision("signal-ruins", 28, 10)).toBe(false);
		expect(registry.isCollision("signal-ruins", 36, 10)).toBe(true);
		expect(registry.isCollision("signal-ruins", 16, 16)).toBe(false);
		expect(registry.isCollision("signal-ruins", 16, 21)).toBe(true);
		expect(registry.isCollision("unknown", 0, 0)).toBe(false);
		expect(registry.isCollision("constructor", 0, 0)).toBe(false);
		expect(() => registry.getMap("missing")).toThrow("Unknown map");
		expect(() => registry.getMap("constructor")).toThrow("Unknown map");
		expect(() => registry.getEvent("missing")).toThrow("Unknown event");
		expect(() => registry.getEvent("constructor")).toThrow("Unknown event");
		expect(() => registry.getAsset("missing")).toThrow("Unknown asset");
		expect(() => registry.getAsset("constructor")).toThrow("Unknown asset");
		expect(() => registry.getActor("missing")).toThrow("Unknown actor");
		expect(() => registry.getActor("constructor")).toThrow("Unknown actor");
		expect(() => registry.getStatusEffect("missing")).toThrow(
			"Unknown status effect",
		);
		expect(() => registry.getAbility("missing")).toThrow("Unknown ability");
		expect(() => registry.getCharacter("missing")).toThrow("Unknown character");
		expect(() => registry.getItem("missing")).toThrow("Unknown item");
		expect(() => registry.getEquipment("missing")).toThrow("Unknown equipment");
		expect(() => registry.getEnemy("missing")).toThrow("Unknown enemy");
		expect(() => registry.getEncounter("missing")).toThrow("Unknown encounter");
		expect(() => {
			(registry.mapsById["relay-camp"] as { displayName: string }).displayName =
				"Changed";
		}).toThrow(TypeError);
		expect(registry.getMap("relay-camp").displayName).toBe("Relay Camp");
	});

	it("reports schema paths for invalid IDs, URLs, documents, and nodes", () => {
		const bundle = cloneBundle();
		const manifest = bundle.manifest as Record<string, unknown> & {
			assets: Array<Record<string, unknown>>;
		};
		manifest.assets[0].url = "https://example.com/asset.png";
		const issues = captureIssues(bundle);
		expect(issues[0]).toMatchObject({
			documentPath: "manifest.json",
			dataPath: "$.assets.0.url",
			code: "schema",
		});

		expect(() =>
			parseContentManifest({ manifestVersion: 1, contentVersion: "Bad ID" }),
		).toThrow(ContentValidationError);
		try {
			parseContentManifest(null);
		} catch (error) {
			expect((error as ContentValidationError).issues[0].dataPath).toBe("$");
		}

		const invalidNode = cloneBundle();
		(
			invalidNode.events[0].data as { nodes: Array<Record<string, unknown>> }
		).nodes[0].type = "script.eval";
		expect(captureIssues(invalidNode)[0].dataPath).toContain("nodes.0.type");
	});

	it("aggregates duplicate, bounds, and map reference failures", () => {
		const bundle = cloneBundle();
		const manifest = bundle.manifest as ContentManifestV1;
		manifest.assets.push({ ...manifest.assets[0] });
		manifest.actors.push({ ...manifest.actors[0] });
		manifest.encounterIds.push(
			"signal-ruins-encounter",
			"signal-ruins-encounter",
		);
		manifest.entryPoint.mapId = "missing-map";
		const map = bundle.maps[0].data as {
			id: string;
			backgroundAssetId: string;
			battleBackgroundAssetId: string;
			randomEncounter: { encounterId: string };
			entrances: Array<Record<string, any>>;
			checkpoints: Array<Record<string, any>>;
			collisionRegions: Array<Record<string, any>>;
			triggers: Array<Record<string, any>>;
		};
		map.entrances.push({ ...map.entrances[0], position: { x: 999, y: 999 } });
		map.entrances[0].checkpointId = "missing-checkpoint";
		map.checkpoints.push({ ...map.checkpoints[0], position: { x: 999, y: 999 } });
		map.collisionRegions.push({
			id: "overflow",
			x: 39,
			y: 23,
			width: 2,
			height: 2,
		});
		map.triggers.push(
			{
				id: "missing-event-trigger",
				kind: "event",
				position: { x: 999, y: 999 },
				targetId: "missing-event",
			},
			{
				id: "missing-map-trigger",
				kind: "map",
				position: { x: 2, y: 2 },
				targetId: "missing-map",
				targetEntranceId: "missing-entrance",
			},
			{
				id: "missing-checkpoint-trigger",
				kind: "checkpoint",
				position: { x: 3, y: 3 },
				targetId: "missing-checkpoint",
			},
		);
		map.backgroundAssetId = "missing-asset";
		map.battleBackgroundAssetId = "missing-battle-asset";
		map.randomEncounter.encounterId = "missing-random-encounter";

		const issues = captureIssues(bundle);
		const codes = new Set(issues.map(({ code }) => code));
		expect(codes.has("duplicate")).toBe(true);
		expect(codes.has("bounds")).toBe(true);
		expect(codes.has("reference")).toBe(true);
		expect(issues.some(({ message }) => message.includes("missing event"))).toBe(
			true,
		);
		expect(
			issues.some(({ message }) => message.includes("missing-random-encounter")),
		).toBe(true);
		expect(issues.some(({ message }) => message.includes("exceeds map bounds"))).toBe(
			true,
		);
	});

	it("rejects entrances, checkpoints, and triggers on collision geometry", () => {
		const bundle = cloneBundle();
		const map = bundle.maps[0].data as {
			entrances: Array<{ position: { x: number; y: number } }>;
			checkpoints: Array<{ position: { x: number; y: number } }>;
			triggers: Array<{ position: { x: number; y: number } }>;
		};
		map.entrances[0].position = { x: 2, y: 18 };
		map.checkpoints[0].position = { x: 13, y: 12 };
		map.triggers[0].position = { x: 27, y: 10 };

		const issues = captureIssues(bundle);
		expect(
			issues.some(
				(issue) =>
					issue.code === "placement" && issue.message.includes("Entrance"),
			),
		).toBe(true);
		expect(
			issues.some(
				(issue) =>
					issue.code === "placement" && issue.message.includes("Checkpoint"),
			),
		).toBe(true);
		expect(
			issues.some(
				(issue) =>
					issue.code === "placement" && issue.message.includes("Trigger"),
			),
		).toBe(true);
	});

	it("reports graph, actor, encounter, and asset-file failures", () => {
		const bundle = cloneBundle();
		const event = bundle.events[0].data as {
			entryNodeId: string;
			presentation: {
				backgroundAssetId: string;
				actors: Array<Record<string, string>>;
			};
			nodes: Array<Record<string, any>>;
		};
		event.entryNodeId = "missing-entry";
		event.presentation.backgroundAssetId = "missing-asset";
		event.presentation.actors.push({
			actorId: "missing-actor",
			slot: "left",
			expression: "neutral",
		});
		event.nodes.push({ ...event.nodes[0] });
		event.nodes[0].speakerId = "missing-actor";
		event.nodes[0].nextNodeId = "missing-node";
		event.nodes.push({
			id: "missing-actor-move",
			type: "actor.move",
			actorId: "missing-actor",
			slot: "right",
			nextNodeId: "unreachable-map",
		});
		const battleNode = event.nodes.find(({ type }) => type === "battle.start");
		if (!battleNode) throw new Error("Expected battle node fixture.");
		battleNode.encounterId = "missing-encounter";
		event.nodes.push({
			id: "unreachable-map",
			type: "map.enter",
			mapId: "missing-map",
			entranceId: "missing-entrance",
		});
		bundle.assetExists = (url) => !url.includes("relay-camp");

		const council = bundle.events[1].data as {
			nodes: Array<Record<string, any>>;
		};
		const choice = council.nodes.find(({ type }) => type === "choice");
		if (!choice) throw new Error("Expected choice node fixture.");
		for (const option of choice.choices) {
			option.condition = {
				type: "flag.equals",
				flagId: "conditional-choice",
				value: true,
			};
		}

		const issues = captureIssues(bundle);
		expect(issues.some(({ code }) => code === "graph")).toBe(true);
		expect(issues.some(({ code }) => code === "asset")).toBe(true);
		expect(
			issues.some(({ message }) => message.includes("unconditional fallback")),
		).toBe(true);
		expect(issues.some(({ message }) => message.includes("missing actor"))).toBe(
			true,
		);
	});

	it("rejects missing documents and excessive condition depth", () => {
		const bundle = cloneBundle();
		bundle.maps = bundle.maps.slice(1);
		let condition: Record<string, unknown> = {
			type: "flag.equals",
			flagId: "deep-flag",
			value: true,
		};
		for (let depth = 0; depth < 10; depth += 1) {
			condition = { type: "not", condition };
		}
		(
			(bundle.maps[0]?.data ?? loadRawBundle().maps[1].data) as {
				triggers: Array<Record<string, unknown>>;
			}
		).triggers[0].condition = condition;
		const issues = captureIssues(bundle);
		expect(issues.some(({ message }) => message.includes("was not loaded"))).toBe(
			true,
		);
		expect(issues.some(({ code }) => code === "limit")).toBe(true);
	});

	it("rejects event constructs that would otherwise fail at runtime", () => {
		const bundle = cloneBundle();
		const signal = bundle.events[0].data as {
			nodes: Array<Record<string, any>>;
		};
		const controlledNode = signal.nodes.find(
			({ id }) => id === "mark-ruins-cleared",
		);
		if (!controlledNode) throw new Error("Expected controlled node fixture.");
		Object.assign(controlledNode, {
			type: "actor.move",
			actorId: "narrator",
			slot: "center",
		});
		delete controlledNode.flagId;
		delete controlledNode.value;

		const checkpointNode = signal.nodes.find(
			({ type }) => type === "checkpoint.reach",
		);
		if (!checkpointNode) throw new Error("Expected checkpoint node fixture.");
		checkpointNode.mapId = "relay-camp";
		checkpointNode.checkpointId = "signal-core";

		const reaction = bundle.events[2].data as {
			nodes: Array<Record<string, any>>;
		};
		const endNode = reaction.nodes.find(({ type }) => type === "end");
		if (!endNode) throw new Error("Expected end node fixture.");
		endNode.condition = {
			type: "flag.equals",
			flagId: "invalid-terminal-condition",
			value: true,
		};

		const issues = captureIssues(bundle);
		expect(
			issues.some(({ message }) => message.includes("not present in the event")),
		).toBe(true);
		expect(
			issues.some(({ message }) => message.includes("missing map checkpoint")),
		).toBe(true);
		expect(
			issues.some(({ message }) => message.includes("no fallback transition")),
		).toBe(true);
	});

	it("validates bundle ownership, entry placement, and loaded document identity", () => {
		const missingEntryBundle = cloneBundle();
		(missingEntryBundle.manifest as ContentManifestV1).entryBundleId = "missing";
		expect(
			captureIssues(missingEntryBundle).some(({ message }) =>
				message.includes("does not exist"),
			),
		).toBe(true);

		const wrongEntryBundle = cloneBundle();
		(wrongEntryBundle.manifest as ContentManifestV1).entryBundleId = "relay-camp";
		expect(
			captureIssues(wrongEntryBundle).some(({ message }) =>
				message.includes("does not contain entry map"),
			),
		).toBe(true);

		const ownership = cloneBundle();
		const ownershipManifest = ownership.manifest as ContentManifestV1;
		ownershipManifest.bundles[1].maps.push({
			...ownershipManifest.bundles[0].maps[0],
		});
		ownershipManifest.bundles[1].maps.push({
			id: "extra-map",
			path: "maps/extra-map.json",
		});
		const ownershipIssues = captureIssues(ownership);
		expect(
			ownershipIssues.some(({ message }) => message.includes("exactly one bundle")),
		).toBe(true);
		expect(
			ownershipIssues.some(({ message }) =>
				message.includes("not declared in the manifest document list"),
			),
		).toBe(true);

		const identity = cloneBundle();
		(identity.maps[0].data as { id: string }).id = "wrong-map-id";
		(identity.events[0].data as { id: string }).id = "wrong-event-id";
		const identityIssues = captureIssues(identity);
		expect(
			identityIssues.filter(({ message }) => message.includes("bundled ID")),
		).toHaveLength(2);
	});

	it("aggregates missing progression and encounter references", () => {
		const bundle = cloneBundle();
		const manifest = bundle.manifest as ContentManifestV1;
		manifest.abilities[0].statusEffectId = "missing-status";
		manifest.characters[0].id = "missing-actor";
		manifest.characters[0].abilityUnlocks[0].abilityId = "missing-ability";
		manifest.characters[0].initialEquipment.weapon = "missing-equipment";
		manifest.items[0].statusIds = ["missing-status"];
		manifest.equipment[0].actorIds = ["missing-actor"];
		manifest.enemies[0].abilityIds = ["missing-ability"];
		manifest.enemies[0].aiPattern = ["missing-ability"];
		manifest.encounters[0].enemyIds = ["missing-enemy"];
		manifest.encounters[0].rewards.items[0].itemId = "missing-item";

		const messages = captureIssues(bundle).map(({ message }) => message);
		expect(messages.some((message) => message.includes("missing status effect"))).toBe(
			true,
		);
		expect(messages.some((message) => message.includes("no matching actor"))).toBe(
			true,
		);
		expect(messages.some((message) => message.includes("missing ability"))).toBe(
			true,
		);
		expect(messages.some((message) => message.includes("missing equipment"))).toBe(
			true,
		);
		expect(messages.some((message) => message.includes("missing enemy"))).toBe(
			true,
		);
		expect(messages.some((message) => message.includes("reward item"))).toBe(true);
	});

	it("validates existing map targets with missing entrances and checkpoints", () => {
		const bundle = cloneBundle();
		const manifest = bundle.manifest as ContentManifestV1;
		manifest.entryPoint.entranceId = "missing-entry";
		const map = bundle.maps[0].data as {
			triggers: Array<Record<string, any>>;
		};
		map.triggers.push({
			id: "bad-existing-map",
			kind: "map",
			position: { x: 3, y: 3 },
			targetId: "relay-camp",
			targetEntranceId: "missing-entry",
		});
		const event = bundle.events[0].data as { nodes: Array<Record<string, any>> };
		event.nodes.push(
			{
				id: "bad-map-node",
				type: "map.enter",
				mapId: "relay-camp",
				entranceId: "missing-entry",
			},
			{
				id: "bad-checkpoint-node",
				type: "checkpoint.reach",
				mapId: "signal-ruins",
				checkpointId: "missing-checkpoint",
				nextNodeId: event.nodes[0].id,
			},
		);
		const messages = captureIssues(bundle).map(({ message }) => message);
		expect(messages.some((message) => message.includes("Entry entrance"))).toBe(
			true,
		);
		expect(messages.some((message) => message.includes("missing entrance"))).toBe(
			true,
		);
		expect(
			messages.some((message) => message.includes("missing map entrance")),
		).toBe(true);
		expect(messages.some((message) => message.includes("missing map checkpoint"))).toBe(
			true,
		);
	});

	it("evaluates the complete condition vocabulary", () => {
		const current = {
			flags: { opened: true },
			relationships: { "mira:sol": 12 },
		};
		expect(evaluateContentCondition(undefined, current)).toBe(true);
		expect(
			evaluateContentCondition(
				{ type: "flag.equals", flagId: "constructor", value: false },
				current,
			),
		).toBe(true);
		expect(
			evaluateContentCondition(
				{ type: "flag.equals", flagId: "opened", value: true },
				current,
			),
		).toBe(true);
		expect(
			evaluateContentCondition(
				{ type: "relationship.gte", relationshipId: "mira:sol", value: 10 },
				current,
			),
		).toBe(true);
		expect(
			evaluateContentCondition(
				{ type: "relationship.lte", relationshipId: "mira:sol", value: 5 },
				current,
			),
		).toBe(false);
		expect(
			evaluateContentCondition(
				{ type: "relationship.gte", relationshipId: "mira:lune", value: 0 },
				current,
			),
		).toBe(true);
		expect(
			evaluateContentCondition(
				{ type: "relationship.lte", relationshipId: "mira:lune", value: 0 },
				current,
			),
		).toBe(true);
		expect(
			evaluateContentCondition(
				{
					type: "all",
					conditions: [
						{ type: "flag.equals", flagId: "opened", value: true },
						{
							type: "relationship.gte",
							relationshipId: "mira:sol",
							value: 10,
						},
					],
				},
				current,
			),
		).toBe(true);
		expect(
			evaluateContentCondition(
				{
					type: "any",
					conditions: [
						{ type: "flag.equals", flagId: "missing", value: true },
						{ type: "not", condition: { type: "flag.equals", flagId: "missing", value: true } },
					],
				},
				current,
			),
		).toBe(true);
	});
});
