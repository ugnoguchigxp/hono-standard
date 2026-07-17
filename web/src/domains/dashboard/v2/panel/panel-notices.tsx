import type { DashboardNoticeV2 } from "@shared/schemas/dashboard.schema";
export function PanelNotices({ notices }: { notices: DashboardNoticeV2[] }) {
	return notices.length ? (
		<ul className="dashboard-panel-notices" aria-label="Panel notices">
			{notices.map((notice) => (
				<li
					key={`${notice.code}:${notice.frameRefId ?? ""}:${notice.fieldKey ?? ""}:${notice.message}`}
					data-severity={notice.severity}
				>
					{notice.message}
				</li>
			))}
		</ul>
	) : null;
}
