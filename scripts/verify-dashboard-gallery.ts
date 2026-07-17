import {
	galleryCases,
	galleryVisualizations,
} from "../api/modules/dashboard/v2/gallery-dashboard";

const required = new Set(
	galleryVisualizations.flatMap((definition) =>
		definition.descriptor.presets.map(
			(preset) => `${definition.descriptor.type}/${preset.id}`,
		),
	),
);
const actual = new Set(
	galleryCases.map((item) => `${item.visualizationType}/${item.preset}`),
);
const missing = [...required].filter((key) => !actual.has(key));
const unknown = [...actual].filter((key) => !required.has(key));
if (missing.length || unknown.length) {
	console.error(JSON.stringify({ missing, unknown }, null, 2));
	process.exit(1);
}
if (new Set(galleryCases.map((item) => item.id)).size !== galleryCases.length) {
	console.error("Gallery case IDs must be unique");
	process.exit(1);
}
console.log(`Dashboard gallery gate passed: ${galleryCases.length} cases`);
