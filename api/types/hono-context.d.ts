import "hono";

declare module "hono" {
	interface ContextVariableMap {
		requestId?: string;
		authUser?: {
			userId: string;
			email: string;
			role: "admin" | "member";
		};
	}
}
