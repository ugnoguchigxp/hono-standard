import { afterEach, expect, it, vi } from "vitest";

function installBrowserLock() {
	let tail: Promise<unknown> = Promise.resolve();
	const request = vi.fn((_name: string, operation: () => Promise<unknown>) => {
		const next = tail.then(operation);
		tail = next.catch(() => undefined);
		return next;
	});
	vi.stubGlobal("window", { location: { origin: "https://example.test" } });
	vi.stubGlobal("navigator", { locks: { request } });
	return request;
}

const session = {
	id: "test",
	email: "test@example.com",
	displayName: "Test",
	role: "member",
};
const unauthorized = () =>
	Response.json({ message: "Unauthorized" }, { status: 401 });

afterEach(() => vi.unstubAllGlobals());

it("coordinates independent tab clients and reuses the session restored by the first tab", async () => {
	installBrowserLock();
	vi.resetModules();
	const first = await import("./api");
	vi.resetModules();
	const second = await import("./api");
	let restored = false;
	let rotations = 0;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input) => {
			if (String(input).endsWith("/refresh")) {
				rotations++;
				restored = true;
				return Response.json({ user: session });
			}
			return restored ? Response.json({ user: session }) : unauthorized();
		}),
	);
	await expect(
		Promise.all([first.fetchMe(), second.fetchMe()]),
	).resolves.toEqual([session, session]);
	expect(rotations).toBe(1);
});

it("does not turn a session probe or refresh server failure into logout", async () => {
	installBrowserLock();
	const { fetchMe } = await import("./api");
	const unavailable = () =>
		Response.json({ message: "Service unavailable" }, { status: 503 });
	const fetchMock = vi
		.fn()
		.mockResolvedValueOnce(unauthorized())
		.mockResolvedValueOnce(unavailable());
	vi.stubGlobal("fetch", fetchMock);
	await expect(fetchMe()).rejects.toThrow("Service unavailable");
	fetchMock
		.mockResolvedValueOnce(unauthorized())
		.mockResolvedValueOnce(unauthorized())
		.mockResolvedValueOnce(unavailable());
	await expect(fetchMe()).rejects.toThrow("Service unavailable");
});

it("requires sign-in instead of rotating without a browser-wide lock", async () => {
	vi.stubGlobal("window", { location: { origin: "http://insecure.test" } });
	vi.stubGlobal("navigator", {});
	const fetchMock = vi.fn(async () => unauthorized());
	vi.stubGlobal("fetch", fetchMock);
	const { fetchMe } = await import("./api");
	await expect(fetchMe()).resolves.toBeNull();
	expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("does not clear a newer session when a cancelled request's refresh is rejected", async () => {
	installBrowserLock();
	const dispatchEvent = vi.fn();
	vi.stubGlobal("window", {
		location: { origin: "https://example.test" },
		dispatchEvent,
	});
	const controller = new AbortController();
	let release: (response: Response) => void = () => {};
	let refreshing = false;
	const pending = new Promise<Response>((resolve) => {
		release = resolve;
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input) => {
			if (String(input).endsWith("/refresh")) {
				refreshing = true;
				return pending;
			}
			return unauthorized();
		}),
	);
	const { fetchProtectedProfile } = await import("./api");
	const request = fetchProtectedProfile({ signal: controller.signal });
	const rejected = expect(request).rejects.toMatchObject({
		name: "AbortError",
	});
	await vi.waitFor(() => expect(refreshing).toBe(true));
	controller.abort();
	release(unauthorized());
	await rejected;
	expect(dispatchEvent).not.toHaveBeenCalled();
});
