import React from 'react';
import { cn } from '@/utils/cn';
import { Icon } from '../Icon';
import {
  ACTIVE_PROGRESS_CLASSES,
  ARIA_LABELS,
  BASE_PROGRESS_CLASSES,
  DEFAULT_STEPS,
  ICON_TYPE,
  INNER_CONTAINER_BASE_CLASSES,
  INNER_CONTAINER_NO_LABEL_CLASSES,
  LABEL_ACTIVE_COLOR_CLASSES,
  LABEL_BASE_CLASSES,
  LABEL_INACTIVE_COLOR_CLASSES,
  LI_BASE_CLASSES,
  LI_WIDTH_XS,
  LIST_BASE_CLASSES,
  LIST_WIDTH,
  NAV_WIDTH,
  SIZE_CONFIG,
  STEPPER_ACTIVE_COLOR,
  WARNING_MESSAGE,
  XS_ICON_DIAMETER,
  XXL_ICON_ACTIVE_CLASSES,
  XXL_ICON_BASE_CLASSES,
  XXL_ICON_CONTAINER_BASE_CLASSES,
  XXL_ICON_CONTAINER_LABEL_CLASSES,
  XXL_ICON_DIAMETER,
  XXL_ICON_INACTIVE_CLASSES,
  xsIndicatorWrapperClasses,
} from './constants';

const XsStepIndicator: React.FC<{
  state: 'completed' | 'current' | 'upcoming';
  activeColor: string;
}> = ({ state, activeColor }) => {
  const containerClasses = cn(
    'relative z-10 flex items-center justify-center w-[16px] h-[16px] rounded-full shrink-0',
    state === 'current' && 'bg-transparent',
    state === 'upcoming' && 'bg-white border-2 border-[var(--stepper-inactive-bg)]'
  );
  const containerStyle = state === 'completed' ? { backgroundColor: activeColor } : undefined;

  return (
    <div className={containerClasses} style={containerStyle} aria-hidden="true">
      {state === 'current' && (
        <Icon type="circle-check" size="xs" className="text-[var(--stepper-active)]" />
      )}
    </div>
  );
};

export interface IStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps?: IStep[];
  currentStep: number;
  className?: string;
  size?: 'xxl' | 'xs';
}

export const Stepper: React.FC<StepperProps> = React.memo(
  ({ steps, currentStep, className, size = 'xxl' }) => {
    const finalSteps = steps || DEFAULT_STEPS;

    if (finalSteps.length === 0) {
      return null;
    }

    if (process.env.NODE_ENV === 'development') {
      const ids = finalSteps.map((step) => step.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.warn(WARNING_MESSAGE, ids);
      }
    }

    const safeCurrentStep = Math.max(0, Math.min(Math.floor(currentStep), finalSteps.length - 1));

    const hasLabels = finalSteps.some((step) => step.label.trim() !== '');

    const config = SIZE_CONFIG[size];
    const navClasses = cn(NAV_WIDTH[size], className);
    const containerPaddingClasses = cn(hasLabels && config.containerPadding);
    const innerContainerClasses = cn(
      INNER_CONTAINER_BASE_CLASSES,
      !hasLabels && INNER_CONTAINER_NO_LABEL_CLASSES
    );

    const iconDiameter = size === 'xs' ? XS_ICON_DIAMETER : XXL_ICON_DIAMETER;
    const iconRadius = iconDiameter / 2;

    const progressLineStyle: React.CSSProperties = {
      left: `${iconRadius}px`,
      right: `${iconRadius}px`,
      width: 'auto',
    };

    const activeProgressFraction =
      finalSteps.length <= 1 ? 0 : safeCurrentStep / (finalSteps.length - 1);

    const activeProgressStyle: React.CSSProperties = {
      left: `${iconRadius}px`,
      // width = fraction * (100% - iconDiameter)
      width:
        finalSteps.length <= 1
          ? '0px'
          : `calc(${activeProgressFraction} * (100% - ${iconDiameter}px))`,
    };

    const baseProgressClasses = cn(BASE_PROGRESS_CLASSES, config.progressHeight);
    const activeProgressClasses = cn(ACTIVE_PROGRESS_CLASSES, config.progressHeight);

    const listClasses = cn(
      LIST_BASE_CLASSES,
      size === 'xs' && !hasLabels ? LIST_WIDTH.xs : LIST_WIDTH.xxl
    );

    return (
      <nav aria-label={ARIA_LABELS.progress} className={navClasses}>
        <div className={containerPaddingClasses}>
          <div className={innerContainerClasses}>
            <div className={baseProgressClasses} style={progressLineStyle} aria-hidden="true" />
            <div className={activeProgressClasses} style={activeProgressStyle} aria-hidden="true" />
            <ol className={listClasses} role={ARIA_LABELS.listRole}>
              {finalSteps.map((step, index) => {
                const completed = index < safeCurrentStep;
                const current = index === safeCurrentStep;

                const labelColorClass =
                  current || completed ? LABEL_ACTIVE_COLOR_CLASSES : LABEL_INACTIVE_COLOR_CLASSES;

                const labelDivClasses = cn(LABEL_BASE_CLASSES, labelColorClass);

                const stepState: 'completed' | 'current' | 'upcoming' = completed
                  ? 'completed'
                  : current
                    ? 'current'
                    : 'upcoming';

                const liClasses = cn(LI_BASE_CLASSES, size === 'xs' && !hasLabels && LI_WIDTH_XS);
                const ariaLabel = `Step ${index + 1}${step.label ? `: ${step.label}` : ''}${completed ? ' - Completed' : current ? ' - Current' : ' - Upcoming'}`;

                return (
                  <li
                    key={step.id}
                    className={liClasses}
                    role={ARIA_LABELS.listItemRole}
                    aria-current={current ? 'step' : undefined}
                    aria-label={ariaLabel}
                  >
                    {size === 'xxl' && hasLabels && step.label && (
                      <div className={labelDivClasses}>{step.label}</div>
                    )}
                    {size === 'xs' ? (
                      <div className={xsIndicatorWrapperClasses} aria-hidden="true">
                        <XsStepIndicator state={stepState} activeColor={STEPPER_ACTIVE_COLOR} />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          XXL_ICON_CONTAINER_BASE_CLASSES,
                          hasLabels && XXL_ICON_CONTAINER_LABEL_CLASSES
                        )}
                        aria-hidden="true"
                      >
                        <Icon
                          type={ICON_TYPE}
                          size="xxl"
                          className={cn(
                            XXL_ICON_BASE_CLASSES,
                            current || completed
                              ? XXL_ICON_ACTIVE_CLASSES
                              : XXL_ICON_INACTIVE_CLASSES
                          )}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </nav>
    );
  }
);

Stepper.displayName = 'Stepper';
