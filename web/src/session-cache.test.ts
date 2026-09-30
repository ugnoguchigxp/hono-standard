import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import {
	authMeQueryKey,
	fetchMe,
	fetchPages,
	fetchProtectedProfile,
	protectedProfileQueryKey,
	setSessionUser,
} from "./api";

afterEach(() => vi.unstubAllGlobals());

it("removes the old user's private data and cancels responses that arrive after a session change", async () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const alice = {
		id: "alice",
		email: "alice@example.com",
		displayName: "Alice",
		role: "member" as const,
	};
	const bob = { ...alice, id: "bob", email: "bob@example.com" };
	const profileKey = [...protectedProfileQueryKey, alice.id];
	const pagesKey = ["pages", alice.id, "list"] as const;
	client.setQueryData(authMeQueryKey, alice);
	client.setQueryData(profileKey, { email: alice.email, role: alice.role });
	client.setQueryData(pagesKey, [
		{
			id: "page-1",
			parentId: null,
			title: "Alice Page",
			createdAt: "2026-09-30T00:00:00.000Z",
			updatedAt: "2026-09-30T00:00:00.000Z",
		},
	]);
	const releases: Array<(response: Response) => void> = [];
	const signals: AbortSignal[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn((_input, init) => {
			signals.push(init.signal);
			return new Promise<Response>((resolve) => releases.push(resolve));
		}),
	);
	const requests = [
		client.fetchQuery({ queryKey: authMeQueryKey, queryFn: fetchMe }),
		client.fetchQuery({ queryKey: profileKey, queryFn: fetchProtectedProfile }),
		client.fetchQuery({
			queryKey: pagesKey,
			queryFn: ({ signal }) => fetchPages({ signal }),
		}),
	].map((request) => request.catch(() => undefined));
	await setSessionUser(client, bob);
	expect(signals).toHaveLength(3);
	expect(signals.every((signal) => signal.aborted)).toBe(true);
	for (const release of releases)
		release(
			Response.json({
				user: alice,
				profile: { email: alice.email, role: alice.role },
			}),
		);
	await Promise.all(requests);
	expect(client.getQueryData(authMeQueryKey)).toEqual(bob);
	expect(client.getQueryData(profileKey)).toBeUndefined();
	expect(client.getQueryData(pagesKey)).toBeUndefined();
	expect(
		client.getQueryData([...protectedProfileQueryKey, bob.id]),
	).toBeUndefined();
	client.clear();
});
