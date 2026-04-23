import type React from 'react';

interface NumberSliderProps {
  id: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const NumberSlider: React.FC<NumberSliderProps> = ({
  id,
  label,
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  className = '',
}) => {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="ml-2 text-blue-600 font-bold">{value}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
    </div>
  );
};
