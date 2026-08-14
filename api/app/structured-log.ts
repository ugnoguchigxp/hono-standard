export type StructuredLogLevel = "info" | "error";

export type StructuredLogRecord = {
	timestamp: string;
	level: StructuredLogLevel;
	event: string;
	[key: string]: unknown;
};

export type StructuredLogSink = (record: StructuredLogRecord) => void;

export function createStructuredLogRecord(
	level: StructuredLogLevel,
	event: string,
	fields: Record<string, unknown> = {},
	now: () => number = Date.now,
): StructuredLogRecord {
	const timestamp = new Date(now()).toISOString();
	const additionalFields = { ...fields };
	delete additionalFields.timestamp;
	delete additionalFields.level;
	delete additionalFields.event;
	return { timestamp, level, event, ...additionalFields };
}

export const writeStructuredLog: StructuredLogSink = (record) => {
	const serialized = JSON.stringify(record);
	if (record.level === "error") {
		console.error(serialized);
		return;
	}
	console.log(serialized);
};

export function errorLogFields(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		return { errorName: error.name, errorMessage: error.message };
	}
	return { errorName: "UnknownError", errorMessage: String(error) };
}
