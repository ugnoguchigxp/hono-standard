import * as React from 'react';
import { cn } from '@/utils/cn';

interface ToggleGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ value, onValueChange, className, children }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        className={cn(
          'inline-flex items-center justify-center w-full',
          'h-[calc(var(--ui-component-height)+0.75rem)]',
          'rounded-[calc(var(--radius)+0.25rem)]',
          'bg-[var(--muted)] p-1.5',
          'border border-[var(--border)] shadow-sm',
          'gap-[var(--ui-gap-base)]',
          className
        )}
      >
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          const childProps = child.props as { value?: string };
          return React.cloneElement(child as React.ReactElement<any>, {
            isSelected: childProps.value === value,
            onSelect: () => childProps.value && onValueChange?.(childProps.value),
          });
        })}
      </div>
    );
  }
);
ToggleGroup.displayName = 'ToggleGroup';

interface ToggleGroupItemProps {
  value?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ isSelected = false, onSelect, className, id, children }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-label={`${children}`}
        id={id}
        onClick={onSelect}
        className={cn(
          'inline-flex flex-1 items-center justify-center whitespace-nowrap',
          'h-[var(--ui-component-height)] px-[var(--ui-component-padding-x)] py-[var(--ui-component-padding-y)]',
          'text-[length:var(--ui-font-size-base)] font-medium',
          'rounded-[var(--radius)] cursor-pointer',
          'transition-all duration-200 outline-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1',
          isSelected
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md font-semibold scale-[1.02]'
            : 'text-[var(--muted-foreground)] bg-transparent hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
          'active:scale-95',
          className
        )}
      >
        {children}
      </button>
    );
  }
);
ToggleGroupItem.displayName = 'ToggleGroupItem';

export { ToggleGroup, ToggleGroupItem };
