import { useRef } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BrowserGameRuntimeFactory } from "./browser-game-runtime";
import { useBrowserGameRuntime } from "./use-browser-game-runtime";

function RuntimeHarness({
	createRuntime,
	onStartError,
	renderHost = true,
}: {
	createRuntime: BrowserGameRuntimeFactory;
	onStartError?: (error: unknown) => void;
	renderHost?: boolean;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	useBrowserGameRuntime({ hostRef, createRuntime, onStartError });
	return renderHost ? <div ref={hostRef} data-testid="runtime-host" /> : null;
}

describe("useBrowserGameRuntime", () => {
	it("starts and disposes one runtime with an abortable lifecycle", async () => {
		let startSignal: AbortSignal | undefined;
		const dispose = vi.fn();
		const start = vi.fn((_host: HTMLElement, signal: AbortSignal) => {
			startSignal = signal;
		});
		const view = render(
			<RuntimeHarness createRuntime={() => ({ start, dispose })} />,
		);

		await waitFor(() => expect(start).toHaveBeenCalledOnce());
		expect(start.mock.calls[0][0]).toHaveAttribute(
			"data-testid",
			"runtime-host",
		);
		expect(startSignal?.aborted).toBe(false);

		view.unmount();
		expect(startSignal?.aborted).toBe(true);
		expect(dispose).toHaveBeenCalledOnce();
	});

	it("reports synchronous factory and asynchronous startup failures", async () => {
		const onStartError = vi.fn();
		const factoryError = new Error("factory failed");
		const startError = new Error("start failed");
		const first = render(
			<RuntimeHarness
				createRuntime={() => {
					throw factoryError;
				}}
				onStartError={onStartError}
			/>,
		);
		expect(onStartError).toHaveBeenCalledWith(factoryError);
		first.unmount();

		const dispose = vi.fn();
		const second = render(
			<RuntimeHarness
				createRuntime={() => ({
					start: async () => {
						throw startError;
					},
					dispose,
				})}
				onStartError={onStartError}
			/>,
		);
		await waitFor(() => expect(onStartError).toHaveBeenCalledWith(startError));
		second.unmount();
		expect(dispose).toHaveBeenCalledOnce();
	});

	it("ignores a late startup failure after cleanup", async () => {
		let rejectStart: ((error: Error) => void) | undefined;
		const onStartError = vi.fn();
		const dispose = vi.fn();
		const view = render(
			<RuntimeHarness
				createRuntime={() => ({
					start: () =>
						new Promise<void>((_resolve, reject) => {
							rejectStart = reject;
						}),
					dispose,
				})}
				onStartError={onStartError}
			/>,
		);

		await waitFor(() => expect(rejectStart).toBeTypeOf("function"));
		view.unmount();
		rejectStart?.(new Error("late failure"));
		await Promise.resolve();
		expect(dispose).toHaveBeenCalledOnce();
		expect(onStartError).not.toHaveBeenCalled();
	});

	it("does not create a runtime when no host is rendered", () => {
		const createRuntime = vi.fn();
		render(<RuntimeHarness createRuntime={createRuntime} renderHost={false} />);
		expect(createRuntime).not.toHaveBeenCalled();
	});
});
