import type {
	PanelManifestV2,
	PanelQueryRequestV2,
	PanelQueryResponseV2,
} from "@shared/schemas/dashboard.schema";
import { useMemo, useState } from "react";
import { sanitizeInspectorResponse, sanitizeInspectorValue } from "./sanitize";

const tabs = [
	"Overview",
	"Request",
	"Frames",
	"Transformations",
	"Visualization",
	"Error",
] as const;
type InspectorTab = (typeof tabs)[number];

export function DashboardInspector({
	panel,
	response,
	request,
	error,
	onClose,
}: {
	panel: PanelManifestV2;
	response?: PanelQueryResponseV2;
	request?: PanelQueryRequestV2;
	error?: Error | null;
	onClose: () => void;
}) {
	const safe = sanitizeInspectorResponse(response);
	const [tab, setTab] = useState<InspectorTab>("Overview");
	const tabValue = useMemo(() => {
		switch (tab) {
			case "Overview":
				return safe;
			case "Request":
				return sanitizeInspectorValue(request ?? null);
			case "Frames":
				return safe?.frames ?? [];
			case "Transformations":
				return sanitizeInspectorValue(panel.transformations);
			case "Visualization":
				return sanitizeInspectorValue(panel.visualization);
			case "Error":
				return sanitizeInspectorValue({ message: error?.message ?? null });
		}
	}, [
		error?.message,
		panel.transformations,
		panel.visualization,
		request,
		safe,
		tab,
	]);
	return (
		<aside className="dashboard-inspector" aria-label="Query inspector">
			<div className="dashboard-inspector-header">
				<h2>{panel.title} inspector</h2>
				<button type="button" onClick={onClose} aria-label="Close inspector">
					×
				</button>
			</div>
			<div
				className="dashboard-inspector-tabs"
				role="tablist"
				aria-label="Inspector sections"
			>
				{tabs.map((item) => (
					<button
						type="button"
						role="tab"
						key={item}
						aria-selected={tab === item}
						onClick={() => setTab(item)}
					>
						{item}
					</button>
				))}
			</div>
			{tab === "Overview" ? (
				<dl>
					<div className="dashboard-inspector-row">
						<dt>Panel</dt>
						<dd>{panel.id}</dd>
					</div>
					<div className="dashboard-inspector-row">
						<dt>Request ID</dt>
						<dd>{safe?.requestId ?? "—"}</dd>
					</div>
					<div className="dashboard-inspector-row">
						<dt>Duration</dt>
						<dd>{safe ? `${safe.durationMs} ms` : "—"}</dd>
					</div>
					<div className="dashboard-inspector-row">
						<dt>Frames / rows</dt>
						<dd>
							{safe ? `${safe.counts.frames} / ${safe.counts.rows}` : "—"}
						</dd>
					</div>
				</dl>
			) : (
				<pre className="dashboard-inspector-json">
					{JSON.stringify(tabValue, null, 2)}
				</pre>
			)}
			<button
				type="button"
				className="dashboard-inspector-copy"
				onClick={() =>
					void navigator.clipboard?.writeText(JSON.stringify(tabValue, null, 2))
				}
			>
				Copy sanitized JSON
			</button>
			<p>Development metadata only. Sensitive values are omitted.</p>
		</aside>
	);
}
