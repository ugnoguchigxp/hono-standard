import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';

const alertVariants = cva('flex items-center gap-3 px-4 py-3 border rounded transition-colors', {
  variants: {
    variant: {
      default: 'bg-[var(--alert-bg)] border-[var(--alert-border)] text-[var(--alert-text)]',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  message: string;
  onClose?: () => void;
}

export const Alert = React.memo(
  React.forwardRef<HTMLDivElement, AlertProps>(
    ({ message, onClose, className, variant, ...props }, ref) => {
      return (
        <div
          ref={ref}
          className={cn(alertVariants({ variant }), className)}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          {...props}
        >
          <Icon type="circle-alert" className="shrink-0 text-[var(--alert-text)]" />
          <span className="flex-1 text-sm text-[var(--alert-text)]">{message}</span>
          {onClose && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="shrink-0 p-1 rounded text-[var(--alert-text)] hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="閉じる"
            >
              <Icon type="x" size="sm" color="var(--alert-text)" />
            </button>
          )}
        </div>
      );
    }
  )
);

Alert.displayName = 'Alert';
