import { cva } from 'class-variance-authority';
import * as React from 'react';
import { BarChart } from '@/components/BarChart';
import { ScoreIcon, type ScoreType } from '@/components/ScoreIcon';
import { TooltipProvider } from '@/components/Tooltip';
import { type ViewOption, ViewSwitcher } from '@/components/ViewSwitcher';
import { cn } from '@/utils/cn';

const rankChartVariants = cva(['flex flex-col items-center', 'py-4 gap-4', 'w-[494px]']);

export interface RankChartProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current score (A-E) */
  score: ScoreType;
  /** Bar chart data for ranks */
  rankData: Array<{ label: string; value: number }>;
  /** View switcher options */
  viewOptions: ViewOption[];
  /** Current view value */
  currentView: string;
  /** View change handler */
  onViewChange: (value: string) => void;
}

const RankChart = React.memo(
  React.forwardRef<HTMLDivElement, RankChartProps>(
    ({ className, score, rankData, viewOptions, currentView, onViewChange, ...props }, ref) => {
      // Find the active index based on score
      const activeIndex = React.useMemo(
        () => rankData.findIndex((item) => item.label === score),
        [rankData, score]
      );

      return (
        <TooltipProvider>
          <div ref={ref} className={cn(rankChartVariants(), className)} {...props}>
            {/* Score Icon */}
            <ScoreIcon score={score} />

            {/* Bar Chart */}
            <BarChart data={rankData} activeIndex={activeIndex} className="w-73 h-27" />

            {/* View Switcher */}
            <ViewSwitcher
              options={viewOptions}
              value={currentView}
              onChange={onViewChange}
              className="w-full h-8"
            />
          </div>
        </TooltipProvider>
      );
    }
  )
);
RankChart.displayName = 'RankChart';

export { RankChart, rankChartVariants };
