import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';

const Accordion = AccordionPrimitive.Root;

const VARIANT_CONFIG = {
  default: {
    iconColor: 'text-foreground',
    borderColor: 'border-border',
    triggerBg: 'bg-background',
    statusLabel: '',
    iconType: undefined,
  },
  destructive: {
    iconColor: 'text-accordion-destructive-icon',
    borderColor: 'border-accordion-destructive-border',
    triggerBg: 'bg-accordion-destructive-bg',
    statusLabel: '要改善',
    iconType: 'circle-x' as const,
  },
  warning: {
    iconColor: 'text-accordion-warning-icon',
    borderColor: 'border-accordion-warning-border',
    triggerBg: 'bg-accordion-warning-bg',
    statusLabel: '注意',
    iconType: 'circle-alert' as const,
  },
  success: {
    iconColor: 'text-accordion-success-icon',
    borderColor: 'border-accordion-success-border',
    triggerBg: 'bg-accordion-success-bg',
    statusLabel: '良好',
    iconType: 'circle-check' as const,
  },
} as const;

const accordionItemVariants = cva('rounded-lg mb-2 overflow-hidden', {
  variants: {
    variant: {
      default: '',
      destructive: '',
      warning: '',
      success: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface AccordionItemProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>,
    VariantProps<typeof accordionItemVariants> {}

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  AccordionItemProps
>(({ className, variant, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(accordionItemVariants({ variant }), className)}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

export interface AccordionTriggerProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> {
  icon?: React.ReactNode;
  badge?: string;
  variant?: 'default' | 'destructive' | 'warning' | 'success';
  label?: string;
  showStatusLabel?: boolean;
}

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(
  (
    {
      className,
      children,
      icon,
      badge,
      variant = 'default',
      label,
      showStatusLabel = true,
      ...props
    },
    ref
  ) => {
    const config = VARIANT_CONFIG[variant];
    const displayIcon =
      icon !== undefined ? (
        icon
      ) : config.iconType ? (
        <Icon type={config.iconType} size="lg" />
      ) : null;

    return (
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
          ref={ref}
          className={cn(
            'flex flex-1 items-center justify-between gap-2.5 px-4 py-4',
            'border data-[state=closed]:rounded-lg data-[state=open]:rounded-t-lg',
            config.triggerBg,
            config.borderColor,
            className
          )}
          {...props}
        >
          <div className="flex items-center gap-2">
            {displayIcon && (
              <div className={cn('shrink-0 flex items-center', config.iconColor)}>
                {displayIcon}
              </div>
            )}
            {showStatusLabel && variant !== 'default' && (
              <span className={cn('shrink-0 text-lg font-normal', config.iconColor)}>
                {config.statusLabel}
              </span>
            )}
            {label && (
              <span className="shrink-0 text-lg font-normal text-accordion-label">{label}</span>
            )}
            <span className="flex-1 text-left text-lg font-medium text-accordion-text">
              {children}
            </span>
            {badge && (
              <Badge className="shrink-0 bg-accordion-badge-bg text-accordion-badge-text text-sm font-semibold border-none hover:bg-accordion-badge-bg">
                {badge}
              </Badge>
            )}
          </div>
          <Icon
            type="chevron-down"
            size="md"
            className={cn('shrink-0 data-[state=open]:rotate-180', config.iconColor)}
          />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    );
  }
);
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content ref={ref} className={cn('overflow-hidden', className)} {...props}>
    {children}
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

const AccordionContentSection = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('bg-white border-x border-accordion-footer-border px-4 pt-6 pb-4', className)}
    {...props}
  >
    {children}
  </div>
));
AccordionContentSection.displayName = 'AccordionContentSection';

const AccordionContentFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'border border-accordion-footer-border bg-accordion-footer-bg px-4 py-3 rounded-b-lg',
      className
    )}
    {...props}
  >
    <div className="flex gap-1">
      <span className="text-success font-semibold text-lg min-w-fit">解決：</span>
      <span className="text-base font-normal text-accordion-footer-text self-center">
        {children}
      </span>
    </div>
  </div>
));
AccordionContentFooter.displayName = 'AccordionContentFooter';

export {
  Accordion,
  AccordionContent,
  AccordionContentFooter,
  AccordionContentSection,
  AccordionItem,
  AccordionTrigger,
};
