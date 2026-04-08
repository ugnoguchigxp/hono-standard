import React from 'react';
/**
 * ViewSwitcher Component
 * ビュー切り替えスイッチ
 */
import { cn } from '@/utils/cn';

export interface ViewOption {
  value: string;
  label: string;
  tooltip: string;
}

export interface ViewSwitcherProps {
  options: ViewOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const ViewSwitcher = React.memo(
  ({ options, value, onChange, className }: ViewSwitcherProps) => {
    return (
      <div
        className={cn(
          'flex items-center p-1 w-full max-w-full h-8 bg-view-switcher-bg rounded',
          className
        )}
      >
        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'flex items-center justify-center flex-1 h-6 px-2 transition-colors font-medium text-base max-sm:text-xs rounded-[2px] cursor-pointer',
                isActive
                  ? 'bg-view-switcher-active-bg text-view-switcher-active-text shadow-sm cursor-default'
                  : 'text-view-switcher-inactive-text hover:text-view-switcher-active-text/80'
              )}
              aria-label={option.tooltip}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }
);
ViewSwitcher.displayName = 'ViewSwitcher';
