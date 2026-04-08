import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import * as React from 'react';
import { Icon, type iconMap } from '@/components/Icon';
import { cn } from '@/utils/cn';

const modalVariants = cva(
  'fixed left-1/2 top-1/2 z-50 shadow-md transform -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background mx-4',
  {
    variants: {
      variant: {
        consulter: 'w-full max-w-[384px]',
        judgement: 'w-full max-w-[1040px]',
        employee: 'w-full max-w-[800px]',
      },
    },
    defaultVariants: {
      variant: 'consulter',
    },
  }
);

export interface ModalProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof modalVariants> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  headerIcon?: keyof typeof iconMap;
  headerTitle?: string;
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  noHeader?: boolean;
  noPadding?: boolean;
  contentClassName?: string;
}

const Modal = React.memo(
  React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, ModalProps>(
    (
      {
        children,
        variant = 'consulter',
        open,
        onOpenChange,
        onClose,
        headerIcon,
        headerTitle,
        title,
        description,
        footer,
        noHeader = false,
        noPadding = false,
        contentClassName,
        className,
        ...props
      },
      ref
    ) => {
      const handleOpenChange = (isOpen: boolean) => {
        onOpenChange?.(isOpen);
        if (!isOpen && onClose) {
          onClose();
        }
      };

      const generatedDescriptionId = React.useId();
      const displayTitle = headerTitle || title;

      return (
        <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/10')} />
            <DialogPrimitive.Content
              ref={ref}
              aria-describedby={generatedDescriptionId}
              className={cn(modalVariants({ variant }), contentClassName, className)}
              {...props}
            >
              {/* Header */}
              {!noHeader && (headerIcon || displayTitle) && (
                <div className="flex flex-col w-full">
                  <div className="flex items-center justify-between py-2 p-4">
                    <div className="flex items-center gap-2">
                      {headerIcon && <Icon type={headerIcon} className="text-purple" size="lg" />}
                      {displayTitle && (
                        <span className="font-inter font-semibold leading-none tracking-normal text-foreground text-xl">
                          {displayTitle}
                        </span>
                      )}
                    </div>
                    <DialogPrimitive.Close
                      aria-label="閉じる"
                      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center w-6 h-6 text-purple hover:bg-black/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </DialogPrimitive.Close>
                  </div>
                  <div className="border-b border-border w-full" />
                </div>
              )}

              {/* Close button (when no header) */}
              {!noHeader && !headerIcon && !displayTitle && (
                <div className="absolute top-4 right-4 z-10">
                  <DialogPrimitive.Close
                    aria-label="閉じる"
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center w-6 h-6 text-purple hover:bg-black/5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </DialogPrimitive.Close>
                </div>
              )}

              {/* Modal Body */}
              <div
                className={cn(
                  'overflow-y-auto overflow-x-hidden pt-5 pb-6 max-h-[60vh]',
                  !noPadding && 'px-4'
                )}
              >
                {description && (
                  <p id={generatedDescriptionId} className="text-sm text-muted-foreground mb-4">
                    {description}
                  </p>
                )}
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <>
                  <div className="border-t border-border w-full" />
                  <div className="flex items-center justify-end gap-2 p-4">{footer}</div>
                </>
              )}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      );
    }
  )
);

Modal.displayName = 'Modal';

export { Modal };
export default Modal;
