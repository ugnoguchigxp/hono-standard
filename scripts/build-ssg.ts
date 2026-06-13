import fs from "node:fs/promises";
import { toSSG } from "hono/ssg";
import app from "../api/app/hono";

const result = await toSSG(app, fs, {
	dir: "dist-ssg",
});

if (!result.success) {
	console.error("SSG generation failed:", result.error);
	process.exit(1);
}

console.log(`SSG generated ${result.files.length} files.`);
