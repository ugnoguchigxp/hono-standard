import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { router } from "./router";

describe("app shell", () => {
	beforeEach(async () => {
		await router.navigate({ to: "/" });
	});

	it("renders the authless home route", async () => {
		render(<App />);

		expect(
			await screen.findByRole("heading", { name: "Welcome to Hono Standard" }),
		).toBeVisible();
	});
});
