import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render-with-providers";
import Action3dView from "./Action3dView";

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

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

beforeEach(() => {
	mocks.auth.authUser = null;
	mocks.auth.authLoading = false;
});

describe("Action3dView", () => {
	it("renders loading and login-required states", () => {
		mocks.auth.authLoading = true;
		const view = renderWithProviders(<Action3dView />);
		expect(screen.getByRole("status")).toHaveTextContent(
			"Preparing Action3D session",
		);

		mocks.auth.authLoading = false;
		view.rerender(<Action3dView />);
		expect(
			screen.getByRole("heading", { name: "Login required" }),
		).toBeVisible();
		expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute(
			"href",
			"/login",
		);
	});

	it("renders the independent Action3D launcher for an authenticated user", () => {
		mocks.auth.authUser = {
			email: "user@example.com",
			displayName: "Test User",
			role: "member",
		};
		renderWithProviders(<Action3dView />);

		expect(
			screen.getByRole("heading", { name: "Action3D Field Lab" }),
		).toBeVisible();
		expect(screen.getByRole("main")).toHaveAttribute(
			"data-game-id",
			"action-3d",
		);
		expect(
			screen.getByRole("link", { name: "Open the 2D RPG" }),
		).toHaveAttribute("href", "/game");
	});
});
