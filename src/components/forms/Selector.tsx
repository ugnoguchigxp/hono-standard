import { Controller } from 'react-hook-form';

export interface SelectorOption {
  id: string;
  textValue: string;
  label: string;
}

export interface SelectorProps {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  options: SelectorOption[];
  placeholder?: string;
  ariaLabel: string;
  error?: string;
  className?: string;
  onChange?: (value: string) => void;
  value?: string;
  buttonLabel?: React.ReactNode;
}

export function Selector({
  name,
  control,
  options,
  placeholder,
  ariaLabel,
  error,
  className,
  buttonLabel,
  onChange,
  value,
  ...rest
}: SelectorProps) {
  // react-hook-form連携: controlがある場合
  if (control) {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: { onChange, value, ref } }) => (
          <div className="relative">
            {buttonLabel && (
              <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none select-none text-gray-500">
                {buttonLabel}
              </span>
            )}
            <select
              ref={ref}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              aria-label={ariaLabel}
              className={`w-full border border-gray-500 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-blue-700 focus:border-blue-700 text-sm bg-white appearance-none selector-custom ${buttonLabel ? 'pl-8' : ''} ${className ?? ''}`}
              {...rest}
            >
              {placeholder && (
                <option value="" disabled hidden className="selector-placeholder">
                  {placeholder}
                </option>
              )}
              {options.map((opt) => (
                <option
                  key={opt.id}
                  value={opt.id}
                  aria-label={opt.textValue}
                  className={
                    value === opt.id
                      ? 'selector-option selector-option-selected'
                      : 'selector-option'
                  }
                >
                  {opt.label}
                </option>
              ))}
            </select>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        )}
      />
    );
  }
  // 通常のselectとして動作
  return (
    <div className="relative">
      {buttonLabel && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none select-none text-gray-500">
          {buttonLabel}
        </span>
      )}
      <select
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={ariaLabel}
        className={`w-full border border-gray-500 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-blue-700 focus:border-blue-700 text-sm bg-white appearance-none selector-custom ${buttonLabel ? 'pl-8' : ''} ${className ?? ''}`}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled hidden className="selector-placeholder">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option
            key={opt.id}
            value={opt.id}
            aria-label={opt.textValue}
            className={
              value === opt.id ? 'selector-option selector-option-selected' : 'selector-option'
            }
          >
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default Selector;
