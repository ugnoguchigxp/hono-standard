import type {
	DashboardQueryDefinitionV2,
	DashboardQueryHandlerContextV2,
} from "../types";
import {
	type DefineRecordQueryInputV2,
	defineRecordQueryV2,
} from "./record-query";

export type DefineDrizzleRecordQueryInputV2<
	TReadDatabase,
	TRow extends object,
> = Omit<DefineRecordQueryInputV2<TRow>, "load"> & {
	database: TReadDatabase;
	select: (
		database: TReadDatabase,
		context: DashboardQueryHandlerContextV2,
	) => readonly TRow[] | Promise<readonly TRow[]>;
};

export function defineDrizzleRecordQueryV2<TReadDatabase, TRow extends object>(
	input: DefineDrizzleRecordQueryInputV2<TReadDatabase, TRow>,
): DashboardQueryDefinitionV2 {
	const { database, select, ...recordQuery } = input;
	return defineRecordQueryV2({
		...recordQuery,
		load: (context) => select(database, context),
	});
}
