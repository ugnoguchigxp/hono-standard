import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';

// Constants
const DIRECTION_ICONS = {
  UP: 'arrow-up' as const,
  DOWN: 'arrow-down' as const,
  NEUTRAL: 'arrow-right' as const,
} as const;

// Calculation functions
const getChangeColor = (valueChange: number | undefined): string => {
  if (valueChange === undefined) return 'text-table-text';
  if (valueChange > 0) return 'text-table-success';
  if (valueChange < 0) return 'text-table-error';
  return 'text-table-neutral-zero';
};

const getDirectionIcon = (
  valueChange: number | undefined
): (typeof DIRECTION_ICONS)[keyof typeof DIRECTION_ICONS] | null => {
  if (valueChange === undefined) return null;
  if (valueChange > 0) return DIRECTION_ICONS.UP;
  if (valueChange < 0) return DIRECTION_ICONS.DOWN;
  return DIRECTION_ICONS.NEUTRAL;
};

const formatChangeValue = (
  valueChange: number,
  valueUnit?: string,
  valueChangeUnit?: string
): string => {
  if (valueChange === 0) {
    const unit = valueChangeUnit || valueUnit || '';
    return `±0${unit}`;
  }
  const absValue = Math.abs(valueChange);
  const unit = valueChangeUnit || valueUnit || '';
  return `${absValue}${unit}`;
};

const scoreTableVariants = cva('w-full');

const scoreTableRowVariants = cva('flex items-center justify-between py-2 text-sm max-w-[490px]', {
  variants: {
    variant: {
      default: '',
      separator: 'border-t border-border pt-4 mt-2',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface ScoreTableProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof scoreTableVariants> {}

export interface ScoreTableRowProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof scoreTableRowVariants> {
  /** Label text (left side) */
  label: string;
  /** Sub-label text (left side, automatically wrapped in parentheses) */
  subLabel?: string;
  /** Show help icon (left side) */
  showHelp?: boolean;
  /** Help icon click handler */
  onHelpClick?: () => void;
  /** Value to display (right side) */
  value: string | number;
  /** Unit for value (e.g., "点", "位") */
  valueUnit?: string;
  /** Value label (right side, text without change indicator) */
  valueLabel?: string;
  /** Change value (positive for up, negative for down, 0 for neutral) */
  valueChange?: number;
  /** Unit for value change (defaults to valueUnit if not specified) */
  valueChangeUnit?: string;
}

const ScoreTable = React.memo(
  React.forwardRef<HTMLDivElement, ScoreTableProps>(({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(scoreTableVariants(), className)} {...props}>
        {children}
      </div>
    );
  })
);
ScoreTable.displayName = 'ScoreTable';

const ScoreTableRow = React.memo(
  React.forwardRef<HTMLDivElement, ScoreTableRowProps>(
    (
      {
        className,
        variant,
        label,
        subLabel,
        showHelp = false,
        onHelpClick,
        value,
        valueUnit,
        valueLabel,
        valueChange,
        valueChangeUnit,
        ...props
      },
      ref
    ) => {
      const changeColor = React.useMemo(() => getChangeColor(valueChange), [valueChange]);
      const directionIcon = React.useMemo(() => getDirectionIcon(valueChange), [valueChange]);
      const formattedChange = React.useMemo(
        () =>
          valueChange !== undefined
            ? formatChangeValue(valueChange, valueUnit, valueChangeUnit)
            : null,
        [valueChange, valueUnit, valueChangeUnit]
      );

      return (
        <div ref={ref} className={cn(scoreTableRowVariants({ variant }), className)} {...props}>
          {/* Left side: Label + SubLabel + Help Icon */}
          <div className="flex items-center">
            <span className="font-bold text-table-label">{label}</span>
            {subLabel && <span className="text-sm text-table-neutral">（{subLabel}）</span>}
            {showHelp && onHelpClick && (
              <button
                type="button"
                onClick={onHelpClick}
                className="flex items-center justify-center transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Help"
              >
                <Icon type="circle-help" className="text-help-icon" />
              </button>
            )}
          </div>

          {/* Right side: Value + ValueLabel/Change */}
          <div className="flex items-center">
            <span className="font-medium text-table-text">
              {value}
              {valueUnit}
            </span>
            {valueLabel && <span className="text-sm text-table-text">（{valueLabel}）</span>}
            {valueChange !== undefined && formattedChange && (
              <span className="flex items-center gap-0.5 text-sm text-table-text">
                （
                <span className={cn('flex items-center gap-0.5', changeColor)}>
                  {formattedChange}
                  {directionIcon && <Icon type={directionIcon} size="sm" className={changeColor} />}
                </span>
                ）
              </span>
            )}
          </div>
        </div>
      );
    }
  )
);
ScoreTableRow.displayName = 'ScoreTableRow';

export { ScoreTable, ScoreTableRow, scoreTableRowVariants, scoreTableVariants };
