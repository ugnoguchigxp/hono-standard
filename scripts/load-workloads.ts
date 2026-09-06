import type { AppDeps } from "../api/app/hono";
import type { LoadWorkload } from "./load-check";

export async function createLoadWorkloads(
	runtime: AppDeps,
	concurrency: number,
): Promise<LoadWorkload[]> {
	const credentials = {
		email: "load@example.com",
		password: "isolated-load-password-2026",
	};
	await runtime.authService.createAdmin({
		...credentials,
		displayName: "Load fixture",
	});
	const sessions: Awaited<ReturnType<AppDeps["authService"]["login"]>>[] = [];
	for (let worker = 0; worker < concurrency; worker++)
		sessions.push(await runtime.authService.login(credentials));
	return [
		{
			name: "profile-read",
			request: (baseUrl, worker) =>
				fetch(`${baseUrl}/api/protected/profile`, {
					headers: { Authorization: `Bearer ${sessions[worker]?.accessToken}` },
					signal: AbortSignal.timeout(10_000),
				}),
		},
		{
			name: "refresh-write",
			request: async (baseUrl, worker) => {
				const session = sessions[worker];
				if (!session) throw new Error("Missing load session");
				const response = await fetch(`${baseUrl}/api/auth/refresh`, {
					method: "POST",
					headers: {
						Origin: baseUrl,
						Cookie: `refresh_token=${session.refreshToken}`,
					},
					signal: AbortSignal.timeout(10_000),
				});
				const cookie = response.headers
					.getSetCookie()
					.find((value) => value.startsWith("refresh_token="));
				if (response.ok && !cookie)
					throw new Error("Refresh did not rotate its cookie");
				if (cookie)
					session.refreshToken =
						cookie.split(";")[0]?.slice("refresh_token=".length) ?? "";
				return response;
			},
		},
	];
}
