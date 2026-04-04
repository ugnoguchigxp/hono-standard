import * as React from 'react';

import { cn } from '../../lib/utils';

const Sidebar = React.forwardRef<HTMLDivElement, React.ComponentProps<'aside'>>(
  ({ className, ...props }, ref) => (
    <aside
      ref={ref}
      className={cn(
        'flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className
      )}
      {...props}
    />
  )
);
Sidebar.displayName = 'Sidebar';

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('border-b border-sidebar-border p-2', className)} {...props} />
  )
);
SidebarHeader.displayName = 'SidebarHeader';

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex-1 overflow-auto p-2', className)} {...props} />
  )
);
SidebarContent.displayName = 'SidebarContent';

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('border-t border-sidebar-border p-2', className)} {...props} />
  )
);
SidebarFooter.displayName = 'SidebarFooter';

const SidebarSectionTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className
      )}
      {...props}
    />
  )
);
SidebarSectionTitle.displayName = 'SidebarSectionTitle';

const SidebarItem = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
  ({ className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-1 focus-visible:ring-sidebar-ring',
        className
      )}
      {...props}
    />
  )
);
SidebarItem.displayName = 'SidebarItem';

export { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarItem, SidebarSectionTitle };
