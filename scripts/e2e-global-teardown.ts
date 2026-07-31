import { readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const composeProjectFile = "data/e2e-compose-project";

export default function globalTeardown(): void {
	try {
		const project = readFileSync(composeProjectFile, "utf8").trim();
		if (project) {
			spawnSync(
				"docker",
				[
					"compose",
					"-f",
					"docker-compose.e2e.yml",
					"-p",
					project,
					"down",
					"--volumes",
					"--remove-orphans",
				],
				{ stdio: "inherit", env: process.env },
			);
		}
	} catch (error) {
		if (
			!(error instanceof Error) ||
			!("code" in error) ||
			error.code !== "ENOENT"
		) {
			throw error;
		}
	} finally {
		rmSync(composeProjectFile, { force: true });
		rmSync("data/e2e-wiki", { force: true, recursive: true });
	}
}
