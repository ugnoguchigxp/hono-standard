import type { AppType } from "@api/app/hono";
import type {
	AuthResponse,
	AuthSessionUser,
	LoginInput,
	LogoutResponse,
} from "@shared/schemas/auth.schema";
import type {
	UpdatePageContentInput,
	UpdatePageContentResponse,
} from "@shared/schemas/page-content.schema";
import {
	createPageResponseSchema,
	duplicateRequestConflictResponseSchema,
	duplicatedPageUnavailableResponseSchema,
	sourcePageChangedResponseSchema,
} from "../../shared/schemas/pages.schema";
import type {
	DuplicatePageInput,
	GetPageResponse,
	ListPagesResponse,
	MovePageInput,
	Page,
	PageSummary,
	UpdatePageTitleInput,
	UpdatePageResponse,
} from "@shared/schemas/pages.schema";
import {
	pageParentConflictResponseSchema,
	invalidPageHierarchyResponseSchema,
} from "../../shared/schemas/pages.schema";
import type { ProtectedProfileResponse } from "@shared/schemas/protected.schema";
import {
	type QueryClient,
	type UseMutationOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useRef } from "react";
import { hc } from "hono/client";

export type AuthUser = AuthSessionUser;
export type LoginParams = LoginInput & {
	redirectTo?: string;
};
export type LoginResponse = AuthResponse;

export const UNAUTHORIZED_EVENT_NAME = "hono-standard:unauthorized";
export const authMeQueryKey = ["auth", "me"] as const;
export const protectedProfileQueryKey = ["protected", "profile"] as const;

type LoginMutationOptions = Omit<
	UseMutationOptions<LoginResponse, Error, LoginParams>,
	"mutationFn"
>;

type LogoutMutationOptions = Omit<
	UseMutationOptions<void, Error, void>,
	"mutationFn"
>;

let lastUnauthorizedEventAt = 0;

const notifyUnauthorized = () => {
	if (typeof window === "undefined") return;
	const now = Date.now();
	if (now - lastUnauthorizedEventAt < 500) return;
	lastUnauthorizedEventAt = now;
	window.dispatchEvent(new Event(UNAUTHORIZED_EVENT_NAME));
};

const getRequestPath = (input: RequestInfo | URL): string => {
	const url =
		input instanceof Request
			? input.url
			: input instanceof URL
				? input.href
				: input.toString();
	const base =
		typeof window === "undefined" ? "http://localhost" : window.location.origin;
	return new URL(url, base).pathname;
};

const isAuthPath = (path: string): boolean => path.startsWith("/api/auth/");

const canRetryWithRefresh = (path: string): boolean =>
	path === "/api/auth/me" || !isAuthPath(path);

let refreshPromise: Promise<boolean> | undefined;
let sessionVersion = 0;

const browserLocks = () =>
	typeof window === "undefined" ? undefined : globalThis.navigator?.locks;

async function withSessionLock<T>(operation: () => Promise<T>): Promise<T> {
	const locks = browserLocks();
	return locks
		? await locks.request("hono-standard:session", operation)
		: await operation();
}

function refreshSession(): Promise<boolean> {
	// Without a cross-tab lock, require sign-in instead of racing token rotation.
	if (typeof window !== "undefined" && !browserLocks()) {
		return Promise.resolve(false);
	}
	if (!refreshPromise) {
		refreshPromise = withSessionLock(async () => {
			if (browserLocks()) {
				// A different tab may have restored the cookie while we waited.
				const current = await fetch("/api/auth/me", {
					credentials: "include",
				});
				if (current.ok) return true;
				if (current.status !== 401) {
					throw new Error(await parseErrorMessage(current));
				}
			}
			const response = await fetch("/api/auth/refresh", {
				method: "POST",
				credentials: "include",
			});
			if (!response.ok && response.status !== 401) {
				throw new Error(await parseErrorMessage(response));
			}
			return response.ok;
		})
			.then((restored) => {
				if (restored) sessionVersion += 1;
				return restored;
			})
			.finally(() => {
				refreshPromise = undefined;
			});
	}
	return refreshPromise;
}

const shouldNotifyUnauthorized = (path: string): boolean => !isAuthPath(path);

const parseErrorMessage = async (response: Response): Promise<string> => {
	let message = `Request failed: ${response.status}`;
	try {
		const data = (await response.json()) as { message?: string };
		if (data.message) message = data.message;
	} catch {
		// Non-JSON error responses keep the status-derived message.
	}
	return message;
};

const customFetch = async (
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> => {
	const headers = new Headers(init?.headers);
	const requestPath = getRequestPath(input);

	const execute = () =>
		fetch(input, {
			...init,
			headers,
			credentials: "include",
		});

	const requestSessionVersion = sessionVersion;
	let response = await execute();
	init?.signal?.throwIfAborted();
	if (response.status === 401 && canRetryWithRefresh(requestPath)) {
		// Share rotation across concurrent requests, including late 401 responses.
		if (requestSessionVersion !== sessionVersion || (await refreshSession())) {
			init?.signal?.throwIfAborted();
			response = await execute();
		}
	}
	init?.signal?.throwIfAborted();

	if (response.status === 401 && shouldNotifyUnauthorized(requestPath)) {
		notifyUnauthorized();
	}
	return response;
};

const client = hc<AppType>("/api", {
	fetch: customFetch,
});

async function parseJsonResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		throw new Error(await parseErrorMessage(response));
	}
	return (await response.json()) as T;
}

export async function login(params: LoginParams): Promise<LoginResponse> {
	return withSessionLock(async () => {
		const response = await client.auth.login.$post({
			json: {
				email: params.email,
				password: params.password,
			},
		});
		const result = await parseJsonResponse<LoginResponse>(response);
		sessionVersion += 1;
		return result;
	});
}

export async function logout(): Promise<void> {
	return withSessionLock(async () => {
		const response = await client.auth.logout.$post();
		await parseJsonResponse<LogoutResponse>(response);
		sessionVersion += 1;
	});
}

export async function fetchMe({
	signal,
}: {
	signal?: AbortSignal;
} = {}): Promise<AuthUser | null> {
	const rawResponse = await client.auth.me.$get(undefined, {
		init: { signal },
	});
	if (rawResponse.status === 401) return null;

	const response = await parseJsonResponse<AuthResponse>(rawResponse);
	return response.user;
}

export type ProtectedProfile = ProtectedProfileResponse["profile"];

export async function fetchProtectedProfile({
	signal,
}: {
	signal?: AbortSignal;
} = {}): Promise<ProtectedProfile> {
	const response = await parseJsonResponse<ProtectedProfileResponse>(
		await client.protected.profile.$get(undefined, { init: { signal } }),
	);
	return response.profile;
}

export function useCurrentUserQuery(enabled = true) {
	return useQuery<AuthUser | null, Error>({
		queryKey: authMeQueryKey,
		queryFn: fetchMe,
		enabled,
	});
}

export function useProtectedProfileQuery(userId?: string) {
	return useQuery<ProtectedProfile, Error>({
		queryKey: [...protectedProfileQueryKey, userId ?? null],
		queryFn: fetchProtectedProfile,
		enabled: Boolean(userId),
	});
}

export class HttpStatusError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "HttpStatusError";
		this.status = status;
	}
}

export class PageContentConflictError extends HttpStatusError {
	readonly currentRevision: number;

	constructor(currentRevision: number) {
		super(409, "Content revision conflict");
		this.name = "PageContentConflictError";
		this.currentRevision = currentRevision;
	}
}

export class PageParentConflictError extends HttpStatusError {
	readonly currentParentId: string | null;

	constructor(currentParentId: string | null) {
		super(409, "Page parent conflict");
		this.name = "PageParentConflictError";
		this.currentParentId = currentParentId;
	}
}

export class InvalidPageHierarchyError extends HttpStatusError {
	constructor() {
		super(409, "Invalid page hierarchy");
		this.name = "InvalidPageHierarchyError";
	}
}

export type DuplicatePageConflictCode =
	| "SOURCE_PAGE_CHANGED"
	| "DUPLICATE_REQUEST_CONFLICT"
	| "DUPLICATED_PAGE_UNAVAILABLE";

export class DuplicatePageConflictError extends HttpStatusError {
	readonly code: DuplicatePageConflictCode;

	constructor(code: DuplicatePageConflictCode) {
		super(409, code);
		this.name = "DuplicatePageConflictError";
		this.code = code;
	}
}

export type { Page, PageSummary };

function readConflictRevision(payload: unknown): number | null {
	if (typeof payload !== "object" || payload === null) return null;
	const currentRevision = (payload as { currentRevision?: unknown })
		.currentRevision;
	if (
		typeof currentRevision !== "number" ||
		!Number.isSafeInteger(currentRevision) ||
		currentRevision < 0
	) {
		return null;
	}
	return currentRevision;
}

async function readPagesJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		throw new HttpStatusError(
			response.status,
			await parseErrorMessage(response),
		);
	}
	return parseJsonResponse<T>(response);
}

export async function fetchPages({
	signal,
}: {
	signal?: AbortSignal;
} = {}): Promise<PageSummary[]> {
	const response = await client.pages.$get(undefined, { init: { signal } });
	const body = await readPagesJson<ListPagesResponse>(response);
	return body.pages;
}

export async function fetchPage(
	pageId: string,
	{
		signal,
	}: {
		signal?: AbortSignal;
	} = {},
): Promise<GetPageResponse> {
	const response = await client.pages[":id"].$get(
		{ param: { id: pageId } },
		{ init: { signal } },
	);
	return readPagesJson<GetPageResponse>(response);
}

export async function createPage(input: {
	title: string;
	parentId: string | null;
}): Promise<Page> {
	const response = await client.pages.$post({
		json: {
			title: input.title,
			parentId: input.parentId,
		},
	});
	const body = await readPagesJson<{ page: Page }>(response);
	return body.page;
}

export async function duplicatePage(
	pageId: string,
	input: DuplicatePageInput,
): Promise<{ page: Page; replayed: boolean }> {
	const response = await client.pages[":id"].duplicate.$post({
		param: { id: pageId },
		json: input,
	});
	if (response.status === 409) {
		let payload: unknown;
		try {
			payload = await response.json();
		} catch {
			throw new HttpStatusError(409, "Request failed: 409");
		}
		const code = sourcePageChangedResponseSchema.safeParse(payload).success
			? "SOURCE_PAGE_CHANGED"
			: duplicateRequestConflictResponseSchema.safeParse(payload).success
				? "DUPLICATE_REQUEST_CONFLICT"
				: duplicatedPageUnavailableResponseSchema.safeParse(payload).success
					? "DUPLICATED_PAGE_UNAVAILABLE"
					: null;
		if (!code) throw new HttpStatusError(409, "Request failed: 409");
		throw new DuplicatePageConflictError(code);
	}
	const body = createPageResponseSchema.parse(await readPagesJson(response));
	return { page: body.page, replayed: response.status === 200 };
}

export function usePagesQuery(userId?: string) {
	return useQuery({
		queryKey: ["pages", userId, "list"],
		queryFn: ({ signal }) => fetchPages({ signal }),
		enabled: Boolean(userId),
	});
}

export function usePageQuery(userId?: string, pageId?: string) {
	const queryClient = useQueryClient();
	return useQuery({
		queryKey: ["pages", userId, "detail", pageId],
		queryFn: async ({ signal }) => {
			const body = await fetchPage(pageId as string, { signal });
			const current = queryClient.getQueryData<GetPageResponse>([
				"pages",
				userId,
				"detail",
				pageId,
			]);
			return current && current.content.revision > body.content.revision
				? { ...body, content: current.content }
				: body;
		},
		enabled: Boolean(userId && pageId),
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});
}

export async function updatePageContent(
	pageId: string,
	input: UpdatePageContentInput,
): Promise<UpdatePageContentResponse> {
	const response = await client.pages[":id"].content.$put({
		param: { id: pageId },
		json: input,
	});
	if (response.status === 409) {
		let payload: unknown;
		try {
			payload = await response.json();
		} catch {
			throw new HttpStatusError(409, "Request failed: 409");
		}
		const currentRevision = readConflictRevision(payload);
		if (currentRevision === null) {
			throw new HttpStatusError(409, "Request failed: 409");
		}
		throw new PageContentConflictError(currentRevision);
	}
	return readPagesJson<UpdatePageContentResponse>(response);
}

const cacheSessionEpochs = new WeakMap<QueryClient, number>();
const cacheSessionEpoch = (client: QueryClient) =>
	cacheSessionEpochs.get(client) ?? 0;

export async function updatePageTitle(
	pageId: string,
	input: UpdatePageTitleInput,
): Promise<UpdatePageResponse> {
	return readPagesJson<UpdatePageResponse>(
		await client.pages[":id"].$patch({
			param: { id: pageId },
			json: input,
		}),
	);
}

export async function movePage(
	pageId: string,
	input: MovePageInput,
): Promise<UpdatePageResponse> {
	const response = await client.pages[":id"].move.$post({
		param: { id: pageId },
		json: input,
	});
	if (response.status === 409) {
		let payload: unknown;
		try {
			payload = await response.json();
		} catch {
			throw new HttpStatusError(409, "Request failed: 409");
		}
		const parentConflict = pageParentConflictResponseSchema.safeParse(payload);
		if (parentConflict.success) {
			throw new PageParentConflictError(parentConflict.data.currentParentId);
		}
		if (invalidPageHierarchyResponseSchema.safeParse(payload).success) {
			throw new InvalidPageHierarchyError();
		}
		throw new HttpStatusError(409, "Request failed: 409");
	}
	return readPagesJson<UpdatePageResponse>(response);
}

export function useUpdatePageTitleMutation(userId: string, pageId: string) {
	const queryClient = useQueryClient();
	const ownerSessionEpoch = useRef(cacheSessionEpoch(queryClient)).current;
	const detailKey = ["pages", userId, "detail", pageId];
	const listKey = ["pages", userId, "list"];
	return useMutation({
		networkMode: "always",
		mutationFn: (input: UpdatePageTitleInput) => {
			if (ownerSessionEpoch !== cacheSessionEpoch(queryClient)) {
				throw new HttpStatusError(401, "Session changed before title save.");
			}
			return updatePageTitle(pageId, input);
		},
		onMutate: async () => {
			if (ownerSessionEpoch !== cacheSessionEpoch(queryClient)) {
				throw new HttpStatusError(401, "Session changed before title save.");
			}
			await Promise.all([
				queryClient.cancelQueries({ queryKey: detailKey }),
				queryClient.cancelQueries({ queryKey: listKey }),
			]);
			if (ownerSessionEpoch !== cacheSessionEpoch(queryClient)) {
				throw new HttpStatusError(401, "Session changed before title save.");
			}
			return ownerSessionEpoch;
		},
		onSuccess: (body, _input, epoch) => {
			if (epoch !== cacheSessionEpoch(queryClient)) return;
			void queryClient.cancelQueries({ queryKey: detailKey });
			void queryClient.cancelQueries({ queryKey: listKey });
			queryClient.setQueryData<GetPageResponse>(detailKey, (current) =>
				current
					? { ...current, page: { ...current.page, title: body.page.title } }
					: current,
			);
			queryClient.setQueryData<PageSummary[]>(listKey, (current) =>
				current?.map((page) =>
					page.id === pageId ? { ...page, title: body.page.title } : page,
				),
			);
			void queryClient.invalidateQueries({ queryKey: listKey });
			void queryClient.invalidateQueries({ queryKey: detailKey });
		},
	});
}

export function useMovePageMutation(userId: string, pageId: string) {
	const queryClient = useQueryClient();
	const detailKey = ["pages", userId, "detail", pageId];
	const listKey = ["pages", userId, "list"];
	return useMutation({
		networkMode: "always",
		retry: false,
		scope: { id: `page-move:${userId}` },
		mutationFn: (input: MovePageInput) => movePage(pageId, input),
		onMutate: () => cacheSessionEpoch(queryClient),
		onSuccess: async (body, _input, epoch) => {
			if (epoch !== cacheSessionEpoch(queryClient)) return;
			await Promise.all([
				queryClient.cancelQueries({ queryKey: detailKey }),
				queryClient.cancelQueries({ queryKey: listKey }),
			]);
			if (epoch !== cacheSessionEpoch(queryClient)) return;
			queryClient.setQueryData<GetPageResponse>(detailKey, (current) =>
				current
					? {
							...current,
							page: { ...current.page, parentId: body.page.parentId },
						}
					: current,
			);
			queryClient.setQueryData<PageSummary[]>(listKey, (current) =>
				current?.map((page) =>
					page.id === pageId ? { ...page, parentId: body.page.parentId } : page,
				),
			);
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: listKey }),
				queryClient.invalidateQueries({ queryKey: detailKey }),
			]);
		},
	});
}

export function useUpdatePageContentMutation(userId: string, pageId: string) {
	const queryClient = useQueryClient();
	const detailKey = ["pages", userId, "detail", pageId];
	const listKey = ["pages", userId, "list"];
	return useMutation({
		networkMode: "always",
		mutationFn: (input: UpdatePageContentInput) =>
			updatePageContent(pageId, input),
		onMutate: () => cacheSessionEpoch(queryClient),
		onSuccess: async (body, _input, epoch) => {
			if (epoch !== undefined && epoch !== cacheSessionEpoch(queryClient))
				return;
			await Promise.all([
				queryClient.cancelQueries({ queryKey: detailKey }),
				queryClient.cancelQueries({ queryKey: listKey }),
			]);
			queryClient.setQueryData<GetPageResponse>(detailKey, (current) =>
				current && body.content.revision >= current.content.revision
					? {
							...current,
							page: {
								...current.page,
								updatedAt: laterTimestamp(
									current.page.updatedAt,
									body.page.updatedAt,
								),
							},
							content: body.content,
						}
					: current,
			);
			queryClient.setQueryData<PageSummary[]>(listKey, (current) =>
				current?.map((page) =>
					page.id === pageId
						? {
								...page,
								updatedAt: laterTimestamp(page.updatedAt, body.page.updatedAt),
							}
						: page,
				),
			);
		},
	});
}

function laterTimestamp(current: string, next: string): string {
	return Date.parse(current) >= Date.parse(next) ? current : next;
}

export function useCreatePageMutation(userId?: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (parentId: string | null) =>
			createPage({ title: "無題", parentId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["pages", userId, "list"],
			});
		},
	});
}

export function useDuplicatePageMutation(userId?: string) {
	const queryClient = useQueryClient();
	return useMutation({
		networkMode: "always",
		retry: false,
		mutationFn: ({
			pageId,
			input,
		}: {
			pageId: string;
			input: DuplicatePageInput;
		}) => duplicatePage(pageId, input),
		onMutate: () => cacheSessionEpoch(queryClient),
		onSuccess: async (_body, _variables, epoch) => {
			if (epoch !== cacheSessionEpoch(queryClient)) return;
			await queryClient.invalidateQueries({
				queryKey: ["pages", userId, "list"],
			});
		},
	});
}

export async function setSessionUser(
	queryClient: QueryClient,
	user: AuthUser | null,
) {
	if (user) lastUnauthorizedEventAt = 0;
	cacheSessionEpochs.set(queryClient, cacheSessionEpoch(queryClient) + 1);
	await queryClient.cancelQueries({
		predicate: (query) => {
			const root = query.queryKey[0];
			return root === "auth" || root === "protected" || root === "pages";
		},
	});
	queryClient.removeQueries({ queryKey: ["protected"] });
	queryClient.removeQueries({ queryKey: ["pages"] });
	queryClient.setQueryData(authMeQueryKey, user);
}

export function useLoginMutation(options?: LoginMutationOptions) {
	const queryClient = useQueryClient();
	return useMutation<LoginResponse, Error, LoginParams>({
		mutationFn: login,
		...options,
		onSuccess: async (response, variables, onMutateResult, context) => {
			await setSessionUser(queryClient, response.user);
			await options?.onSuccess?.(response, variables, onMutateResult, context);
		},
	});
}

export function useLogoutMutation(options?: LogoutMutationOptions) {
	const queryClient = useQueryClient();
	return useMutation<void, Error, void>({
		mutationFn: logout,
		...options,
		onSuccess: async (data, variables, onMutateResult, context) => {
			await setSessionUser(queryClient, null);
			await options?.onSuccess?.(data, variables, onMutateResult, context);
		},
	});
}
