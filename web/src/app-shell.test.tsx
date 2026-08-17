import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, createAppQueryClient } from "./App";
import { router } from "./router";

const user = {
	id: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
	email: "user@example.com",
	displayName: "Test User",
	role: "member",
};

const getRequestPath = (input: RequestInfo | URL): string => {
	if (input instanceof Request) return new URL(input.url).pathname;
	return new URL(input.toString(), "http://localhost").pathname;
};

describe("app shell and routes", () => {
	beforeEach(async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const path = getRequestPath(input);
				if (path === "/api/auth/me") {
					return new Response(JSON.stringify({ message: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (path === "/api/auth/logout") {
					return Response.json({ success: true });
				}
				if (path === "/api/protected/profile") {
					return Response.json({
						profile: { email: user.email, role: user.role },
					});
				}
				return new Response("not found", { status: 404 });
			}),
		);
		await router.navigate({ to: "/" });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders public routes through the composed router", async () => {
		const view = userEvent.setup();
		render(<App queryClient={createAppQueryClient()} />);

		expect(
			await screen.findByRole("heading", { name: "Welcome to Hono Standard" }),
		).toBeVisible();

		await view.click(screen.getByRole("link", { name: "Login" }));
		expect(
			await screen.findByRole("heading", { name: "Hono Standard" }),
		).toBeVisible();
		expect(screen.getByLabelText("Email")).toBeVisible();

		await view.click(screen.getByRole("link", { name: "Home" }));
		await view.click(screen.getByRole("link", { name: "Showcase" }));
		expect(
			await screen.findByRole("heading", { name: "Component Showcase" }),
		).toBeVisible();
	});

	it("shows the protected login gate and signs out from the shell", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const path = getRequestPath(input);
			if (path === "/api/auth/me") {
				return Response.json({ user });
			}
			if (path === "/api/protected/profile") {
				return Response.json({
					profile: { email: user.email, role: user.role },
				});
			}
			if (path === "/api/auth/logout") {
				return Response.json({ success: true });
			}
			return new Response("not found", { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const view = userEvent.setup();
		render(<App queryClient={createAppQueryClient()} />);
		await router.navigate({ to: "/protected" });

		expect(
			await screen.findByRole("heading", { name: "Protected route" }),
		).toBeVisible();
		expect(
			within(screen.getByRole("banner")).getByText("Test User (member)"),
		).toBeVisible();

		await view.click(screen.getByRole("button", { name: "Logout" }));
		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Login required" }),
			).toBeVisible();
		});
	});

	it("surfaces session load errors in the shell", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const path = getRequestPath(input);
				if (path === "/api/auth/me") {
					return Response.json(
						{ message: "session store unavailable" },
						{ status: 500 },
					);
				}
				return new Response("not found", { status: 404 });
			}),
		);

		render(<App queryClient={createAppQueryClient()} />);
		await router.navigate({ to: "/login" });

		expect(await screen.findByText("session store unavailable")).toBeVisible();
	});
});
