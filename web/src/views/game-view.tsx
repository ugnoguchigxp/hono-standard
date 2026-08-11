import { Link } from "@tanstack/react-router";
import { ArrowLeft, Gamepad2, Radio } from "lucide-react";
import { useAuth } from "../auth-context";
import { GameLauncher } from "../game/GameLauncher";

export function GameView() {
	const { authUser, authLoading } = useAuth();

	if (authLoading) {
		return (
			<main className="center-shell">
				<div className="muted">Checking session...</div>
			</main>
		);
	}

	if (!authUser) {
		return (
			<main className="center-shell">
				<section className="signed-in-panel">
					<Gamepad2 className="icon" />
					<h1>Login required</h1>
					<p>Your game session and future saves are tied to your account.</p>
					<Link
						to="/login"
						search={{ redirect: "/game" }}
						className="auth-open-button"
					>
						Login
					</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="game-shell">
			<div className="game-utility-bar">
				<Link to="/" className="game-exit-link">
					<ArrowLeft className="icon" />
					Exit to home
				</Link>
				<div className="game-player-signal">
					<Radio className="icon" />
					<span>{authUser.displayName}</span>
					<span aria-hidden="true">·</span>
					<span>Signal linked</span>
				</div>
			</div>
			<GameLauncher key={authUser.email} playerId={authUser.email} />
		</main>
	);
}

export default GameView;
