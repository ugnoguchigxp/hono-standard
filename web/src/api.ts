import type { AppType } from "@api/app/hono";
import type {
	AuthResponse,
	AuthSessionUser,
	LoginInput,
	LogoutResponse,
} from "@shared/schemas/auth.schema";
import type { ProtectedProfileResponse } from "@shared/schemas/protected.schema";
import {
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

const canRetryWithRefresh = (path: string): boolean => !isAuthPath(path);

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

let refreshPromise: Promise<boolean> | undefined;

const refreshSession = async (): Promise<boolean> => {
	if (!refreshPromise) {
		refreshPromise = fetch("/api/auth/refresh", {
			method: "POST",
			credentials: "include",
		})
			.then((response) => response.ok)
			.catch(() => false)
			.finally(() => {
				refreshPromise = undefined;
			});
	}
	return refreshPromise;
};

const abortable = async <T>(
	promise: Promise<T>,
	signal?: AbortSignal | null,
): Promise<T> => {
	if (!signal) return promise;
	if (signal.aborted)
		throw new DOMException("The operation was aborted", "AbortError");
	return new Promise<T>((resolve, reject) => {
		const onAbort = () =>
			reject(new DOMException("The operation was aborted", "AbortError"));
		signal.addEventListener("abort", onAbort, { once: true });
		promise
			.then(resolve, reject)
			.finally(() => signal.removeEventListener("abort", onAbort));
	});
};

export const appFetch = async (
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> => {
	const headers = new Headers(
		input instanceof Request ? input.headers : undefined,
	);
	new Headers(init?.headers).forEach((value, key) => {
		headers.set(key, value);
	});
	const requestPath = getRequestPath(input);
	const signal =
		init?.signal ?? (input instanceof Request ? input.signal : undefined);
	const requestInit: RequestInit = {
		...init,
		headers,
		credentials: "include",
		signal,
	};
	const requestTemplate =
		input instanceof Request ? new Request(input, requestInit) : undefined;

	const execute = () =>
		requestTemplate
			? fetch(requestTemplate.clone())
			: fetch(input, requestInit);

	let response = await execute();
	if (response.status === 401 && canRetryWithRefresh(requestPath)) {
		const refreshed = await abortable(refreshSession(), signal);
		if (refreshed && !signal?.aborted) response = await execute();
	}

	if (response.status === 401 && shouldNotifyUnauthorized(requestPath)) {
		notifyUnauthorized();
	}
	return response;
};

const customFetch = appFetch;

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
	const response = await client.auth.login.$post({
		json: {
			email: params.email,
			password: params.password,
		},
	});
	return parseJsonResponse<LoginResponse>(response);
}

export async function logout(): Promise<void> {
	const response = await client.auth.logout.$post();
	await parseJsonResponse<LogoutResponse>(response);
}

export async function fetchMe(): Promise<AuthUser | null> {
	const rawResponse = await client.auth.me.$get();
	if (rawResponse.status === 401) return null;

	const response = await parseJsonResponse<AuthResponse>(rawResponse);
	return response.user;
}

export type ProtectedProfile = ProtectedProfileResponse["profile"];

export async function fetchProtectedProfile(): Promise<ProtectedProfile> {
	const response = await parseJsonResponse<ProtectedProfileResponse>(
		await client.protected.profile.$get(),
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

export function useProtectedProfileQuery(enabled = true) {
	return useQuery<ProtectedProfile, Error>({
		queryKey: protectedProfileQueryKey,
		queryFn: fetchProtectedProfile,
		enabled,
	});
}

export function useLoginMutation(options?: LoginMutationOptions) {
	const queryClient = useQueryClient();
	return useMutation<LoginResponse, Error, LoginParams>({
		mutationFn: login,
		...options,
		onSuccess: async (response, variables, onMutateResult, context) => {
			queryClient.setQueryData(authMeQueryKey, response.user);
			await options?.onSuccess?.(response, variables, onMutateResult, context);
		},
	});
}

export function useLogoutMutation(options?: LogoutMutationOptions) {
	const queryClient = useQueryClient();
	return useMutation<void, Error, void>({
		mutationFn: logout,
		...options,
		onSettled: async (data, error, variables, onMutateResult, context) => {
			queryClient.setQueryData(authMeQueryKey, null);
			await options?.onSettled?.(
				data,
				error,
				variables,
				onMutateResult,
				context,
			);
		},
	});
}
