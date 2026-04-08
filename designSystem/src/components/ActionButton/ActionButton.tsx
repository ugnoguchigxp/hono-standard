import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Icon, type iconMap } from '@/components/Icon';
import { cn } from '@/utils/cn';

const actionButtonVariants = cva([
  'relative flex flex-col items-center justify-center gap-1',
  'rounded-lg p-4',
  'bg-action-button text-button-text hover:bg-action-button-hover active:bg-action-button-hover',
  'shadow-[0_0_15px_-3px_hsl(var(--action-button-shadow))]',
  'transition-all duration-200',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
]);

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon key from iconMap */
  icon?: keyof typeof iconMap;
  /** Label text to display */
  label?: string;
  /** Active state with notification badge */
  active?: boolean;
  /** Orientation of the layout */
  orientation?: 'horizontal' | 'vertical';
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    { className, icon, label, active = false, orientation = 'vertical', children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          actionButtonVariants(),
          orientation === 'horizontal' ? 'flex-row gap-2' : 'flex-col gap-1',
          className
        )}
        {...props}
      >
        {/* Notification Badge - TODO: Replace with Badge component */}
        {active && <span className="absolute top-4 right-9 h-3 w-3 rounded-full bg-destructive" />}

        {/* Icon */}
        {icon && <Icon type={icon} className="h-8 w-8" />}

        {/* Label */}
        {label && <span className="text-xs font-semibold whitespace-nowrap">{label}</span>}

        {children}
      </button>
    );
  }
);

ActionButton.displayName = 'ActionButton';

export { ActionButton, actionButtonVariants };
