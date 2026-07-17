import type { ReactNode } from "react";
import {
	type Layout,
	Responsive,
	type ResponsiveLayouts,
	useContainerWidth,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
	type DashboardLayouts,
	dashboardBreakpoints,
	dashboardColumns,
} from "./layout";
export function DashboardGridV2({
	layouts,
	editMode,
	onChange,
	children,
}: {
	layouts: DashboardLayouts;
	editMode: boolean;
	onChange: (layouts: DashboardLayouts) => void;
	children: ReactNode;
}) {
	const { width, containerRef, mounted } = useContainerWidth({
		measureBeforeMount: true,
		initialWidth: 1200,
	});
	return (
		<div ref={containerRef} className="dashboard-grid-shell">
			{mounted ? (
				<Responsive
					width={width}
					layouts={layouts as ResponsiveLayouts}
					breakpoints={dashboardBreakpoints}
					cols={dashboardColumns}
					rowHeight={72}
					margin={[16, 16]}
					containerPadding={[0, 0]}
					dragConfig={{
						enabled: editMode,
						bounded: true,
						handle: ".dashboard-panel-drag-handle",
						cancel:
							"button:not(.dashboard-panel-drag-handle), a, select, input, textarea, .dashboard-panel-body, .dashboard-panel-links",
						threshold: 3,
					}}
					resizeConfig={{ enabled: editMode, handles: ["se"] }}
					onLayoutChange={(_layout: Layout, next: ResponsiveLayouts) => {
						if (editMode) onChange(next as DashboardLayouts);
					}}
				>
					{children}
				</Responsive>
			) : (
				<div className="dashboard-grid-measuring">Preparing dashboard…</div>
			)}
		</div>
	);
}
