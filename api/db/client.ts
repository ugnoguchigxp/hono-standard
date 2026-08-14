export type WriteOperation<TDatabase, TResult> = (
	database: TDatabase,
) => TResult | Promise<TResult>;

export type DatabaseWriter<TDatabase> = {
	execute: <TResult>(
		operation: WriteOperation<TDatabase, TResult>,
	) => Promise<TResult>;
	close: () => Promise<void>;
};

export type ReadDatabase<TDatabase> = Omit<
	TDatabase,
	"delete" | "insert" | "run" | "transaction" | "update"
>;

export type DatabaseClient<TDatabase> = {
	read: ReadDatabase<TDatabase>;
	write: DatabaseWriter<TDatabase>;
};

export function createSingleWriterClient<TDatabase>(
	database: TDatabase,
): DatabaseWriter<TDatabase> {
	let tail: Promise<void> = Promise.resolve();
	let closed = false;

	return {
		execute<TResult>(
			operation: WriteOperation<TDatabase, TResult>,
		): Promise<TResult> {
			if (closed) {
				return Promise.reject(new Error("Database writer is closed."));
			}
			const result = tail.then(() => operation(database));
			tail = result.then(
				() => undefined,
				() => undefined,
			);
			return result;
		},
		async close(): Promise<void> {
			closed = true;
			await tail;
		},
	};
}
