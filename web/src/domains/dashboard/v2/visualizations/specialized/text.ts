// biome-ignore lint/complexity/useRegexLiterals: constructing the pattern keeps control escapes out of source text.
const unsafeControl = new RegExp(
	"[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]",
	"g",
);
const bidi = /[\u202a-\u202e\u2066-\u2069]/g;

/** Display-only text boundary. Values remain unchanged in Table/export models. */
export function sanitizeDisplayText(value: unknown, maxLength = 8192) {
	return String(value ?? "")
		.replace(unsafeControl, "�")
		.replace(bidi, "�")
		.slice(0, maxLength);
}

export function truncateDisplayText(value: unknown, maxLength: number) {
	const text = sanitizeDisplayText(value, maxLength);
	return text.length < String(value ?? "").length ? `${text}…` : text;
}
