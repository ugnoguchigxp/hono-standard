export type ServerSentEvent = { event: string; data: string; id?: string };

/** Incremental SSE parser: accepts split UTF-8 decoded text and CRLF framing. */
export class SseParser {
	private buffer = "";
	push(chunk: string): ServerSentEvent[] {
		this.buffer += chunk.replaceAll("\r\n", "\n");
		const events: ServerSentEvent[] = [];
		while (true) {
			const boundary = this.buffer.indexOf("\n\n");
			if (boundary < 0) break;
			const lines = this.buffer.slice(0, boundary).split("\n");
			this.buffer = this.buffer.slice(boundary + 2);
			let event = "message";
			let id: string | undefined;
			const data: string[] = [];
			for (const line of lines) {
				if (!line || line.startsWith(":")) continue;
				const colon = line.indexOf(":");
				const key = colon < 0 ? line : line.slice(0, colon);
				const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
				if (key === "event") event = value;
				else if (key === "data") data.push(value);
				else if (key === "id") id = value;
			}
			if (data.length) events.push({ event, data: data.join("\n"), id });
		}
		return events;
	}
}
