import type React from 'react';

export interface CheckBoxOption {
  id: string;
  label: string;
  value: string;
}

interface CheckBoxGroupProps {
  name: string;
  options: CheckBoxOption[];
  values: string[];
  onChange: (values: string[]) => void;
  className?: string;
}

const CheckBoxGroup: React.FC<CheckBoxGroupProps> = ({
  name,
  options,
  values,
  onChange,
  className = '',
}) => {
  const handleChange = (checkedValue: string) => {
    if (values.includes(checkedValue)) {
      onChange(values.filter((v) => v !== checkedValue));
    } else {
      onChange([...values, checkedValue]);
    }
  };

  return (
    <div className={`flex flex-wrap gap-4 ${className}`} role="group" aria-label={name}>
      {options.map((option) => (
        <label key={option.id} className="inline-flex items-center cursor-pointer gap-2">
          <input
            type="checkbox"
            name={name}
            value={option.value}
            checked={values.includes(option.value)}
            onChange={() => handleChange(option.value)}
            className="form-checkbox text-blue-600 focus:ring-blue-500"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
};

export default CheckBoxGroup;
