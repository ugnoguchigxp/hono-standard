export function composeAbortSignals(signals: AbortSignal[]): {
	signal: AbortSignal;
	dispose: () => void;
} {
	const controller = new AbortController();
	const listeners: Array<() => void> = [];
	const abort = (signal: AbortSignal) => {
		if (!controller.signal.aborted) controller.abort(signal.reason);
	};
	for (const signal of signals) {
		if (signal.aborted) abort(signal);
		const listener = () => abort(signal);
		signal.addEventListener("abort", listener, { once: true });
		listeners.push(() => signal.removeEventListener("abort", listener));
	}
	return {
		signal: controller.signal,
		dispose: () => {
			for (const remove of listeners) remove();
		},
	};
}

export function timeoutSignal(timeoutMs: number): {
	signal: AbortSignal;
	dispose: () => void;
} {
	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(new Error("timeout")),
		timeoutMs,
	);
	return { signal: controller.signal, dispose: () => clearTimeout(timer) };
}

export type DashboardAbortReason =
	| { kind: "request" }
	| { kind: "handler-timeout" }
	| { kind: "panel-timeout" }
	| { kind: "transformation-timeout" };

export function abortReason(
	kind: DashboardAbortReason["kind"],
): DashboardAbortReason {
	return { kind };
}

export function getAbortKind(
	signal: AbortSignal,
): DashboardAbortReason["kind"] | undefined {
	const reason = signal.reason as Partial<DashboardAbortReason> | undefined;
	return reason && typeof reason === "object" && "kind" in reason
		? (reason.kind as DashboardAbortReason["kind"])
		: undefined;
}

export function raceDashboardOperation<T>(
	promise: Promise<T>,
	options: {
		signal: AbortSignal;
		timeoutMs?: number;
		onLateSettlement?: (outcome: "fulfilled" | "rejected") => void;
	},
): Promise<T> {
	const timeout =
		options.timeoutMs === undefined
			? undefined
			: timeoutSignal(options.timeoutMs);
	const composed = composeAbortSignals([
		options.signal,
		...(timeout ? [timeout.signal] : []),
	]);
	return new Promise<T>((resolve, reject) => {
		let settled = false;
		const finish = (action: () => void) => {
			if (settled) return;
			settled = true;
			composed.dispose();
			timeout?.dispose();
			action();
		};
		const onAbort = () =>
			finish(() => reject(composed.signal.reason ?? new Error("aborted")));
		const late = (outcome: "fulfilled" | "rejected") => {
			if (!settled) return false;
			try {
				options.onLateSettlement?.(outcome);
			} catch {
				// Observability callbacks must not affect operation settlement.
			}
			return true;
		};
		if (composed.signal.aborted) onAbort();
		else composed.signal.addEventListener("abort", onAbort, { once: true });
		promise.then(
			(value) => {
				if (!late("fulfilled")) finish(() => resolve(value));
			},
			(error) => {
				if (!late("rejected")) finish(() => reject(error));
			},
		);
	});
}

export function throwIfAborted(signal: AbortSignal) {
	if (signal.aborted)
		throw signal.reason instanceof Error ? signal.reason : new Error("aborted");
}
