import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render-with-providers";
import { GameView } from "./game-view";

const mocks = vi.hoisted(() => ({
	auth: {
		authUser: null as null | {
			email: string;
			displayName: string;
			role: string;
		},
		authLoading: false,
	},
}));

vi.mock("../auth-context", () => ({
	useAuth: () => mocks.auth,
}));

vi.mock("../game/GameLauncher", () => ({
	GameLauncher: () => <div data-testid="mock-game-screen">Game launcher</div>,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

beforeEach(() => {
	mocks.auth.authUser = null;
	mocks.auth.authLoading = false;
});

describe("GameView", () => {
	it("renders loading and anonymous states", () => {
		mocks.auth.authLoading = true;
		const view = renderWithProviders(<GameView />);
		expect(screen.getByText("Checking session...")).toBeVisible();

		mocks.auth.authLoading = false;
		view.rerender(<GameView />);
		expect(
			screen.getByRole("heading", { name: "Login required" }),
		).toBeVisible();
		expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute(
			"href",
			"/login",
		);
	});

	it("renders the game for an authenticated player", () => {
		mocks.auth.authUser = {
			email: "player@example.com",
			displayName: "Player",
			role: "member",
		};
		renderWithProviders(<GameView />);
		expect(screen.getByTestId("mock-game-screen")).toBeVisible();
		expect(screen.getByRole("link", { name: "Exit to home" })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.getByText("Player")).toBeVisible();
	});
});
