import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameSettingsPanel } from "./GameSettingsPanel";
import { gameSettingsStore } from "./GameSettingsStore";

describe("GameSettingsPanel", () => {
	beforeEach(() => gameSettingsStore.reset());
	afterEach(() => gameSettingsStore.reset());

	it("stays unmounted while closed", () => {
		render(
			<GameSettingsPanel
				open={false}
				onClose={vi.fn()}
				onToggleFullscreen={vi.fn()}
			/>,
		);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("updates every setting and supports keyboard capture", () => {
		const onToggleFullscreen = vi.fn();
		render(
			<GameSettingsPanel
				open
				onClose={vi.fn()}
				onToggleFullscreen={onToggleFullscreen}
			/>,
		);

		for (const [label, value] of [
			["Master", "0.25"],
			["Music", "0.3"],
			["Effects", "0.35"],
			["Ambience", "0.4"],
		] as const) {
			fireEvent.change(screen.getByLabelText(label), { target: { value } });
		}
		fireEvent.click(screen.getByLabelText("Mute all audio"));
		fireEvent.change(screen.getByLabelText("Text speed"), {
			target: { value: "fast" },
		});
		fireEvent.change(screen.getByLabelText("Screen scale"), {
			target: { value: "3" },
		});
		fireEvent.click(screen.getByLabelText("Reduce flashes and battle motion"));
		fireEvent.click(screen.getByLabelText("High contrast"));
		fireEvent.click(screen.getByLabelText("Enable gamepad"));
		fireEvent.change(screen.getByLabelText("Touch controls"), {
			target: { value: "on" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Toggle fullscreen" }));

		expect(gameSettingsStore.getSnapshot()).toMatchObject({
			masterVolume: 0.25,
			bgmVolume: 0.3,
			seVolume: 0.35,
			environmentVolume: 0.4,
			muted: true,
			textSpeed: "fast",
			screenScale: "3",
			reducedMotion: true,
			highContrast: true,
			gamepadEnabled: false,
			touchControls: "on",
		});
		expect(screen.getByText("25%")).toBeVisible();
		expect(onToggleFullscreen).toHaveBeenCalledOnce();

		const changeMoveUp = screen.getByRole("button", {
			name: "Change Move up key",
		});
		fireEvent.click(changeMoveUp);
		expect(changeMoveUp).toHaveTextContent("Press a key…");
		expect(screen.getByText(/Press a key for Move up\./)).toBeVisible();
		fireEvent.keyDown(window, { key: "F1" });
		expect(changeMoveUp).toHaveTextContent("Press a key…");
		fireEvent.keyDown(window, { key: "q" });
		expect(gameSettingsStore.getSnapshot().keyBindings.UP).toEqual(["Q"]);
		expect(screen.queryByText(/Press a key for Move up\./)).toBeNull();

		fireEvent.click(
			screen.getByRole("button", { name: "Change Move down key" }),
		);
		fireEvent.keyDown(window, { key: "Tab" });
		expect(screen.queryByText(/Press a key for Move down\./)).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
		expect(gameSettingsStore.getSnapshot().masterVolume).toBe(0.8);
	});

	it("traps focus, restores the opener, and closes with Escape or the button", () => {
		const opener = document.createElement("button");
		document.body.append(opener);
		opener.focus();
		const onClose = vi.fn();
		const view = render(
			<GameSettingsPanel open onClose={onClose} onToggleFullscreen={vi.fn()} />,
		);
		const close = screen.getByRole("button", { name: "Close settings" });
		const restore = screen.getByRole("button", { name: "Restore defaults" });
		expect(close).toHaveFocus();
		expect(document.body.style.overflow).toBe("hidden");

		restore.focus();
		fireEvent.keyDown(window, { key: "Tab" });
		expect(close).toHaveFocus();
		fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
		expect(restore).toHaveFocus();
		screen.getByLabelText("Text speed").focus();
		fireEvent.keyDown(window, { key: "Tab" });

		fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalledOnce();
		expect(opener).toHaveFocus();
		fireEvent.click(close);
		expect(onClose).toHaveBeenCalledTimes(2);

		view.rerender(
			<GameSettingsPanel
				open={false}
				onClose={onClose}
				onToggleFullscreen={vi.fn()}
			/>,
		);
		expect(document.body.style.overflow).toBe("");
		opener.remove();
	});
});
