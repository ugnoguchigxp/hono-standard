import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Icon, type iconMap } from '@/components/Icon';
import { cn } from '@/utils/cn';

const linkButtonVariants = cva(
  [
    'inline-flex items-center',
    'no-underline hover:underline hover:underline-offset-4 decoration-copy-link',
    'transition-colors cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    'group',
  ],
  {
    variants: {
      variant: {
        copy: 'gap-2',
        link: '',
      },
    },
    defaultVariants: {
      variant: 'link',
    },
  }
);

export interface LinkButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof linkButtonVariants> {
  /** Text to display */
  text: string;
  /** Value to copy to clipboard (defaults to text if not provided) - only for copy variant */
  copyValue?: string;
  /** URL to navigate to - only for link variant */
  href?: string;
  /** Custom icon type (defaults to 'files' for copy, 'chevron-right' for link) */
  icon?: keyof typeof iconMap;
  /** Show icon only (hide text) */
  iconOnly?: boolean;
  /** Hide icon (show text only) */
  hideIcon?: boolean;
  /** Callback when copy succeeds - only for copy variant */
  onCopied?: (copiedValue: string) => void;
  /** Callback when copy fails - only for copy variant */
  onCopyError?: (error: unknown) => void;
}

const LinkButton = React.forwardRef<HTMLButtonElement, LinkButtonProps>(
  (
    {
      text,
      copyValue,
      href,
      className,
      variant = 'link',
      icon,
      iconOnly = false,
      hideIcon = false,
      onCopied,
      onCopyError,
      ...props
    },
    ref
  ) => {
    const t = (key: string) => key;

    const handleCopy = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const valueToCopy = copyValue || text;
      try {
        await navigator.clipboard.writeText(valueToCopy);
        onCopied?.(valueToCopy);
      } catch (err) {
        onCopyError?.(err);
      }
    };

    const handleLinkClick = (e: React.MouseEvent) => {
      if (href) {
        e.stopPropagation();
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    };

    const handleClick = variant === 'copy' ? handleCopy : handleLinkClick;
    const title = variant === 'copy' ? t('クリップボードにコピー') : t('リンクを開く');
    const defaultIconType = variant === 'copy' ? 'files' : 'chevron-right';
    const iconType = icon || defaultIconType;
    const iconClassName =
      variant === 'link' ? 'text-copy-link' : 'text-copy-icon group-hover:text-copy-link';

    return (
      <button
        type="button"
        ref={ref}
        className={cn(linkButtonVariants({ variant }), className)}
        onClick={handleClick}
        title={iconOnly ? title : undefined}
        aria-label={iconOnly ? text : undefined}
        {...props}
      >
        {!iconOnly && <span className="text-copy-link text-base font-normal">{text}</span>}
        {!hideIcon && <Icon type={iconType} size="lg" className={iconClassName} />}
      </button>
    );
  }
);

LinkButton.displayName = 'LinkButton';

export { LinkButton, linkButtonVariants };
