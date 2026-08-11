import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
	type GameAction,
	gameActionLabels,
	gameActions,
	normalizeKeyboardBinding,
} from "../input/game-actions";
import { gameSettingsStore, useGameSettings } from "./GameSettingsStore";

const percent = (value: number): string => `${Math.round(value * 100)}%`;

function VolumeSlider({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
}) {
	const id = useId();
	return (
		<label className="game-settings-slider" htmlFor={id}>
			<span>{label}</span>
			<input
				id={id}
				type="range"
				min="0"
				max="1"
				step="0.05"
				value={value}
				onChange={(event) => onChange(Number(event.currentTarget.value))}
			/>
			<output htmlFor={id}>{percent(value)}</output>
		</label>
	);
}

export function GameSettingsPanel({
	open,
	onClose,
	onToggleFullscreen,
}: {
	open: boolean;
	onClose: () => void;
	onToggleFullscreen: () => void;
}) {
	const settings = useGameSettings();
	const [capturingAction, setCapturingAction] = useState<GameAction | null>(
		null,
	);
	const panelRef = useRef<HTMLElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const previouslyFocusedRef = useRef<HTMLElement | null>(null);
	const closePanel = useCallback(() => {
		if (previouslyFocusedRef.current?.isConnected) {
			previouslyFocusedRef.current.focus();
		}
		onClose();
	}, [onClose]);

	useEffect(() => {
		if (!open) setCapturingAction(null);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		previouslyFocusedRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeButtonRef.current?.focus();
		return () => {
			document.body.style.overflow = previousOverflow;
			if (previouslyFocusedRef.current?.isConnected) {
				previouslyFocusedRef.current.focus();
			}
			previouslyFocusedRef.current = null;
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Tab") {
				setCapturingAction(null);
				const focusable = [
					...(panelRef.current?.querySelectorAll<HTMLElement>(
						'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
					) ?? []),
				];
				const first = focusable[0];
				const last = focusable.at(-1);
				if (
					(event.shiftKey && document.activeElement === first) ||
					(!event.shiftKey && document.activeElement === last)
				) {
					event.preventDefault();
					(event.shiftKey ? last : first)?.focus();
				}
				return;
			}
			if (capturingAction) {
				const binding = normalizeKeyboardBinding(event.key);
				if (!binding) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				gameSettingsStore.setKeyBinding(capturingAction, binding);
				setCapturingAction(null);
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopImmediatePropagation();
				closePanel();
			}
		};
		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, [capturingAction, closePanel, open]);

	if (!open) return null;

	return (
		<div className="game-settings-backdrop">
			<section
				ref={panelRef}
				className="game-settings-panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="game-settings-title"
			>
				<header>
					<div>
						<p>SYSTEM</p>
						<h2 id="game-settings-title">Game settings</h2>
					</div>
					<button
						ref={closeButtonRef}
						type="button"
						onClick={closePanel}
						aria-label="Close settings"
					>
						Close
					</button>
				</header>

				<div className="game-settings-columns">
					<fieldset>
						<legend>Audio</legend>
						<VolumeSlider
							label="Master"
							value={settings.masterVolume}
							onChange={(masterVolume) =>
								gameSettingsStore.update({ masterVolume })
							}
						/>
						<VolumeSlider
							label="Music"
							value={settings.bgmVolume}
							onChange={(bgmVolume) => gameSettingsStore.update({ bgmVolume })}
						/>
						<VolumeSlider
							label="Effects"
							value={settings.seVolume}
							onChange={(seVolume) => gameSettingsStore.update({ seVolume })}
						/>
						<VolumeSlider
							label="Ambience"
							value={settings.environmentVolume}
							onChange={(environmentVolume) =>
								gameSettingsStore.update({ environmentVolume })
							}
						/>
						<label className="game-settings-check">
							<input
								type="checkbox"
								checked={settings.muted}
								onChange={(event) =>
									gameSettingsStore.update({
										muted: event.currentTarget.checked,
									})
								}
							/>
							Mute all audio
						</label>
					</fieldset>

					<fieldset>
						<legend>Display & accessibility</legend>
						<label>
							<span>Text speed</span>
							<select
								value={settings.textSpeed}
								onChange={(event) =>
									gameSettingsStore.update({
										textSpeed: event.currentTarget
											.value as typeof settings.textSpeed,
									})
								}
							>
								<option value="slow">Slow</option>
								<option value="normal">Normal</option>
								<option value="fast">Fast</option>
								<option value="instant">Instant</option>
							</select>
						</label>
						<label>
							<span>Screen scale</span>
							<select
								value={settings.screenScale}
								onChange={(event) =>
									gameSettingsStore.update({
										screenScale: event.currentTarget
											.value as typeof settings.screenScale,
									})
								}
							>
								<option value="fit">Fit window</option>
								<option value="1">1× (320 × 192)</option>
								<option value="2">2× (640 × 384)</option>
								<option value="3">3× (960 × 576)</option>
							</select>
						</label>
						<label className="game-settings-check">
							<input
								type="checkbox"
								checked={settings.reducedMotion}
								onChange={(event) =>
									gameSettingsStore.update({
										reducedMotion: event.currentTarget.checked,
									})
								}
							/>
							Reduce flashes and battle motion
						</label>
						<label className="game-settings-check">
							<input
								type="checkbox"
								checked={settings.highContrast}
								onChange={(event) =>
									gameSettingsStore.update({
										highContrast: event.currentTarget.checked,
									})
								}
							/>
							High contrast
						</label>
						<button type="button" onClick={onToggleFullscreen}>
							Toggle fullscreen
						</button>
					</fieldset>

					<fieldset>
						<legend>Input</legend>
						<label className="game-settings-check">
							<input
								type="checkbox"
								checked={settings.gamepadEnabled}
								onChange={(event) =>
									gameSettingsStore.update({
										gamepadEnabled: event.currentTarget.checked,
									})
								}
							/>
							Enable gamepad
						</label>
						<label>
							<span>Touch controls</span>
							<select
								value={settings.touchControls}
								onChange={(event) =>
									gameSettingsStore.update({
										touchControls: event.currentTarget
											.value as typeof settings.touchControls,
									})
								}
							>
								<option value="auto">Automatic</option>
								<option value="on">Always show</option>
								<option value="off">Hidden</option>
							</select>
						</label>
						<div className="game-key-bindings">
							{gameActions.map((action) => (
								<div key={action}>
									<span>{gameActionLabels[action]}</span>
									<button
										type="button"
										aria-label={`Change ${gameActionLabels[action]} key`}
										onClick={() => setCapturingAction(action)}
									>
										{capturingAction === action
											? "Press a key…"
											: settings.keyBindings[action].join(" / ")}
									</button>
								</div>
							))}
						</div>
					</fieldset>
				</div>
				<p className="game-settings-capture" role="status" aria-live="polite">
					{capturingAction
						? `Press a key for ${gameActionLabels[capturingAction]}. Tab cancels.`
						: ""}
				</p>
				<footer>
					<p>Keyboard, gamepad, and touch all use the same game actions.</p>
					<button type="button" onClick={() => gameSettingsStore.reset()}>
						Restore defaults
					</button>
				</footer>
			</section>
		</div>
	);
}
