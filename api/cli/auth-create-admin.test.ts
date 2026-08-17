import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";
import type { DbRuntime } from "../db";

const readAppEnv = vi.fn();
const createDbRuntime = vi.fn();
const createAdmin = vi.fn();
const createInterface = vi.fn();

vi.mock("../app/env", () => ({
	readAppEnv,
}));

vi.mock("../db", () => ({
	createDbRuntime,
}));

vi.mock("../modules/auth/auth.service", () => ({
	AuthService: class {
		createAdmin = createAdmin;
	},
}));

vi.mock("node:readline/promises", () => ({
	createInterface,
}));

describe("create-admin CLI", () => {
	beforeEach(() => {
		readAppEnv.mockReset();
		createDbRuntime.mockReset();
		createAdmin.mockReset();
		createInterface.mockReset();
	});

	it("parses CLI flags", async () => {
		const { parseCreateAdminArgs } = await import("./auth-create-admin");
		expect(
			parseCreateAdminArgs([
				"--email",
				"admin@example.com",
				"--name",
				"Admin User",
				"--password",
				"password123456",
				"--ignored",
			]),
		).toEqual({
			email: "admin@example.com",
			name: "Admin User",
			password: "password123456",
			passwordFromStdin: false,
		});
		expect(parseCreateAdminArgs(["--password-stdin"])).toEqual({
			passwordFromStdin: true,
		});
	});

	it("reads the password from flags, stdin, prompt, and readline", async () => {
		const { readCreateAdminPassword } = await import("./auth-create-admin");

		await expect(
			readCreateAdminPassword({
				password: "password123456",
				passwordFromStdin: false,
			}),
		).resolves.toBe("password123456");

		async function* stdin() {
			yield "from-stdin-password\n";
		}
		await expect(
			readCreateAdminPassword({ passwordFromStdin: true }, { stdin: stdin() }),
		).resolves.toBe("from-stdin-password");

		await expect(
			readCreateAdminPassword(
				{ passwordFromStdin: false },
				{ prompt: async () => " prompted-password " },
			),
		).resolves.toBe("prompted-password");

		const question = vi.fn().mockResolvedValue("readline-password");
		const close = vi.fn();
		createInterface.mockReturnValue({ question, close });
		await expect(
			readCreateAdminPassword({ passwordFromStdin: false }),
		).resolves.toBe("readline-password");
		expect(close).toHaveBeenCalled();
	});

	it("creates an admin user and always closes the database", async () => {
		const { runCreateAdminCli } = await import("./auth-create-admin");
		const close = vi.fn();
		createDbRuntime.mockReturnValue({
			client: {},
			close,
		} as unknown as DbRuntime);
		readAppEnv.mockReturnValue({ jwtSecret: "x".repeat(32) } as AppEnv);
		createAdmin.mockResolvedValue({
			id: "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1",
			email: "admin@example.com",
			displayName: "Admin User",
			role: "admin",
		});
		const log = vi.fn();

		await runCreateAdminCli(
			[
				"--email",
				"admin@example.com",
				"--name",
				"Admin User",
				"--password",
				"password123456",
			],
			{ log },
		);

		expect(createAdmin).toHaveBeenCalledWith({
			email: "admin@example.com",
			displayName: "Admin User",
			password: "password123456",
		});
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining('"email": "admin@example.com"'),
		);
		expect(close).toHaveBeenCalled();
	});

	it("closes the database when admin creation fails", async () => {
		const { runCreateAdminCli } = await import("./auth-create-admin");
		const close = vi.fn();
		createDbRuntime.mockReturnValue({
			client: {},
			close,
		} as unknown as DbRuntime);
		readAppEnv.mockReturnValue({ jwtSecret: "x".repeat(32) } as AppEnv);
		createAdmin.mockRejectedValue(new Error("email in use"));

		await expect(
			runCreateAdminCli(
				[
					"--email",
					"admin@example.com",
					"--name",
					"Admin User",
					"--password",
					"password123456",
				],
				{ log: vi.fn() },
			),
		).rejects.toThrow("email in use");
		expect(close).toHaveBeenCalled();
	});

	it("requires email, name, and a long enough password", async () => {
		const { runCreateAdminCli } = await import("./auth-create-admin");
		await expect(
			runCreateAdminCli(["--email", "admin@example.com"]),
		).rejects.toThrow("--email and --name are required.");
		await expect(
			runCreateAdminCli([
				"--email",
				"admin@example.com",
				"--name",
				"Admin",
				"--password",
				"short",
			]),
		).rejects.toThrow("Password must be at least 8 characters.");
	});
});
