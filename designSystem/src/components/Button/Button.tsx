import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Icon, type iconMap } from '@/components/Icon';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  '!inline-flex flex-row rounded-lg items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        primary:
          'bg-button-primary text-button-text shadow-sm hover:bg-button-primary-hover disabled:bg-button-disabled disabled:text-button-text',
        secondary:
          'bg-button-secondary text-button-text shadow-sm hover:bg-button-secondary-hover disabled:bg-button-disabled disabled:text-button-text',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline underline-offset-4 hover:no-underline',
        option:
          'border border-input bg-background justify-start min-h-[44px] text-left hover:bg-accent',
        'option-active': 'border border-primary bg-primary/10 justify-start min-h-[44px] text-left',
      },
      size: {
        default: 'h-ui px-ui-button py-ui-button text-ui min-h-ui-touch',
        sm: 'h-8 rounded-md px-ui-button text-xs',
        md: 'h-ui px-ui-button py-ui-button text-ui min-h-ui-touch',
        lg: 'h-10 rounded-md px-ui-button text-lg',
        icon: 'h-ui w-[var(--ui-component-height)] min-h-ui-touch min-w-[var(--ui-touch-target-min)]',
        circle: 'h-8 w-8 rounded-full p-0',
      },
      isCircle: {
        true: 'rounded-full p-0 gap-0',
        false: '',
      },
    },
    compoundVariants: [
      {
        isCircle: true,
        size: 'sm',
        class: 'w-9 h-9',
      },
      {
        isCircle: true,
        size: 'md',
        class: 'w-10 h-10',
      },
      {
        isCircle: true,
        size: 'lg',
        class: 'w-11 h-11',
      },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      isCircle: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Icon: string key from iconMap or React component */
  icon?: keyof typeof iconMap | React.ElementType;
  /** Loading state: displays a spinner and disables the button */
  loading?: boolean;
}

const Button = React.memo(
  React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
      {
        className,
        variant = 'primary',
        size = 'md',
        children,
        icon,
        asChild = false,
        disabled,
        loading = false,
        ...props
      },
      ref
    ) => {
      const Comp = asChild ? Slot : 'button';
      const isCircle = !children && !!icon;

      // Icon size matches button size: sm→sm, md→md, lg→lg
      const iconSize: 'sm' | 'md' | 'lg' = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';

      // Icon classes for custom icon components
      const iconClassName =
        iconSize === 'sm' ? 'h-4 w-4' : iconSize === 'lg' ? 'h-6 w-6' : 'h-5 w-5';

      // Determine if icon is a string (iconMap key) or component
      const isStringIcon = typeof icon === 'string';
      const IconComponent = isStringIcon ? null : icon;

      return (
        <Comp
          className={cn(buttonVariants({ variant, size, isCircle }), className)}
          ref={ref}
          disabled={disabled || loading}
          {...props}
        >
          {loading && <Icon type="loader" className="animate-spin" size={iconSize} />}
          {!loading && isStringIcon && icon && (
            <Icon type={icon as keyof typeof iconMap} size={iconSize} />
          )}
          {loading ? (
            isCircle ? null : (
              children
            )
          ) : (
            <>
              {IconComponent && <IconComponent className={iconClassName} />}
              {children}
            </>
          )}
        </Comp>
      );
    }
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
