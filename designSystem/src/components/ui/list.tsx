import { Check, Search, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/utils';

const List = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('overflow-hidden rounded-lg border border-border bg-background', className)}
      {...props}
    />
  )
);
List.displayName = 'List';

const ListTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border-b border-border px-3 py-2 text-sm font-semibold', className)}
      {...props}
    />
  )
);
ListTitle.displayName = 'ListTitle';

const ListSearchBox = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2 border-b border-border px-3 py-2 text-sm text-muted-foreground',
        className
      )}
      {...props}
    >
      <Search className="h-4 w-4" />
      <div className="min-w-0 flex-1">{children}</div>
      <X className="h-4 w-4" />
    </div>
  )
);
ListSearchBox.displayName = 'ListSearchBox';

const ListDivider = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mx-3 h-px bg-border', className)} {...props} />
  )
);
ListDivider.displayName = 'ListDivider';

const ListItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & { checked?: boolean }
>(({ className, checked, type = 'button', children, ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
      className
    )}
    {...props}
  >
    <span className="inline-flex min-w-0 items-center gap-2">
      {checked ? <Check className="h-4 w-4 text-primary" /> : <span className="h-4 w-4" />}
      <span className="truncate">{children}</span>
    </span>
  </button>
));
ListItem.displayName = 'ListItem';

export { List, ListDivider, ListItem, ListSearchBox, ListTitle };
