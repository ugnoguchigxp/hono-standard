import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { readAppEnv } from "../app/env";
import { createDbRuntime } from "../db";
import { AuthService } from "../modules/auth/auth.service";

export type CreateAdminCliArgs = {
	email?: string;
	name?: string;
	password?: string;
	passwordFromStdin: boolean;
};

export function parseCreateAdminArgs(argv: string[]): CreateAdminCliArgs {
	const args: CreateAdminCliArgs = { passwordFromStdin: false };
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (token === "--email") {
			args.email = argv[i + 1];
			i += 1;
			continue;
		}
		if (token === "--name") {
			args.name = argv[i + 1];
			i += 1;
			continue;
		}
		if (token === "--password") {
			args.password = argv[i + 1];
			i += 1;
			continue;
		}
		if (token === "--password-stdin") {
			args.passwordFromStdin = true;
		}
	}
	return args;
}

export async function readCreateAdminPassword(
	args: CreateAdminCliArgs,
	options: {
		stdin?: AsyncIterable<string | Buffer>;
		prompt?: () => Promise<string>;
	} = {},
): Promise<string> {
	if (args.password) {
		return args.password;
	}
	if (args.passwordFromStdin) {
		const chunks: Buffer[] = [];
		for await (const chunk of options.stdin ?? input) {
			chunks.push(Buffer.from(chunk));
		}
		return Buffer.concat(chunks).toString("utf8").trim();
	}

	if (options.prompt) {
		return (await options.prompt()).trim();
	}

	const rl = createInterface({ input, output });
	try {
		return (await rl.question("Password: ")).trim();
	} finally {
		rl.close();
	}
}

export async function runCreateAdminCli(
	argv: string[],
	options: {
		readEnv?: typeof readAppEnv;
		createRuntime?: typeof createDbRuntime;
		readPassword?: typeof readCreateAdminPassword;
		log?: (message: string) => void;
	} = {},
) {
	const args = parseCreateAdminArgs(argv);
	if (!args.email || !args.name) {
		throw new Error("--email and --name are required.");
	}
	const password = await (options.readPassword ?? readCreateAdminPassword)(
		args,
	);
	if (password.length < 8) {
		throw new Error("Password must be at least 8 characters.");
	}

	const env = (options.readEnv ?? readAppEnv)();
	const dbRuntime = await (options.createRuntime ?? createDbRuntime)(env);
	try {
		const authService = new AuthService(dbRuntime.client, env);
		const user = await authService.createAdmin({
			email: args.email,
			displayName: args.name,
			password,
		});
		(options.log ?? console.log)(
			JSON.stringify(
				{
					ok: true,
					user: {
						id: user.id,
						email: user.email,
						displayName: user.displayName,
						role: user.role,
					},
				},
				null,
				2,
			),
		);
		return user;
	} finally {
		await dbRuntime.close();
	}
}

if (import.meta.main) {
	await runCreateAdminCli(process.argv.slice(2));
}
