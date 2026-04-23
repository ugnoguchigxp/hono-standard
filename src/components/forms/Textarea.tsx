import type React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  id: string;
  error?: string;
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerProps?: Record<string, any>;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  id,
  error,
  className = '',
  registerProps = {},
  ...textareaProps
}) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        className={`mt-1 block w-full px-3 py-2 border border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-blue-700 focus:border-blue-700 text-sm ${className}`}
        {...registerProps}
        {...textareaProps}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};
