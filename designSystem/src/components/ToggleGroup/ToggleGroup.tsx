import * as React from 'react';
import { cn } from '@/utils/cn';

interface ToggleGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

const ToggleGroup = React.forwardRef<HTMLFieldSetElement, ToggleGroupProps>(
  ({ value, onValueChange, className, children }, ref) => {
    return (
      <fieldset
        ref={ref}
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
          const childProps = child.props as ToggleGroupItemProps;
          return React.cloneElement(child as React.ReactElement<ToggleGroupItemProps>, {
            isSelected: childProps.value === value,
            onSelect: () => childProps.value && onValueChange?.(childProps.value),
          });
        })}
      </fieldset>
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

const ToggleGroupItem = React.forwardRef<HTMLLabelElement, ToggleGroupItemProps>(
  ({ isSelected = false, onSelect, className, id, children }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'inline-flex flex-1 items-center justify-center whitespace-nowrap',
          'h-[var(--ui-component-height)] px-[var(--ui-component-padding-x)] py-[var(--ui-component-padding-y)]',
          'text-[length:var(--ui-font-size-base)] font-medium',
          'rounded-[var(--radius)] cursor-pointer',
          'transition-all duration-200 outline-none',
          'focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-1',
          isSelected
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md font-semibold scale-[1.02]'
            : 'text-[var(--muted-foreground)] bg-transparent hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
          'active:scale-95',
          className
        )}
      >
        <input type="radio" className="sr-only" checked={isSelected} onChange={onSelect} id={id} />
        {children}
      </label>
    );
  }
);
ToggleGroupItem.displayName = 'ToggleGroupItem';

export { ToggleGroup, ToggleGroupItem };
