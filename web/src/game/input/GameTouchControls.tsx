import { dispatchVirtualGameInput, type GameAction } from "./game-actions";

const TouchButton = ({
	action,
	label,
	className = "",
}: {
	action: GameAction;
	label: string;
	className?: string;
}) => {
	const release = () => dispatchVirtualGameInput(action, false);
	return (
		<button
			type="button"
			className={className}
			aria-label={label}
			onContextMenu={(event) => event.preventDefault()}
			onPointerDown={(event) => {
				event.preventDefault();
				event.currentTarget.setPointerCapture(event.pointerId);
				dispatchVirtualGameInput(action, true);
			}}
			onPointerUp={release}
			onPointerCancel={release}
			onLostPointerCapture={release}
		>
			{label}
		</button>
	);
};

export function GameTouchControls({ mode }: { mode: "auto" | "on" | "off" }) {
	if (mode === "off") return null;
	return (
		<div className={`game-touch-controls game-touch-controls-${mode}`}>
			<fieldset className="game-touch-dpad">
				<legend className="sr-only">Movement controls</legend>
				<TouchButton action="UP" label="Up" className="touch-up" />
				<TouchButton action="LEFT" label="Left" className="touch-left" />
				<TouchButton action="RIGHT" label="Right" className="touch-right" />
				<TouchButton action="DOWN" label="Down" className="touch-down" />
			</fieldset>
			<fieldset className="game-touch-actions">
				<legend className="sr-only">Action controls</legend>
				<TouchButton action="MENU" label="Menu" className="touch-menu" />
				<TouchButton action="CANCEL" label="Cancel" className="touch-cancel" />
				<TouchButton
					action="CONFIRM"
					label="Confirm"
					className="touch-confirm"
				/>
			</fieldset>
		</div>
	);
}
