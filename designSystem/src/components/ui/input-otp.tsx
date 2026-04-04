import { Minus } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/utils';

const InputOTP = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-2', className)} {...props} />
  )
);
InputOTP.displayName = 'InputOTP';

const InputOTPGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center', className)} {...props} />
  )
);
InputOTPGroup.displayName = 'InputOTPGroup';

const InputOTPSlot = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      inputMode="numeric"
      maxLength={1}
      className={cn(
        'h-10 w-10 border border-input bg-background text-center text-sm leading-5 outline-none transition-colors first:rounded-l-md last:rounded-r-md -ml-px first:ml-0 focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  )
);
InputOTPSlot.displayName = 'InputOTPSlot';

const InputOTPSeparator = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn('flex h-10 w-10 items-center justify-center text-muted-foreground', className)}
    {...props}
  >
    <Minus className="h-4 w-4" />
  </div>
);
InputOTPSeparator.displayName = 'InputOTPSeparator';

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
