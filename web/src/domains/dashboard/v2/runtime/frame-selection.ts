import type {
	DashboardDataFrameV2,
	PanelManifestV2,
} from "@shared/schemas/dashboard.schema";
export function selectPanelFrames(
	panel: Pick<PanelManifestV2, "visualization">,
	frames: DashboardDataFrameV2[],
) {
	const byRef = new Map(frames.map((frame) => [frame.refId, frame]));
	return panel.visualization.frameRefs.flatMap((ref) => {
		const frame = byRef.get(ref);
		return frame ? [frame] : [];
	});
}
export function frameRowCount(frame: DashboardDataFrameV2) {
	return frame.fields[0]?.values.length ?? 0;
}
