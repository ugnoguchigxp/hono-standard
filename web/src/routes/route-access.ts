const sessionCheckedPathPrefixes = [
	"/protected",
	"/game",
	"/games/action-3d",
] as const;

export function requiresSessionCheck(pathname: string): boolean {
	return (
		pathname === "/login" ||
		sessionCheckedPathPrefixes.some(
			(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
		)
	);
}
