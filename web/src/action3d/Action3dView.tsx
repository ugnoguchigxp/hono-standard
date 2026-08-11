import { Link } from "@tanstack/react-router";
import { Box } from "lucide-react";
import { useAuth } from "../auth-context";
import { Action3dLauncher } from "./Action3dLauncher";

export default function Action3dView() {
	const { authUser, authLoading } = useAuth();

	if (authLoading) {
		return (
			<main className="center-shell">
				<div className="muted" role="status">
					Preparing Action3D session...
				</div>
			</main>
		);
	}

	if (!authUser) {
		return (
			<main className="center-shell">
				<section className="signed-in-panel">
					<Box className="icon" />
					<h1>Login required</h1>
					<p>
						The Action3D field and its future saves are tied to your account.
					</p>
					<Link
						to="/login"
						search={{ redirect: "/games/action-3d" }}
						className="auth-open-button"
					>
						Login
					</Link>
				</section>
			</main>
		);
	}

	return <Action3dLauncher playerId={authUser.email} />;
}
