import type { AppDeps } from "../api/app/hono";
import type { LoadWorkload } from "./load-check";

export async function createLoadWorkloads(
	_runtime: AppDeps,
	_concurrency: number,
): Promise<LoadWorkload[]> {
	return ["health", "ready"].map((endpoint) => ({
		name: endpoint,
		request: (baseUrl: string) =>
			fetch(`${baseUrl}/api/${endpoint}`, {
				signal: AbortSignal.timeout(10_000),
			}),
	}));
}
