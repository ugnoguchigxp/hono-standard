import { cn } from '@/utils/cn';

export const XS_STEP_COMPLETED_CLASSES = 'w-[16px] h-[16px] rounded-full';
export const XS_STEP_UPCOMING_CLASSES =
  'w-[16px] h-[16px] rounded-full bg-white border-2 border-[var(--stepper-inactive-bg)]';
export const XS_STEP_CURRENT_CONTAINER_CLASSES =
  'relative flex items-center justify-center w-[16px] h-[16px] z-10 before:absolute before:rounded-full before:bg-[var(--background)] before:w-3.5 before:h-3.5';
export const XS_STEP_CURRENT_ICON_CLASSES = 'text-[var(--stepper-active)] relative';
export const XXL_ICON_CONTAINER_BASE_CLASSES =
  'relative flex items-center justify-center z-10 shrink-0 w-10 h-10 before:absolute before:rounded-full before:bg-[var(--background)] before:w-9 before:h-9';

export const BASE_PROGRESS_CLASSES =
  'absolute top-1/2 -translate-y-1/2 bg-[var(--stepper-inactive-bg)] z-0';
export const ACTIVE_PROGRESS_CLASSES =
  'absolute left-0 top-1/2 -translate-y-1/2 transition-all duration-300 bg-[var(--stepper-active)] z-0';
export const INNER_CONTAINER_BASE_CLASSES = 'relative';
export const INNER_CONTAINER_NO_LABEL_CLASSES = 'flex items-center';
export const LIST_BASE_CLASSES = 'relative flex items-center justify-between';
export const LABEL_BASE_CLASSES =
  'absolute -top-12 left-1/2 -translate-x-1/2 text-left font-semibold text-base leading-6 whitespace-nowrap py-1';
export const LABEL_ACTIVE_COLOR_CLASSES = 'text-[var(--stepper-active)]';
export const LABEL_INACTIVE_COLOR_CLASSES = 'text-[var(--stepper-inactive)]';
export const LI_BASE_CLASSES = 'flex flex-col items-center relative';
export const XXL_ICON_CONTAINER_LABEL_CLASSES =
  'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2';
export const XXL_ICON_BASE_CLASSES = 'block relative';
export const XXL_ICON_ACTIVE_CLASSES = 'text-[var(--stepper-active)]';
export const XXL_ICON_INACTIVE_CLASSES = 'text-[var(--stepper-inactive)]';
export const XS_ICON_DIAMETER = 16;
export const XXL_ICON_DIAMETER = 32;
export const xsIndicatorWrapperClasses = cn(
  'relative z-10 shrink-0 w-[16px] h-[16px]',
  "before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2",
  'before:rounded-full before:bg-[var(--background)] before:w-[14px] before:h-[14px]'
);
export const DEFAULT_STEPS = [
  { id: 's1', label: '未着手' },
  { id: 's2', label: '取組中' },
  { id: 's3', label: 'エビデンス登録済' },
  { id: 's4', label: '銀行確認中' },
  { id: 's5', label: '施策完了' },
];

export const SIZE_CONFIG = {
  xs: {
    containerPadding: 'pt-8',
    progressHeight: 'h-0.5',
    width: 150,
  },
  xxl: {
    containerPadding: 'pt-8',
    progressHeight: 'h-2',
  },
} as const;

export const NAV_WIDTH = {
  xs: 'w-[150px]',
  xxl: 'w-[876px]',
} as const;

export const LIST_WIDTH = {
  xs: 'w-[150px]',
  xxl: 'w-full',
} as const;

export const BASE_PROGRESS_WIDTH = {
  xs: 'w-[150px]',
  xxl: 'left-0 right-0',
} as const;

export const LI_WIDTH_XS = 'w-[20%]';

export const ICON_TYPE = 'circle-check' as const;

export const STEPPER_ACTIVE_COLOR = 'var(--stepper-active)';

export const ARIA_LABELS = {
  progress: 'Progress',
  listRole: 'list',
  listItemRole: 'listitem',
} as const;
export const WARNING_MESSAGE =
  '[Stepper] Duplicate step IDs detected. Each step should have a unique ID.';
