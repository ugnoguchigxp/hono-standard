import type React from 'react';

interface GenderRadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}

export const GenderRadioGroup: React.FC<GenderRadioGroupProps> = ({
  value,
  onChange,
  error,
  className = '',
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
    <div className="flex gap-4">
      <label>
        <input
          type="radio"
          name="gender"
          value="male"
          checked={value === 'male'}
          onChange={() => onChange('male')}
        />{' '}
        男性
      </label>
      <label>
        <input
          type="radio"
          name="gender"
          value="female"
          checked={value === 'female'}
          onChange={() => onChange('female')}
        />{' '}
        女性
      </label>
      <label>
        <input
          type="radio"
          name="gender"
          value="other"
          checked={value === 'other'}
          onChange={() => onChange('other')}
        />{' '}
        その他
      </label>
    </div>
    {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
  </div>
);

export default GenderRadioGroup;
