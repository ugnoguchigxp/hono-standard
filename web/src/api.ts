import type { AppType } from "@api/app/hono";
import type {
	AuthResponse,
	AuthSessionUser,
	LoginInput,
	LogoutResponse,
} from "@shared/schemas/auth.schema";
import type { ProtectedProfileResponse } from "@shared/schemas/protected.schema";
import {
	type QueryClient,
	type UseMutationOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
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

export async function setSessionUser(
	queryClient: QueryClient,
	user: AuthUser | null,
) {
	await queryClient.cancelQueries({
		predicate: (query) =>
			query.queryKey[0] === "auth" || query.queryKey[0] === "protected",
	});
	queryClient.removeQueries({ queryKey: ["protected"] });
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
