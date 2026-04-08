import { cva, type VariantProps } from 'class-variance-authority';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Brain,
  Building,
  ChartLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clipboard,
  Eye,
  EyeOff,
  FileChartLine,
  Files,
  Goal,
  House,
  Landmark,
  LandPlot,
  Loader2,
  MenuIcon,
  SendHorizontal,
  Settings,
  TabletSmartphone,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import * as React from 'react';
import { cn } from '@/utils/cn';

export const iconMap = {
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'chart-line': ChartLine,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  'circle-help': CircleHelp,
  'circle-x': CircleX,
  'eye-off': EyeOff,
  'file-chart-line': FileChartLine,
  'land-plot': LandPlot,
  'send-horizontal': SendHorizontal,
  'user-round': UserRound,
  bell: Bell,
  brain: Brain,
  building: Building,
  check: Check,
  clipboard: Clipboard,
  eye: Eye,
  goal: Goal,
  house: House,
  landmark: Landmark,
  menu: MenuIcon,
  settings: Settings,
  upload: Upload,
  x: X,
  files: Files,
  loader: Loader2,
  tabletSmartphone: TabletSmartphone,
} as const;

const iconVariants = cva('', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-7 w-7',
      xs: 'h-[16px] w-[16px]',
      xxl: 'h-[40px] w-[40px]',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface IconProps
  extends React.SVGProps<SVGSVGElement>,
    VariantProps<typeof iconVariants> {
  type: keyof typeof iconMap;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ type, size, className, ...props }, ref) => {
    const SelectedIcon = iconMap[type];

    return (
      <SelectedIcon
        ref={ref}
        className={cn(iconVariants({ size }), className)}
        aria-hidden="true"
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';
