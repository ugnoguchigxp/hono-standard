import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createInitialGameState,
	type GameSession,
	type GameState,
} from "@shared/game";
import {
	gameSaveStorageKey,
	LocalGameSaveRepository,
} from "./save/LocalGameSaveRepository";
import { GameLauncher } from "./GameLauncher";

const mocks = vi.hoisted(() => ({
	latestSession: null as GameSession | null,
}));

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
							mapId: "signal-ruins",
							checkpoint: { x: 14, y: 5 },
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

beforeEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
	mocks.latestSession = null;
});

describe("GameLauncher", () => {
	it("starts a new game and writes the initial checkpoint", () => {
		render(<GameLauncher playerId="player@example.com" />);
		expect(screen.getByText("No checkpoint found.")).toBeVisible();
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "New Game" }));
		expect(screen.getByTestId("mock-game-screen")).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent(
			"Initial checkpoint saved.",
		);
		expect(
			window.localStorage.getItem(gameSaveStorageKey("player@example.com")),
		).not.toBeNull();
	});

	it("continues a saved checkpoint after remount", () => {
		const first = render(<GameLauncher playerId="player@example.com" />);
		fireEvent.click(screen.getByRole("button", { name: "New Game" }));
		fireEvent.click(screen.getByRole("button", { name: "Reach checkpoint" }));
		expect(screen.getByRole("status")).toHaveTextContent("Checkpoint saved.");
		first.unmount();

		render(<GameLauncher playerId="player@example.com" />);
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(mocks.latestSession?.snapshot().currentMap.checkpoint).toEqual({
			x: 14,
			y: 5,
		});
		expect(screen.getByRole("status")).toHaveTextContent("Checkpoint loaded.");
	});

	it("blocks a corrupt save and lets New Game recover it", () => {
		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			"not-json",
		);
		render(<GameLauncher playerId="player@example.com" />);
		expect(screen.getByRole("alert")).toHaveTextContent("not valid JSON");
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "New Game" }));
		expect(screen.getByTestId("mock-game-screen")).toBeVisible();
	});

	it("blocks an unsupported save format", () => {
		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			JSON.stringify({ formatVersion: 99 }),
		);
		render(<GameLauncher playerId="player@example.com" />);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Save format version 99 is not supported.",
		);
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
	});

	it("upgrades a legacy save before continuing", () => {
		const current = createInitialGameState();
		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			JSON.stringify({
				formatVersion: 0,
				savedAt: "2026-08-10T00:00:00.000Z",
				state: {
					schemaVersion: 1,
					mode: current.mode,
					currentMap: current.currentMap,
					party: current.party,
					story: current.story,
					battle: current.battle,
				},
			}),
		);
		render(<GameLauncher playerId="player@example.com" />);
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByRole("status")).toHaveTextContent(
			"Save upgraded and loaded.",
		);
	});

	it("shows write failures for new games and later checkpoints", () => {
		const save = vi
			.spyOn(LocalGameSaveRepository.prototype, "save")
			.mockReturnValueOnce({
				ok: false,
				message: "Could not write the local autosave.",
			})
			.mockReturnValueOnce({
				ok: false,
				message: "Could not write the local autosave.",
			});
		render(<GameLauncher playerId="player@example.com" />);
		fireEvent.click(screen.getByRole("button", { name: "New Game" }));
		expect(screen.getByRole("status")).toHaveTextContent(
			"Could not write the local autosave.",
		);
		fireEvent.click(screen.getByRole("button", { name: "Reach checkpoint" }));
		expect(save).toHaveBeenCalledTimes(2);
		expect(screen.getByRole("status")).toHaveTextContent(
			"Could not write the local autosave.",
		);
	});

	it("shows a failed legacy upgrade without blocking play", () => {
		const current = createInitialGameState();
		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			JSON.stringify({
				formatVersion: 0,
				savedAt: "2026-08-10T00:00:00.000Z",
				state: {
					schemaVersion: 1,
					mode: current.mode,
					currentMap: current.currentMap,
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
		render(<GameLauncher playerId="player@example.com" />);
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByTestId("mock-game-screen")).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent(
			"Could not write the local autosave.",
		);
	});

	it("reports browser storage read failures", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("storage disabled");
		});
		render(<GameLauncher playerId="player@example.com" />);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Browser storage is unavailable.",
		);
	});
});
