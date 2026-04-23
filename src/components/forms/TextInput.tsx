import type React from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
  className?: string;
  // react-hook-form register などのspread用
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerProps?: Record<string, any>;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  id,
  error,
  className = '',
  registerProps = {},
  ...inputProps
}) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        className={`mt-1 block w-full px-3 py-2 border border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-blue-700 focus:border-blue-700 text-sm ${className}`}
        {...registerProps}
        {...inputProps}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};
