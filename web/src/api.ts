import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationOptions,
} from "@tanstack/react-query";

export type AuthUser = {
	id: string;
	email: string;
	displayName: string;
	role: "admin" | "member";
};

export type LoginParams = {
	email: string;
	password: string;
};

export type LoginResponse = {
	user: AuthUser;
};

type RequestInitJson = Omit<RequestInit, "body"> & {
	body?: unknown;
};

export const UNAUTHORIZED_EVENT_NAME = "hono-standard:unauthorized";
export const authMeQueryKey = ["auth", "me"] as const;

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

const isAuthPath = (path: string): boolean => path.startsWith("/api/auth/");

const canRetryWithRefresh = (path: string): boolean =>
	!isAuthPath(path) || path === "/api/auth/me";

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

async function requestJson<T>(
	path: string,
	init?: RequestInitJson,
): Promise<T> {
	const execute = async (): Promise<Response> => {
		const headers = new Headers(init?.headers);
		if (init?.body !== undefined && !headers.has("Content-Type")) {
			headers.set("Content-Type", "application/json");
		}

		const { body, ...restInit } = init || {};
		return fetch(path, {
			...restInit,
			headers,
			credentials: "include",
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	};

	let response = await execute();
	if (response.status === 401 && canRetryWithRefresh(path)) {
		const refreshResponse = await fetch("/api/auth/refresh", {
			method: "POST",
			credentials: "include",
		});
		if (refreshResponse.ok) response = await execute();
	}

	if (!response.ok) {
		if (response.status === 401 && shouldNotifyUnauthorized(path)) {
			notifyUnauthorized();
		}
		throw new Error(await parseErrorMessage(response));
	}
	return (await response.json()) as T;
}

async function requestVoid(
	path: string,
	init?: RequestInitJson,
): Promise<void> {
	await requestJson(path, init);
}

export async function login(params: LoginParams): Promise<LoginResponse> {
	return requestJson("/api/auth/login", {
		method: "POST",
		body: params,
	});
}

export async function logout(): Promise<void> {
	await requestVoid("/api/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<AuthUser> {
	const response = await requestJson<{ user: AuthUser }>("/api/auth/me");
	return response.user;
}

export function useCurrentUserQuery() {
	return useQuery<AuthUser, Error, AuthUser | null>({
		queryKey: authMeQueryKey,
		queryFn: fetchMe,
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
