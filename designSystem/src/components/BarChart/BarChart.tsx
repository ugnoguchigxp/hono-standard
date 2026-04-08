import * as React from 'react';
import { Icon } from '@/components/Icon';
import { Tooltip, TooltipProvider } from '@/components/Tooltip';
import { cn } from '@/utils/cn';

// Types
export interface BarChartDataItem {
  label: string;
  value: number;
}

export interface BarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: BarChartDataItem[];
  activeIndex?: number;
  onBarClick?: (index: number) => void;
}

const BarChart = React.memo(
  React.forwardRef<HTMLDivElement, BarChartProps>(
    ({ data, activeIndex, onBarClick, className, ...props }, ref) => {
      const containerRef = React.useRef<HTMLDivElement>(null);
      const [containerHeight, setContainerHeight] = React.useState(0);

      const updateHeight = React.useCallback(() => {
        if (containerRef.current) {
          const height = containerRef.current.clientHeight;
          setContainerHeight(height);
        }
      }, []);

      React.useEffect(() => {
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
      }, [updateHeight]);

      const maxValue = React.useMemo(() => Math.max(...data.map((item) => item.value), 1), [data]);

      return (
        <div ref={ref} className={cn('inline-flex flex-col', className)} {...props}>
          {/* Chart Container */}
          <TooltipProvider>
            <div
              ref={containerRef}
              className={cn('relative h-21 flex items-end justify-between min-w-73 px-5.5')}
            >
              {data.map((item, index) => {
                const barHeight =
                  containerHeight > 0 ? (item.value / maxValue) * containerHeight : 0;
                const isActive = activeIndex === index;

                return (
                  <Tooltip
                    key={`${item.label}-${index}`}
                    content={item.value}
                    side="top"
                    align="center"
                    showArrow={false}
                  >
                    <button
                      type="button"
                      data-index={index}
                      className={cn(
                        'flex flex-col items-center justify-end cursor-pointer border-0 bg-transparent p-0'
                      )}
                      onClick={() => onBarClick?.(index)}
                    >
                      <div
                        className={cn(
                          'w-6 transition-all duration-200',
                          isActive ? 'bg-bar-chart-active' : 'bg-bar-chart-inactive'
                        )}
                        style={{ height: barHeight }}
                      />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>

          {/* X-axis with arrow */}
          <div className={cn('relative h-px bg-bar-chart-axis')}>
            <Icon
              type="chevron-right"
              size="sm"
              className={cn('absolute -right-1.5 top-1/2 -translate-y-1/2 text-bar-chart-axis')}
            />
          </div>

          {/* Labels */}
          <div className={cn('flex items-center justify-between px-5.5')}>
            {data.map((item, index) => {
              const isActive = activeIndex === index;
              return (
                <div key={`label-${item.label}-${index}`} className={cn('text-center w-6')}>
                  <span
                    className={cn(
                      'text-base font-semibold transition-colors',
                      isActive ? 'text-bar-chart-label-active' : 'text-bar-chart-inactive'
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  )
);
BarChart.displayName = 'BarChart';

export { BarChart };
