import { detectDashboardPayloadVersion } from "../../shared/schemas/dashboard.schema";
import {
	invalidRequest,
	unsupportedVersion,
} from "../modules/dashboard/runtime-errors";

export const DASHBOARD_V2_MEDIA_TYPE =
	"application/vnd.hono-standard.dashboard.v2+json";
export type DashboardAcceptVersion = 1 | 2;

export function negotiateDashboardAccept(
	value: string | undefined,
): DashboardAcceptVersion {
	if (!value) return 1;
	if (value.length > 8192) throw invalidRequest();
	const ranges = value.split(",");
	if (ranges.length > 32) throw invalidRequest();
	let v2 = false;
	let fallback = false;
	let acceptable = false;
	for (const item of ranges) {
		const parts = item.trim().split(";");
		const media = parts.shift()?.trim().toLowerCase();
		if (!media) throw invalidRequest();
		let q = 1;
		let seenQ = false;
		for (const raw of parts) {
			const [key, rawValue, ...rest] = raw.trim().split("=");
			if (!key || rawValue === undefined || rest.length > 0)
				throw invalidRequest();
			if (key.toLowerCase() !== "q" || seenQ) throw invalidRequest();
			seenQ = true;
			q = Number(rawValue);
			if (!Number.isFinite(q) || q < 0 || q > 1) throw invalidRequest();
		}
		if (q === 0) continue;
		acceptable = true;
		if (media === DASHBOARD_V2_MEDIA_TYPE) v2 = true;
		else if (media === "application/json" || media === "*/*") fallback = true;
		else if (
			/^application\/vnd\.hono-standard\.dashboard\.v\d+\+json$/i.test(media)
		)
			throw unsupportedVersion();
	}
	if (v2) return 2;
	if (fallback) return 1;
	if (!acceptable) throw unsupportedVersion();
	throw unsupportedVersion();
}

export function detectDashboardRequestVersion(
	value: unknown,
): DashboardAcceptVersion {
	try {
		return detectDashboardPayloadVersion(value);
	} catch {
		throw unsupportedVersion(400);
	}
}
