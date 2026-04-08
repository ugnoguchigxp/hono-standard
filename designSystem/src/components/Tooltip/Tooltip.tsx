import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';
import { cn } from '@/utils/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipArrow = TooltipPrimitive.Arrow;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    showArrow?: boolean;
  }
>(({ className, sideOffset = 4, side = 'bottom', showArrow = true, children, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    side={side}
    className={cn(
      'relative z-50',
      'rounded-lg bg-popover text-popover-foreground px-4 py-2 shadow-md min-h-9 text-sm flex items-center',
      'animate-in fade-in-0 duration-200',
      className
    )}
    {...props}
  >
    {children}
    {showArrow && <TooltipArrow width={10} height={10} className="fill-popover" />}
  </TooltipPrimitive.Content>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  showArrow?: boolean;
  delayDuration?: number;
  /**
   * whether to wrap with TooltipProvider.
   * Keep it false if you already have a Provider at the root level.
   */
  withProvider?: boolean;
}

/**
 * A handy Tooltip component that combines Trigger and Content.
 * Note: Ensure TooltipProvider is available at a higher level,
 * or use withProvider={true} for isolated usage.
 */
export const Tooltip = ({
  children,
  content,
  side = 'bottom',
  align = 'center',
  sideOffset = 4,
  showArrow = true,
  delayDuration,
  withProvider = false,
}: TooltipProps) => {
  const contentElement = (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} sideOffset={sideOffset} showArrow={showArrow}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );

  if (withProvider) {
    return <TooltipProvider>{contentElement}</TooltipProvider>;
  }

  return contentElement;
};
