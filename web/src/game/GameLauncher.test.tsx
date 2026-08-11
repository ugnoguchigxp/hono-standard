import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createInitialGameState,
	type GameSession,
	type GameState,
} from "@shared/game";
import { validateGameContentDirectory } from "../../../scripts/validate-game-content";
import { GameLauncher } from "./GameLauncher";
import {
	ContentLoadError,
	GameContentLoader,
} from "./content/GameContentLoader";
import {
	gameSaveStorageKey,
	LocalGameSaveRepository,
} from "./save/LocalGameSaveRepository";

const registry = validateGameContentDirectory();
const mocks = vi.hoisted(() => ({ latestSession: null as GameSession | null }));

vi.mock("./GameScreen", () => ({
	GameScreen: ({
		session,
		onAutosave,
	}: {
		session: GameSession;
		onAutosave: (state: GameState) => void;
	}) => {
		mocks.latestSession = session;
		return (
			<div data-testid="mock-game-screen">
				<button
					type="button"
					onClick={() => {
						const transition = session.dispatch({
							type: "checkpoint.reached",
							checkpointId: "signal-core",
						});
						onAutosave(transition.state);
					}}
				>
					Reach checkpoint
				</button>
			</div>
		);
	},
}));

const readyLoader = () => {
	const loader = new GameContentLoader();
	vi.spyOn(loader, "load").mockResolvedValue(registry);
	vi.spyOn(loader, "reset").mockImplementation(() => undefined);
	return loader;
};

const renderReadyLauncher = async () => {
	const loader = readyLoader();
	render(<GameLauncher playerId="player@example.com" contentLoader={loader} />);
	await screen.findByRole("heading", { name: "The signal is waiting." });
	return loader;
};

beforeEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
	mocks.latestSession = null;
});

describe("GameLauncher", () => {
	it("uses the default browser content loader", async () => {
		vi.spyOn(GameContentLoader.prototype, "load").mockResolvedValue(registry);
		render(<GameLauncher playerId="default-loader@example.com" />);
		expect(
			await screen.findByRole("button", { name: "New Game" }),
		).toBeVisible();
	});

	it("shows world loading before enabling the launcher", async () => {
		let resolveLoad: ((value: typeof registry) => void) | undefined;
		const loader = new GameContentLoader();
		vi.spyOn(loader, "load").mockReturnValue(
			new Promise((resolve) => {
				resolveLoad = resolve;
			}),
		);
		render(
			<GameLauncher playerId="player@example.com" contentLoader={loader} />,
		);
		expect(
			screen.getByRole("heading", { name: "Loading world…" }),
		).toBeVisible();
		expect(screen.queryByRole("button", { name: "New Game" })).toBeNull();
		resolveLoad?.(registry);
		await screen.findByRole("button", { name: "New Game" });
	});

	it("starts a new game and writes the initial checkpoint", async () => {
		await renderReadyLauncher();
		expect(screen.getByText("No checkpoint found.")).toBeVisible();
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "New Game" }));
		expect(screen.getByTestId("mock-game-screen")).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent(
			"Initial checkpoint saved.",
		);
		expect(mocks.latestSession?.content).toBe(registry);
		expect(
			window.localStorage.getItem(gameSaveStorageKey("player@example.com")),
		).not.toBeNull();
	});

	it("continues a saved checkpoint after remount", async () => {
		const first = render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByRole("button", { name: "New Game" });
		fireEvent.click(screen.getByRole("button", { name: "New Game" }));
		fireEvent.click(screen.getByRole("button", { name: "Reach checkpoint" }));
		expect(screen.getByRole("status")).toHaveTextContent("Checkpoint saved.");
		first.unmount();

		render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
		expect(mocks.latestSession?.snapshot().location.checkpointId).toBe(
			"signal-core",
		);
		expect(screen.getByRole("status")).toHaveTextContent("Checkpoint loaded.");
	});

	it("blocks corrupt, unsupported, and incompatible saves", async () => {
		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			"not-json",
		);
		const corrupt = render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByRole("heading", { name: "The signal is waiting." });
		expect(screen.getByRole("alert")).toHaveTextContent("not valid JSON");
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
		corrupt.unmount();

		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			JSON.stringify({ formatVersion: 99 }),
		);
		const unsupported = render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Save format version 99 is not supported.",
		);
		unsupported.unmount();

		const state = createInitialGameState({ registry });
		state.contentVersion = "different-world";
		new LocalGameSaveRepository(
			window.localStorage,
			"incompatible@example.com",
		).save(state);
		const incompatibleView = render(
			<GameLauncher
				playerId="incompatible@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByText(/different world version/i);
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
		incompatibleView.unmount();

		const missingMapState = createInitialGameState({ registry });
		missingMapState.location.mapId = "removed-map";
		const missingMapRepository = new LocalGameSaveRepository(
			window.localStorage,
			"missing-map@example.com",
		);
		expect(missingMapRepository.save(missingMapState).ok).toBe(true);
		render(
			<GameLauncher
				playerId="missing-map@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByText(/world data that is no longer available/i);
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
		expect(missingMapRepository.load().status).toBe("ready");
	});

	it("upgrades a legacy save before continuing", async () => {
		const current = createInitialGameState({ registry });
		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			JSON.stringify({
				formatVersion: 0,
				savedAt: "2026-08-10T00:00:00.000Z",
				state: {
					schemaVersion: 1,
					mode: current.mode,
					currentMap: {
						id: "signal-ruins",
						checkpoint: { x: 3, y: 6 },
					},
					party: current.party,
					story: current.story,
					battle: current.battle,
				},
			}),
		);
		await renderReadyLauncher();
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByRole("status")).toHaveTextContent(
			"Save upgraded and loaded.",
		);
	});

	it("retries a player-facing content failure", async () => {
		const loader = new GameContentLoader();
		const load = vi
			.spyOn(loader, "load")
			.mockRejectedValueOnce(
				new ContentLoadError("http", "World request failed."),
			)
			.mockResolvedValueOnce(registry);
		const reset = vi.spyOn(loader, "reset").mockImplementation(() => undefined);
		render(
			<GameLauncher playerId="player@example.com" contentLoader={loader} />,
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"World request failed.",
		);
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		await screen.findByRole("button", { name: "New Game" });
		expect(reset).toHaveBeenCalledOnce();
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("normalizes an unexpected loader error for players", async () => {
		const loader = new GameContentLoader();
		vi.spyOn(loader, "load").mockRejectedValue(new Error("internal details"));
		render(
			<GameLauncher playerId="unexpected@example.com" contentLoader={loader} />,
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"The world could not be reached.",
		);
		expect(screen.queryByText("internal details")).toBeNull();
	});

	it("reports a failed legacy upgrade while still continuing", async () => {
		const current = createInitialGameState({ registry });
		window.localStorage.setItem(
			gameSaveStorageKey("upgrade-failure@example.com"),
			JSON.stringify({
				formatVersion: 0,
				savedAt: "2026-08-10T00:00:00.000Z",
				state: {
					schemaVersion: 1,
					mode: current.mode,
					currentMap: {
						id: "signal-ruins",
						checkpoint: { x: 3, y: 6 },
					},
					party: current.party,
					story: current.story,
					battle: current.battle,
				},
			}),
		);
		vi.spyOn(LocalGameSaveRepository.prototype, "save").mockReturnValue({
			ok: false,
			message: "Could not write the local autosave.",
		});
		render(
			<GameLauncher
				playerId="upgrade-failure@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
		expect(screen.getByTestId("mock-game-screen")).toBeVisible();
		expect(
			screen.getByText("Could not write the local autosave."),
		).toBeVisible();
	});

	it("shows storage read and write failures without blocking play", async () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("storage disabled");
		});
		const readFailure = render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByRole("heading", { name: "The signal is waiting." });
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Browser storage is unavailable.",
		);
		readFailure.unmount();

		vi.restoreAllMocks();
		const save = vi
			.spyOn(LocalGameSaveRepository.prototype, "save")
			.mockReturnValue({
				ok: false,
				message: "Could not write the local autosave.",
			});
		const view = render(
			<GameLauncher
				playerId="write@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "New Game" }));
		expect(
			screen.getByText("Could not write the local autosave."),
		).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: "Reach checkpoint" }));
		expect(save).toHaveBeenCalledTimes(2);
		view.unmount();
	});
});
