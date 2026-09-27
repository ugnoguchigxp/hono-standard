// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpatialData } from "./use-spatial-data";

const mocked = vi.hoisted(() => ({ runSession: vi.fn() }));
vi.mock("./spatial-client", async (importOriginal) => ({
	...(await importOriginal<typeof import("./spatial-client")>()),
	runObservatorySession: mocked.runSession,
	abortableDelay: () => Promise.resolve(),
}));

afterEach(() => mocked.runSession.mockReset());

describe("useSpatialData reconnects", () => {
	it("goes offline after repeated failures and retries on demand", async () => {
		mocked.runSession.mockRejectedValue(new Error("network"));
		const { result, unmount } = renderHook(() => useSpatialData());
		await waitFor(() => expect(result.current.status).toBe("offline"));
		expect(mocked.runSession).toHaveBeenCalledTimes(5);

		mocked.runSession.mockImplementation(
			({ signal }: { signal: AbortSignal }) =>
				new Promise((resolve) => signal.addEventListener("abort", resolve)),
		);
		act(() => result.current.retry());
		expect(result.current.status).toBe("loading");
		unmount();
	});

	it("reconnects when a session ends without an error", async () => {
		mocked.runSession.mockResolvedValue(undefined);
		const { result, unmount } = renderHook(() => useSpatialData());
		await waitFor(() => expect(result.current.status).toBe("offline"));
		expect(mocked.runSession).toHaveBeenCalledTimes(5);
		unmount();
	});

	it("stops quietly when unmounted during a failing session", async () => {
		let reject: (error: Error) => void = () => undefined;
		mocked.runSession.mockImplementation(
			() =>
				new Promise((_resolve, rejectSession) => {
					reject = rejectSession;
				}),
		);
		const { result, unmount } = renderHook(() => useSpatialData());
		unmount();
		reject(new Error("aborted"));
		await Promise.resolve();
		expect(result.current.status).toBe("loading");
		expect(mocked.runSession).toHaveBeenCalledTimes(1);
	});
});
