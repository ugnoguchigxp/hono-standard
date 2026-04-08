import { cva, type VariantProps } from 'class-variance-authority';
import { Star } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/utils/cn';

const ratingVariants = cva('inline-flex items-center gap-0.5', {
  variants: {
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const starSizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

export interface RatingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof ratingVariants> {
  num: number;
  color?: string;
}

export const Rating = React.memo(
  React.forwardRef<HTMLDivElement, RatingProps>(
    ({ num, color = '#facc15', size = 'md', className, ...props }, ref) => {
      const safeNum = Number.isNaN(num) ? 0 : num;
      const clampedNum = Math.max(0, Math.min(5, safeNum));
      const fullStars = Math.floor(clampedNum);
      const partialStar = clampedNum - fullStars;
      const emptyStars = 5 - fullStars - (partialStar > 0 ? 1 : 0);

      const starSize = starSizeMap[size ?? 'md'];

      return (
        <div
          ref={ref}
          className={cn(ratingVariants({ size }), className)}
          role="img"
          aria-label={`評価: ${clampedNum.toFixed(1)} / 5.0`}
          {...props}
        >
          {Array.from({ length: fullStars }).map((_, i) => (
            <Star
              // biome-ignore lint/suspicious/noArrayIndexKey: 星の順序は固定
              key={`full-${i}`}
              size={starSize}
              fill={color}
              stroke={color}
              aria-hidden="true"
            />
          ))}

          {partialStar > 0 && (
            <div className="relative inline-block" aria-hidden="true">
              <Star size={starSize} stroke={color} fill="none" />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${partialStar * 100}%` }}
              >
                <Star size={starSize} fill={color} stroke={color} />
              </div>
            </div>
          )}

          {Array.from({ length: emptyStars }).map((_, i) => (
            <Star
              // biome-ignore lint/suspicious/noArrayIndexKey: 星の順序は固定
              key={`empty-${i}`}
              size={starSize}
              stroke={color}
              fill="none"
              aria-hidden="true"
            />
          ))}
        </div>
      );
    }
  )
);

Rating.displayName = 'Rating';
