import type { Action3dEvent } from "@shared/action3d";

export class Action3dAudioBus {
	private context: AudioContext | null = null;

	play(type: Action3dEvent["type"], muted: boolean): void {
		if (muted || typeof AudioContext === "undefined") return;
		try {
			this.context ??= new AudioContext();
			if (this.context.state === "suspended") void this.context.resume();
			const oscillator = this.context.createOscillator();
			const gain = this.context.createGain();
			const frequency =
				type === "enemy-hit"
					? 210
					: type === "player-hit"
						? 92
						: type === "enemy-defeated"
							? 340
							: type === "victory"
								? 520
								: 72;
			oscillator.type = type === "victory" ? "sine" : "triangle";
			oscillator.frequency.value = frequency;
			gain.gain.setValueAtTime(0.045, this.context.currentTime);
			gain.gain.exponentialRampToValueAtTime(
				0.000_1,
				this.context.currentTime + 0.12,
			);
			oscillator.connect(gain).connect(this.context.destination);
			oscillator.start();
			oscillator.stop(this.context.currentTime + 0.12);
		} catch {
			// Audio feedback is optional and never changes the simulation result.
		}
	}

	dispose(): void {
		if (this.context) void this.context.close();
		this.context = null;
	}
}
