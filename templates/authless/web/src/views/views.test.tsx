import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/render-with-providers";
import { HomeView } from "./home-view";

describe("HomeView", () => {
	it("describes the authless baseline", () => {
		renderWithProviders(<HomeView />);
		expect(
			screen.getByRole("heading", { name: "Welcome to Hono Standard" }),
		).toBeVisible();
		expect(screen.getByText(/authless profile/)).toBeVisible();
	});
});
