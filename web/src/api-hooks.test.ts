import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	setQueryData: vi.fn(),
	cancelQueries: vi.fn().mockResolvedValue(undefined),
	removeQueries: vi.fn(),
	invalidateQueries: vi.fn().mockResolvedValue(undefined),
	useMutation: vi.fn((options) => options),
	useQuery: vi.fn((options) => options),
	useQueryClient: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: mocks.useMutation,
	useQuery: mocks.useQuery,
	useQueryClient: mocks.useQueryClient,
}));

vi.mock("react", () => ({ useRef: (value: unknown) => ({ current: value }) }));

import {
	useUpdatePageTitleMutation,
	authMeQueryKey,
	fetchMe,
	fetchProtectedProfile,
	protectedProfileQueryKey,
	useCurrentUserQuery,
	useLoginMutation,
	useLogoutMutation,
	useProtectedProfileQuery,
	useDuplicatePageMutation,
	setSessionUser,
	useUpdatePageContentMutation,
	useMovePageMutation,
} from "./api";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.useQueryClient.mockReturnValue({
		setQueryData: mocks.setQueryData,
		cancelQueries: mocks.cancelQueries,
		removeQueries: mocks.removeQueries,
		invalidateQueries: mocks.invalidateQueries,
	});
});

describe("web API hooks", () => {
	it("configures current-user and protected-profile queries", () => {
		useCurrentUserQuery(false);
		useProtectedProfileQuery("user-id");

		expect(mocks.useQuery).toHaveBeenNthCalledWith(1, {
			queryKey: authMeQueryKey,
			queryFn: fetchMe,
			enabled: false,
		});
		expect(mocks.useQuery).toHaveBeenNthCalledWith(2, {
			queryKey: [...protectedProfileQueryKey, "user-id"],
			queryFn: fetchProtectedProfile,
			enabled: true,
		});
	});

	it("updates the current-user cache before the login callback", async () => {
		const onSuccess = vi.fn();
		const response = {
			user: {
				id: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
				email: "test@example.com",
				displayName: "Test User",
				role: "member",
			},
		};
		const variables = {
			email: response.user.email,
			password: "password123456",
		};

		useLoginMutation({ onSuccess });
		const options = mocks.useMutation.mock.calls[0]?.[0];
		await options.onSuccess(response, variables, undefined, {});

		expect(mocks.setQueryData).toHaveBeenCalledWith(
			authMeQueryKey,
			response.user,
		);
		expect(onSuccess).toHaveBeenCalledWith(response, variables, undefined, {});
	});

	it("clears the current-user cache before the logout callback", async () => {
		const onSuccess = vi.fn();

		useLogoutMutation({ onSuccess });
		const options = mocks.useMutation.mock.calls[0]?.[0];
		await options.onSuccess(undefined, undefined, undefined, {});

		expect(mocks.setQueryData).toHaveBeenCalledWith(authMeQueryKey, null);
		expect(onSuccess).toHaveBeenCalledWith(undefined, undefined, undefined, {});
	});

	it("writes only the confirmed save response into page caches", async () => {
		useUpdatePageContentMutation("user-1", "page-1");
		const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
			networkMode: string;
			onSuccess: (
				body: {
					content: { revision: number; value: unknown };
					page: { id: string; updatedAt: string };
				},
				input?: unknown,
				epoch?: number,
			) => Promise<void>;
		};
		expect(options.networkMode).toBe("always");
		const current = {
			page: {
				id: "page-1",
				ownerId: "user-1",
				parentId: null,
				title: "A",
				createdAt: "2026-09-30T00:00:00.000Z",
				updatedAt: "2026-09-30T00:00:00.000Z",
			},
			content: {
				revision: 0,
				value: [{ type: "p", children: [{ text: "draft" }] }],
			},
		};
		const saved = {
			revision: 1,
			value: [{ type: "p", children: [{ text: "saved" }] }],
		};
		const savedAt = "2026-10-01T00:00:00.000Z";

		await options.onSuccess({
			content: saved,
			page: { id: "page-1", updatedAt: savedAt },
		});

		expect(mocks.cancelQueries).toHaveBeenCalledWith({
			queryKey: ["pages", "user-1", "detail", "page-1"],
		});
		expect(mocks.cancelQueries).toHaveBeenCalledWith({
			queryKey: ["pages", "user-1", "list"],
		});
		expect(mocks.setQueryData).toHaveBeenCalledWith(
			["pages", "user-1", "detail", "page-1"],
			expect.any(Function),
		);
		const updater = mocks.setQueryData.mock.calls[0]?.[1] as (
			value: typeof current | undefined,
		) => unknown;
		expect(updater(current)).toEqual({
			...current,
			page: { ...current.page, updatedAt: savedAt },
			content: saved,
		});
		expect(updater(undefined)).toBeUndefined();
		const newer = {
			...current,
			content: {
				revision: 3,
				value: [{ type: "p", children: [{ text: "newer" }] }],
			},
		};
		expect(updater(newer)).toBe(newer);
		const listUpdater = mocks.setQueryData.mock.calls[1]?.[1] as (
			value: (typeof current.page)[] | undefined,
		) => unknown;
		expect(listUpdater([current.page])).toEqual([
			{ ...current.page, updatedAt: savedAt },
		]);
		expect(listUpdater(undefined)).toBeUndefined();

		mocks.setQueryData.mockClear();
		await options.onSuccess(
			{ content: saved, page: { id: "page-1", updatedAt: savedAt } },
			undefined,
			1,
		);
		expect(mocks.setQueryData).not.toHaveBeenCalled();
	});

	it("updates only parentId after a move and ignores a response from an old session", async () => {
		const queryClient = {
			cancelQueries: mocks.cancelQueries,
			setQueryData: mocks.setQueryData,
			invalidateQueries: mocks.invalidateQueries,
			removeQueries: mocks.removeQueries,
		};
		mocks.useQueryClient.mockReturnValue(queryClient);
		useMovePageMutation("user-1", "page-1");
		const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
			retry: boolean;
			onMutate: () => number;
			onSuccess: (
				body: { page: { parentId: string | null } },
				input: unknown,
				epoch: number,
			) => Promise<void>;
		};
		expect(options.retry).toBe(false);
		const epoch = options.onMutate();
		const response = { page: { parentId: "parent-2" } };
		await options.onSuccess(response, undefined, epoch);
		expect(mocks.setQueryData).toHaveBeenCalledWith(
			["pages", "user-1", "detail", "page-1"],
			expect.any(Function),
		);
		expect(mocks.setQueryData).toHaveBeenCalledWith(
			["pages", "user-1", "list"],
			expect.any(Function),
		);
		const detailUpdater = mocks.setQueryData.mock.calls[0]?.[1] as (
			value: unknown,
		) => unknown;
		const current = {
			page: { id: "page-1", title: "Kept title", parentId: "old" },
			content: { revision: 4, value: [{ type: "p" }] },
		};
		expect(detailUpdater(current)).toEqual({
			...current,
			page: { ...current.page, parentId: "parent-2" },
		});
		expect(detailUpdater(undefined)).toBeUndefined();
		const listUpdater = mocks.setQueryData.mock.calls[1]?.[1] as (
			value: unknown,
		) => unknown;
		expect(listUpdater(undefined)).toBeUndefined();
		expect(
			listUpdater([current.page, { id: "other", parentId: null }]),
		).toEqual([
			{ ...current.page, parentId: "parent-2" },
			{ id: "other", parentId: null },
		]);

		mocks.setQueryData.mockClear();
		await setSessionUser(queryClient as never, null);
		await options.onSuccess(response, undefined, epoch);
		expect(mocks.setQueryData).toHaveBeenCalledTimes(1);
		expect(mocks.setQueryData).toHaveBeenCalledWith(authMeQueryKey, null);
	});

	it("does not invalidate the new session list after an old duplicate response", async () => {
		const queryClient = {
			setQueryData: mocks.setQueryData,
			cancelQueries: mocks.cancelQueries,
			removeQueries: mocks.removeQueries,
			invalidateQueries: vi.fn().mockResolvedValue(undefined),
		};
		mocks.useQueryClient.mockReturnValue(queryClient);
		useDuplicatePageMutation("old-user");
		const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
			retry: boolean;
			onMutate: () => number;
			onSuccess: (
				body: unknown,
				variables: unknown,
				epoch: number,
			) => Promise<void>;
		};
		expect(options.retry).toBe(false);
		const epoch = options.onMutate();
		await setSessionUser(queryClient as never, {
			id: "new-user",
			email: "new@example.com",
			displayName: "New",
			role: "member",
		});
		await options.onSuccess({ page: { id: "created" } }, {}, epoch);
		expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
	});
});

it("rejects title writes and cancellations after session replacement", async () => {
	const client = {
		setQueryData: mocks.setQueryData,
		cancelQueries: mocks.cancelQueries,
		removeQueries: mocks.removeQueries,
		invalidateQueries: mocks.invalidateQueries,
	};
	mocks.useQueryClient.mockReturnValue(client);
	useUpdatePageTitleMutation("owner", "page");
	const options = mocks.useMutation.mock.calls.at(-1)?.[0];
	await setSessionUser(client as never, null);
	expect(() => options.mutationFn({ title: "draft" })).toThrow(
		"Session changed",
	);
	await expect(options.onMutate()).rejects.toThrow("Session changed");
});
it("checks the session again after pending title query cancellation", async () => {
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const cancel = vi
		.fn()
		.mockResolvedValue(undefined)
		.mockImplementationOnce(() => gate);
	const client = {
		setQueryData: mocks.setQueryData,
		cancelQueries: cancel,
		removeQueries: mocks.removeQueries,
		invalidateQueries: mocks.invalidateQueries,
	};
	mocks.useQueryClient.mockReturnValue(client);
	useUpdatePageTitleMutation("owner", "page");
	const options = mocks.useMutation.mock.calls.at(-1)?.[0];
	const pending = options.onMutate();
	await setSessionUser(client as never, null);
	release();
	await expect(pending).rejects.toThrow("Session changed");
});

it("does not update move caches when the session changes during query cancellation", async () => {
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const cancel = vi
		.fn()
		.mockResolvedValue(undefined)
		.mockImplementationOnce(() => gate);
	const client = {
		setQueryData: mocks.setQueryData,
		cancelQueries: cancel,
		removeQueries: mocks.removeQueries,
		invalidateQueries: mocks.invalidateQueries,
	};
	mocks.useQueryClient.mockReturnValue(client);
	useMovePageMutation("owner", "page");
	const options = mocks.useMutation.mock.calls.at(-1)?.[0];
	const epoch = options.onMutate();
	const pending = options.onSuccess(
		{ page: { parentId: null } },
		undefined,
		epoch,
	);
	await setSessionUser(client as never, null);
	mocks.setQueryData.mockClear();
	release();
	await pending;
	expect(mocks.setQueryData).not.toHaveBeenCalled();
});
