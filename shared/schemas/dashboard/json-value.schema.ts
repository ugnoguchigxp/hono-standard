import { z } from "zod";
import { DASHBOARD_V2_LIMITS } from "./common.schema";

export type DashboardJsonValue =
	| null
	| boolean
	| number
	| string
	| DashboardJsonValue[]
	| { [key: string]: DashboardJsonValue };
export type DashboardJsonObject = { [key: string]: DashboardJsonValue };
export type DashboardJsonLimits = {
	maxDepth: number;
	maxObjectKeys: number;
	maxArrayItems: number;
	maxBytes: number;
};
export type DashboardJsonValidationIssue = {
	code:
		| "INVALID_JSON_TYPE"
		| "CIRCULAR_REFERENCE"
		| "JSON_DEPTH_EXCEEDED"
		| "JSON_OBJECT_KEYS_EXCEEDED"
		| "JSON_ARRAY_ITEMS_EXCEEDED"
		| "JSON_BYTES_EXCEEDED"
		| "FORBIDDEN_JSON_KEY";
	path: Array<string | number>;
	message: string;
};

const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (value === null || typeof value !== "object") return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

export function validateDashboardJsonValue(
	value: unknown,
	limits: DashboardJsonLimits = {
		maxDepth: DASHBOARD_V2_LIMITS.maxJsonDepth,
		maxObjectKeys: DASHBOARD_V2_LIMITS.maxJsonObjectKeys,
		maxArrayItems: DASHBOARD_V2_LIMITS.maxJsonArrayItems,
		maxBytes: DASHBOARD_V2_LIMITS.maxVisualizationOptionsBytes,
	},
): { valid: boolean; issues: DashboardJsonValidationIssue[] } {
	const issues: DashboardJsonValidationIssue[] = [];
	const active = new Set<object>();
	type Entry = {
		value: unknown;
		path: Array<string | number>;
		depth: number;
		leaving?: boolean;
	};
	const stack: Entry[] = [{ value, path: [], depth: 0 }];
	while (stack.length > 0) {
		const entry = stack.pop() as Entry;
		if (entry.leaving) {
			if (entry.value && typeof entry.value === "object")
				active.delete(entry.value);
			continue;
		}
		const current = entry.value;
		if (
			current === null ||
			typeof current === "string" ||
			typeof current === "boolean"
		)
			continue;
		if (typeof current === "number") {
			if (!Number.isFinite(current))
				issues.push({
					code: "INVALID_JSON_TYPE",
					path: entry.path,
					message: "number must be finite",
				});
			continue;
		}
		if (
			typeof current !== "object" ||
			(!isPlainObject(current) && !Array.isArray(current))
		) {
			issues.push({
				code: "INVALID_JSON_TYPE",
				path: entry.path,
				message:
					"only JSON primitive, array, and plain object values are allowed",
			});
			continue;
		}
		if (active.has(current)) {
			issues.push({
				code: "CIRCULAR_REFERENCE",
				path: entry.path,
				message: "circular JSON value",
			});
			continue;
		}
		if (entry.depth > limits.maxDepth) {
			issues.push({
				code: "JSON_DEPTH_EXCEEDED",
				path: entry.path,
				message: `JSON depth exceeds ${limits.maxDepth}`,
			});
			continue;
		}
		active.add(current);
		stack.push({
			value: current,
			path: entry.path,
			depth: entry.depth,
			leaving: true,
		});
		if (Array.isArray(current)) {
			if (current.length > limits.maxArrayItems)
				issues.push({
					code: "JSON_ARRAY_ITEMS_EXCEEDED",
					path: entry.path,
					message: "too many array items",
				});
			for (let index = current.length - 1; index >= 0; index -= 1)
				stack.push({
					value: current[index],
					path: [...entry.path, index],
					depth: entry.depth + 1,
				});
		} else {
			const keys = Object.keys(current);
			if (keys.length > limits.maxObjectKeys)
				issues.push({
					code: "JSON_OBJECT_KEYS_EXCEEDED",
					path: entry.path,
					message: "too many object keys",
				});
			for (let index = keys.length - 1; index >= 0; index -= 1) {
				const key = keys[index] as string;
				if (forbidden.has(key))
					issues.push({
						code: "FORBIDDEN_JSON_KEY",
						path: [...entry.path, key],
						message: `forbidden JSON key: ${key}`,
					});
				stack.push({
					value: current[key],
					path: [...entry.path, key],
					depth: entry.depth + 1,
				});
			}
		}
	}
	if (issues.length === 0) {
		try {
			const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
			if (bytes > limits.maxBytes)
				issues.push({
					code: "JSON_BYTES_EXCEEDED",
					path: [],
					message: `JSON value exceeds ${limits.maxBytes} bytes`,
				});
		} catch {
			issues.push({
				code: "INVALID_JSON_TYPE",
				path: [],
				message: "value cannot be serialized as JSON",
			});
		}
	}
	return { valid: issues.length === 0, issues };
}

export const dashboardJsonValueSchema = z
	.unknown()
	.superRefine((value, context) => {
		const result = validateDashboardJsonValue(value);
		for (const issue of result.issues)
			context.addIssue({
				code: "custom",
				path: issue.path,
				message: issue.message,
			});
	});
export const dashboardJsonObjectSchema = dashboardJsonValueSchema.refine(
	isPlainObject,
	"JSON root must be a plain object",
) as z.ZodType<DashboardJsonObject>;

export function mergeDashboardJsonObjects(
	base: DashboardJsonObject,
	patch: DashboardJsonObject,
): DashboardJsonObject {
	const baseCheck = validateDashboardJsonValue(base);
	const patchCheck = validateDashboardJsonValue(patch);
	if (
		!baseCheck.valid ||
		!patchCheck.valid ||
		!isPlainObject(base) ||
		!isPlainObject(patch)
	)
		throw new Error("INVALID_JSON_VALUE");
	const merge = (
		left: DashboardJsonValue,
		right: DashboardJsonValue,
	): DashboardJsonValue => {
		if (isPlainObject(left) && isPlainObject(right)) {
			const result: DashboardJsonObject = { ...left };
			for (const [key, value] of Object.entries(right))
				result[key] =
					key in result
						? merge(result[key] as DashboardJsonValue, value)
						: structuredClone(value);
			return result;
		}
		return structuredClone(right);
	};
	const result = merge(base, patch) as DashboardJsonObject;
	const check = validateDashboardJsonValue(result);
	if (!check.valid)
		throw new Error(check.issues[0]?.code ?? "INVALID_JSON_VALUE");
	return result;
}
