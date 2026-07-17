import type { DashboardDataShape } from "../../../../../shared/schemas/dashboard.schema";
import { DashboardRuntimeError } from "../../runtime-errors";
import { defineDashboardQueryV2 } from "../define-dashboard";
import { queryResult } from "../frame-builders";
import type {
	DashboardQueryDefinitionV2,
	DashboardQueryHandlerContextV2,
} from "../types";
import {
	DashboardRecordAdapterError,
	type DashboardRecordColumn,
	type DashboardRecordOverflowPolicy,
	recordsToDataFrameV2,
} from "./record-adapter";

export type DefineRecordQueryInputV2<TRow extends object> = {
	id: string;
	filterKeys: readonly string[];
	outputShape?: DashboardDataShape;
	frameName: string;
	columns: readonly DashboardRecordColumn<TRow>[];
	overflow?: DashboardRecordOverflowPolicy;
	load: (
		context: DashboardQueryHandlerContextV2,
	) => readonly TRow[] | Promise<readonly TRow[]>;
};

export function defineRecordQueryV2<TRow extends object>(
	input: DefineRecordQueryInputV2<TRow>,
): DashboardQueryDefinitionV2 {
	const outputShape = input.outputShape ?? "table";
	try {
		recordsToDataFrameV2({
			records: [],
			refId: "A",
			name: input.frameName,
			outputShape,
			columns: input.columns,
		});
	} catch (error) {
		throw new TypeError("Invalid dashboard record query definition", {
			cause: error,
		});
	}

	return defineDashboardQueryV2({
		id: input.id,
		filterKeys: [...input.filterKeys],
		outputShapes: [outputShape],
		handler: async (context) => {
			if (context.outputFrameRefs.length !== 1) throw invalidAdapterResult();
			throwIfAborted(context.signal);
			const records = await input.load(context);
			throwIfAborted(context.signal);
			try {
				const converted = recordsToDataFrameV2({
					records,
					refId: context.outputFrameRefs[0] as string,
					name: input.frameName,
					outputShape,
					columns: input.columns,
					maxRows: context.maxRows,
					overflow: input.overflow,
				});
				return queryResult({
					frames: [converted.frame],
					state:
						converted.state ??
						(records.length === 0 ? { emptyReason: "no-records" } : undefined),
				});
			} catch (error) {
				if (error instanceof DashboardRecordAdapterError)
					throw invalidAdapterResult(error);
				throw error;
			}
		},
	});
}

function throwIfAborted(signal: AbortSignal): void {
	if (!signal.aborted) return;
	throw new DashboardRuntimeError(
		"REQUEST_CANCELLED",
		408,
		"Dashboard request was cancelled",
		false,
		undefined,
		signal.reason,
	);
}

function invalidAdapterResult(cause?: unknown): DashboardRuntimeError {
	return new DashboardRuntimeError(
		"INVALID_HANDLER_RESULT",
		422,
		"Dashboard handler returned an invalid result",
		false,
		undefined,
		cause,
	);
}
