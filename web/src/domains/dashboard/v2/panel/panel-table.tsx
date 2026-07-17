import type {
	DashboardDataFrameV2,
	PanelManifestV2,
} from "@shared/schemas/dashboard.schema";
import { resolveFieldConfig } from "../runtime/field-config";
import {
	applyValueMapping,
	formatDashboardValue,
} from "../runtime/value-format";
export function PanelTable({
	frames,
	panel,
	timezone = "UTC",
	locale = "en-US",
}: {
	frames: DashboardDataFrameV2[];
	panel: PanelManifestV2;
	timezone?: string;
	locale?: string;
}) {
	const rows = Math.max(
		0,
		...frames.map((frame) => frame.fields[0]?.values.length ?? 0),
	);
	const visibleRows = Math.min(rows, 100);
	const occurrences = new Map<string, number>();
	const rowKeys = Array.from({ length: visibleRows }, (_, row) => {
		const valueKey = frames
			.map((frame) =>
				frame.fields
					.map((field) => JSON.stringify(field.values[row]))
					.join("|"),
			)
			.join("||");
		const occurrence = occurrences.get(valueKey) ?? 0;
		occurrences.set(valueKey, occurrence + 1);
		return { row, key: `row-${valueKey}-${occurrence}` };
	});
	const scrollProps = { tabIndex: 0 as const };
	const showFrameGroups = frames.length > 1;
	return (
		<section
			className="dashboard-table-scroll"
			aria-label={`${panel.accessibleLabel} table`}
			{...scrollProps}
		>
			<table className="dashboard-table">
				<caption>{panel.accessibleLabel}</caption>
				<thead>
					{showFrameGroups ? (
						<tr className="dashboard-table-frame-groups">
							{frames.map((frame) => (
								<th
									key={frame.refId}
									colSpan={frame.fields.length}
									scope="colgroup"
								>
									{frame.name || frame.refId}
								</th>
							))}
						</tr>
					) : null}
					<tr>
						{frames.flatMap((frame) =>
							frame.fields.map((field) => (
								<th key={`${frame.refId}:${field.key}`} scope="col">
									{field.label}
								</th>
							)),
						)}
					</tr>
				</thead>
				<tbody>
					{rowKeys.map(({ row, key }) => {
						return (
							<tr key={key}>
								{frames.flatMap((frame) =>
									frame.fields.map((field) => {
										const config = resolveFieldConfig(panel, frame, field);
										const raw = field.values[row] as unknown;
										const mapping = applyValueMapping(raw, config);
										const missing =
											raw === null ||
											raw === undefined ||
											(typeof raw === "number" && !Number.isFinite(raw));
										return (
											<td
												key={`${frame.refId}:${field.key}`}
												style={{
													textAlign:
														config.textAlign === "auto"
															? undefined
															: config.textAlign,
												}}
											>
												<span
													className={
														missing ? "dashboard-table-missing" : undefined
													}
													title={missing ? "Missing value" : undefined}
												>
													{mapping?.text ??
														formatDashboardValue(
															raw,
															config,
															locale,
															timezone,
															field.type,
														)}
												</span>
											</td>
										);
									}),
								)}
							</tr>
						);
					})}
				</tbody>
			</table>
			{rows > 100 ? (
				<p className="dashboard-panel-warning">Showing the first 100 rows.</p>
			) : null}
		</section>
	);
}
