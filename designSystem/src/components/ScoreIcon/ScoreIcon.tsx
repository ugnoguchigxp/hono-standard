import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/utils/cn';

const scoreIconVariants = cva(
  'relative flex flex-col items-center justify-start pt-5 rounded-full font-medium w-[140px] h-[140px] text-[80px]',
  {
    variants: {
      score: {
        A: 'text-score-a',
        B: 'text-score-b',
        C: 'text-score-c',
        D: 'text-score-d',
        E: 'text-score-e',
      },
    },
    defaultVariants: {
      score: 'A',
    },
  }
);

// Circle configuration constants
const CIRCLE_CONFIG = {
  SIZE: 140,
  RING_WIDTH: 12,
} as const;

const scoreConfig = {
  A: {
    label: '成熟フェーズ',
    progress: 100,
  },
  B: {
    label: '安定フェーズ',
    progress: 80,
  },
  C: {
    label: '成長フェーズ',
    progress: 60,
  },
  D: {
    label: '発展フェーズ',
    progress: 40,
  },
  E: {
    label: '準備フェーズ',
    progress: 20,
  },
} as const satisfies Record<string, { label: string; progress: number }>;

const calculateCircleMetrics = (circleSize: number, ringWidth: number, progress: number) => {
  const center = circleSize / 2;
  const radius = center - ringWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return { center, radius, circumference, strokeDashoffset };
};

// Calculate arc path for progress circle
const describeArc = (
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y].join(' ');
};

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) => {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

export type ScoreType = keyof typeof scoreConfig;

export interface ScoreIconProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof scoreIconVariants> {
  /** Score type (A-E) */
  score?: ScoreType;
}

const ScoreIcon = React.memo(
  React.forwardRef<HTMLDivElement, ScoreIconProps>(({ className, score = 'A', ...props }, ref) => {
    const config = scoreConfig[score];

    // Calculate circle metrics with fixed size
    const { center, radius } = React.useMemo(
      () => calculateCircleMetrics(CIRCLE_CONFIG.SIZE, CIRCLE_CONFIG.RING_WIDTH, config.progress),
      [config.progress]
    );

    // Calculate arc path for progress (0 = top, clockwise)
    const { progressPath, endPoint } = React.useMemo(() => {
      const progressAngle = (config.progress / 100) * 360;
      const isFullCircle = config.progress >= 100;
      const path = describeArc(
        center,
        center,
        radius,
        -90,
        -90 + (isFullCircle ? 359.99 : progressAngle)
      );

      const end = polarToCartesian(
        center,
        center,
        radius,
        -90 + (isFullCircle ? 359.99 : progressAngle)
      );

      return { progressPath: path, endPoint: end };
    }, [center, radius, config.progress]);

    return (
      <div
        ref={ref}
        className={cn(scoreIconVariants({ score }), className)}
        role="img"
        aria-label={`Score ${score}: ${config.label}`}
        {...props}
      >
        {/* Progress ring - decorative */}
        <svg
          className="absolute inset-0"
          width={CIRCLE_CONFIG.SIZE}
          height={CIRCLE_CONFIG.SIZE}
          aria-hidden="true"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={CIRCLE_CONFIG.RING_WIDTH}
            className="text-border opacity-30"
          />
          {/* Progress arc - flat on both ends */}
          <path
            d={progressPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={CIRCLE_CONFIG.RING_WIDTH}
            strokeLinecap="butt"
          />
          {/* Rounded end cap - only at the end point */}
          <circle
            cx={endPoint.x}
            cy={endPoint.y}
            r={CIRCLE_CONFIG.RING_WIDTH / 2}
            fill="currentColor"
          />
        </svg>

        {/* Content inside circle */}
        <div className="relative flex flex-col items-center justify-center select-none">
          {/* Score letter */}
          <span className="font-medium text-[80px] leading-none">{score}</span>
          {/* Label */}
          <span className="text-xs font-semibold text-center leading-2">{config.label}</span>
        </div>
      </div>
    );
  })
);
ScoreIcon.displayName = 'ScoreIcon';

export { CIRCLE_CONFIG, calculateCircleMetrics, ScoreIcon, scoreConfig, scoreIconVariants };
