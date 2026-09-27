// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { ObservatoryHttpError } from "./spatial-client";
import { useSpatialData } from "./use-spatial-data";

const mocked = vi.hoisted(() => ({ runSession: vi.fn() }));
vi.mock("./spatial-client", async (importOriginal) => ({
	...(await importOriginal<typeof import("./spatial-client")>()),
	runObservatorySession: mocked.runSession,
}));

describe("useSpatialData", () => {
	it("removes previously visible state when authentication expires", async () => {
		const snapshot = new MockSignalSimulator({ seed: 42, initialTime: 1_700_000_000_000 }).snapshot();
		let rejectSession: (error: Error) => void = () => undefined;
		mocked.runSession.mockImplementation(({ onData, onLive }: { onData: (data: unknown) => void; onLive: () => void }) => {
			onData({ snapshot, events: [], lastSequence: 0 });
			onLive();
			return new Promise((_resolve, reject) => { rejectSession = reject; });
		});
		const { result, unmount } = renderHook(() => useSpatialData());
		await waitFor(() => expect(result.current.status).toBe("live"));
		expect(result.current.data?.snapshot.instanceId).toBe(snapshot.instanceId);
		act(() => rejectSession(new ObservatoryHttpError(401)));
		await waitFor(() => expect(result.current.status).toBe("unauthorized"));
		expect(result.current.data).toBeNull();
		unmount();
	});
});
