import { Progress } from '@base-ui/react';
import * as React from 'react';
import { PercentFormat } from '@/components/NumberFormat';
import { cn } from '@/utils/cn';

export interface ProgressBarProps extends React.ComponentPropsWithoutRef<typeof Progress.Root> {
  value: number;
  label?: React.ReactNode;
  subLabel?: React.ReactNode;
  height?: string;
  color?: string;
  striped?: boolean;
  animated?: boolean;
  status?: 'normal' | 'paused' | 'error';
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      className,
      value,
      label,
      subLabel,
      height = 'h-[var(--ui-progress-height)]',
      color,
      striped = true,
      animated = true,
      status = 'normal',
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max(value || 0, 0), 100);

    const getProgressStyle = () => {
      if (color) return { className: color };

      if (status === 'paused') return { className: 'bg-warning' };
      if (status === 'error') return { className: 'bg-destructive' };

      return { className: 'bg-primary' };
    };

    const { className: colorClass } = getProgressStyle();

    return (
      <div className="w-full">
        {(label || subLabel) && (
          <div className="flex justify-between mb-1 text-sm">
            <div className="font-medium text-foreground">{label}</div>
            <div className="text-muted-foreground">{subLabel}</div>
          </div>
        )}
        <Progress.Root
          ref={ref}
          className={cn('relative w-full overflow-hidden rounded-full bg-card', height, className)}
          value={value}
          {...props}
        >
          <Progress.Track className="h-full w-full">
            <Progress.Indicator
              className={cn(
                'h-full transition-all duration-500 ease-out flex items-center justify-end pr-2',
                colorClass,
                striped &&
                  'bg-[linear-gradient(45deg,hsl(var(--primary-foreground)/0.15)_25%,transparent_25%,transparent_50%,hsl(var(--primary-foreground)/0.15)_50%,hsl(var(--primary-foreground)/0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem]',
                animated && 'animate-progress-stripes'
              )}
              style={{
                width: `${percentage}%`,
              }}
            >
              {/* Optional: Show percentage inside bar if tall enough */}
              {height !== 'h-1' && height !== 'h-2' && (
                <PercentFormat
                  value={percentage}
                  valueScale="percent"
                  options={{ maximumFractionDigits: 0 }}
                  className="text-[10px] font-bold text-white drop-shadow-md opacity-80 pe-1"
                />
              )}
            </Progress.Indicator>
          </Progress.Track>
        </Progress.Root>
      </div>
    );
  }
);
ProgressBar.displayName = 'ProgressBar';

export { ProgressBar };
