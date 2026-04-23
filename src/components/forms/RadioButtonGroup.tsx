import type React from 'react';

export interface RadioOption {
  id: string;
  label: string;
  value: string;
}

interface RadioButtonGroupProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  vertical?: boolean; // 追加: 縦並び指定
}

const RadioButtonGroup: React.FC<RadioButtonGroupProps> = ({
  name,
  options,
  value,
  onChange,
  className = '',
  vertical = false,
}) => (
  <div
    className={`flex ${vertical ? 'flex-col' : 'flex-row'} gap-2 ${className}`}
    role="radiogroup"
    aria-label={name}
  >
    {options.map((option) => (
      <label key={option.id} className="flex items-center gap-2">
        <input
          type="radio"
          name={name}
          value={option.value}
          checked={value === option.value}
          onChange={() => onChange(option.value)}
          className="form-radio text-blue-600 focus:ring-blue-500"
        />
        {option.label}
      </label>
    ))}
  </div>
);

export default RadioButtonGroup;
