import * as React from 'react';
import { cn } from '@/utils/cn';

export const Label = React.memo(
  React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
    ({ className, ...props }, ref) => (
      // biome-ignore lint/a11y/noLabelWithoutControl: Generic label component
      <label
        ref={ref}
        className={cn(
          'text-ui font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-disabled:text-muted-foreground',
          className
        )}
        {...props}
      />
    )
  )
);
Label.displayName = 'Label';
