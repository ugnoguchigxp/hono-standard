import {
	createBattleStateFromEncounter,
	createInitialGameState,
	simulateBattle,
} from "../shared/game";
import { validateGameContentDirectory } from "./validate-game-content";

const registry = validateGameContentDirectory();
const initialState = createInitialGameState({ registry, rngSeed: 42 });
const reports = registry.encounterIds.map((encounterId) => {
	const result = simulateBattle(
		createBattleStateFromEncounter(
			registry,
			encounterId,
			initialState.party.members,
			initialState.party.inventory,
		),
	);
	return {
		encounterId,
		result: result.state.phase,
		commands: result.commands,
		ticks: result.ticks,
		stalled: result.stalled,
		partyHp: Object.fromEntries(
			result.state.party.map(({ id, hp }) => [id, hp]),
		),
	};
});

const invalid = reports.filter(
	({ result, stalled }) => stalled || !["victory", "defeat"].includes(result),
);
for (const report of reports) console.log(JSON.stringify(report));
if (invalid.length > 0) {
	console.error(
		`Battle balance validation failed for: ${invalid
			.map(({ encounterId }) => encounterId)
			.join(", ")}`,
	);
	process.exit(1);
}
console.log(`OK battle balance: ${reports.length} encounters completed`);
