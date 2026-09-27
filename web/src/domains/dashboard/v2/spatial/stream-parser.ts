export type SseRecord = { event: string; id?: string; data: string };
const MAX_FRAME_CHARS = 1_048_576;

export class SseParser {
	private buffer = "";

	feed(chunk: string): SseRecord[] {
		this.buffer = (this.buffer + chunk).replace(/\r\n/g, "\n");
		const records: SseRecord[] = [];
		let delimiter = this.buffer.indexOf("\n\n");
		while (delimiter >= 0) {
			if (delimiter > MAX_FRAME_CHARS)
				throw new Error("Observatory stream frame too large");
			const frame = this.buffer.slice(0, delimiter);
			this.buffer = this.buffer.slice(delimiter + 2);
			const record = parseFrame(frame);
			if (record) records.push(record);
			delimiter = this.buffer.indexOf("\n\n");
		}
		if (this.buffer.length > MAX_FRAME_CHARS)
			throw new Error("Observatory stream frame too large");
		return records;
	}
}

function parseFrame(frame: string): SseRecord | null {
	let event = "message";
	let id: string | undefined;
	const data: string[] = [];
	for (const line of frame.split("\n")) {
		if (!line || line.startsWith(":")) continue;
		const colon = line.indexOf(":");
		const field = colon < 0 ? line : line.slice(0, colon);
		const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
		if (field === "event") event = value;
		else if (field === "id") id = value;
		else if (field === "data") data.push(value);
	}
	return data.length ? { event, id, data: data.join("\n") } : null;
}
