import type { AppType } from "@api/app/hono";
import {
	ACTION3D_AUTOSAVE_SLOT,
	type Action3dSaveEnvelope,
} from "@shared/action3d";
import { AUTOSAVE_SLOT_ID, type GameSaveSlotId } from "@shared/game";
import { GAME_IDS } from "@shared/game-platform";
import type {
	AuthResponse,
	AuthSessionUser,
	LoginInput,
	LogoutResponse,
} from "@shared/schemas/auth.schema";
import type {
	DeleteGameSaveResponse,
	GetGameSaveResponse,
	ListGameSaveHistoryResponse,
	ListGameSaveSlotsResponse,
	PutGameSaveRequest,
	PutGameSaveResponse,
	RestoreGameSaveRequest,
} from "@shared/schemas/game-save.schema";
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
let refreshRequest: Promise<boolean> | null = null;

const notifyUnauthorized = () => {
	if (typeof window === "undefined") return;
	const now = Date.now();
	if (now - lastUnauthorizedEventAt < 500) return;
	lastUnauthorizedEventAt = now;
	window.dispatchEvent(new Event(UNAUTHORIZED_EVENT_NAME));
};

export const getRequestPath = (input: RequestInfo | URL): string => {
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

const shouldNotifyUnauthorized = (path: string): boolean => !isAuthPath(path);

const refreshAccessToken = (): Promise<boolean> => {
	if (!refreshRequest) {
		refreshRequest = fetch("/api/auth/refresh", {
			method: "POST",
			credentials: "include",
		})
			.then((response) => response.ok)
			.catch(() => false)
			.finally(() => {
				refreshRequest = null;
			});
	}
	return refreshRequest;
};

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

	let response = await execute();
	if (response.status === 401 && canRetryWithRefresh(requestPath)) {
		if (await refreshAccessToken()) response = await execute();
	}

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
		throw new ApiRequestError(
			response.status,
			await parseErrorMessage(response),
		);
	}
	return (await response.json()) as T;
}

export class ApiRequestError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "ApiRequestError";
	}
}

const rpgGameSavesPath = `/api/games/${GAME_IDS.rpg2d}/saves`;
const rpgGameSavePath = (slotId: GameSaveSlotId) =>
	`${rpgGameSavesPath}/${slotId}`;
const action3dSavePath = `/api/games/${GAME_IDS.action3d}/saves/${ACTION3D_AUTOSAVE_SLOT}`;

export async function fetchRpgGameSave(
	expectedOwner: string,
	signal?: AbortSignal,
	slotId: GameSaveSlotId = AUTOSAVE_SLOT_ID,
): Promise<GetGameSaveResponse> {
	return parseJsonResponse<GetGameSaveResponse>(
		await customFetch(rpgGameSavePath(slotId), {
			headers: { "X-Game-Save-Owner": expectedOwner },
			signal,
		}),
	);
}

export async function putRpgGameSave(
	request: PutGameSaveRequest,
	expectedOwner: string,
	signal?: AbortSignal,
	slotId: GameSaveSlotId = request.save.slotId,
): Promise<PutGameSaveResponse> {
	return parseJsonResponse<PutGameSaveResponse>(
		await customFetch(rpgGameSavePath(slotId), {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				"X-Game-Save-Owner": expectedOwner,
			},
			body: JSON.stringify(request),
			signal,
		}),
	);
}

export async function deleteRpgGameSave(
	expectedOwner: string,
	slotId: GameSaveSlotId = AUTOSAVE_SLOT_ID,
): Promise<DeleteGameSaveResponse> {
	return parseJsonResponse<DeleteGameSaveResponse>(
		await customFetch(rpgGameSavePath(slotId), {
			method: "DELETE",
			headers: { "X-Game-Save-Owner": expectedOwner },
		}),
	);
}

export async function listRpgGameSaveSlots(
	expectedOwner: string,
	signal?: AbortSignal,
): Promise<ListGameSaveSlotsResponse> {
	return parseJsonResponse<ListGameSaveSlotsResponse>(
		await customFetch(rpgGameSavesPath, {
			headers: { "X-Game-Save-Owner": expectedOwner },
			signal,
		}),
	);
}

export async function listRpgGameSaveHistory(
	expectedOwner: string,
	slotId: GameSaveSlotId,
	signal?: AbortSignal,
): Promise<ListGameSaveHistoryResponse> {
	return parseJsonResponse<ListGameSaveHistoryResponse>(
		await customFetch(`${rpgGameSavePath(slotId)}/history`, {
			headers: { "X-Game-Save-Owner": expectedOwner },
			signal,
		}),
	);
}

export async function restoreRpgGameSave(
	expectedOwner: string,
	slotId: GameSaveSlotId,
	sourceRevision: number,
	request: RestoreGameSaveRequest,
	signal?: AbortSignal,
): Promise<PutGameSaveResponse> {
	return parseJsonResponse<PutGameSaveResponse>(
		await customFetch(
			`${rpgGameSavePath(slotId)}/history/${sourceRevision}/restore`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Game-Save-Owner": expectedOwner,
				},
				body: JSON.stringify(request),
				signal,
			},
		),
	);
}

export async function fetchAction3dGameSave(
	expectedOwner: string,
	signal?: AbortSignal,
): Promise<GetGameSaveResponse<Action3dSaveEnvelope>> {
	return parseJsonResponse<GetGameSaveResponse<Action3dSaveEnvelope>>(
		await customFetch(action3dSavePath, {
			headers: { "X-Game-Save-Owner": expectedOwner },
			signal,
		}),
	);
}

export async function putAction3dGameSave(
	request: PutGameSaveRequest<Action3dSaveEnvelope>,
	expectedOwner: string,
	signal?: AbortSignal,
): Promise<PutGameSaveResponse<Action3dSaveEnvelope>> {
	return parseJsonResponse<PutGameSaveResponse<Action3dSaveEnvelope>>(
		await customFetch(action3dSavePath, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				"X-Game-Save-Owner": expectedOwner,
			},
			body: JSON.stringify(request),
			signal,
		}),
	);
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
