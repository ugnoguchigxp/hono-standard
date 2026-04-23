import { Link } from '@tanstack/react-router';
import { forwardRef, type ReactNode } from 'react';
import type { IconType } from 'react-icons';

export type ButtonProps = {
  id?: string; // ボタンのID
  label?: ReactNode; // ボタンのラベルをReactNode型に変更
  icon?: IconType | ReactNode; // アイコンコンポーネントまたはReactNode
  to?: string; // リンク先 (TanStack Router 用)
  onClick?: () => void; // クリック時のアクション
  className?: string; // カスタムクラス
  disabled?: boolean; // 無効化フラグ
  children?: ReactNode; // 子要素をサポート
  type?: 'button' | 'submit' | 'reset'; // ボタンのタイプを指定
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const {
    id,
    label,
    icon,
    to,
    onClick,
    className = '',
    disabled = false,
    children,
    type = 'button',
  } = props;

  // ボタンのバリエーションをclassNameで判定
  let colorClass = '';
  if (className.includes('error') || className.includes('danger') || className.includes('delete')) {
    colorClass = 'bg-red-600 text-white hover:bg-red-700';
  } else if (className.includes('secondary') || className.includes('cancel')) {
    colorClass = 'bg-gray-500 text-white hover:bg-gray-600';
  } else if (className.includes('bg-transparent')) {
    colorClass = '';
  } else {
    colorClass = 'bg-blue-600 text-white hover:bg-blue-700';
  }

  const baseClass = `px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
    disabled ? 'opacity-50 cursor-not-allowed' : ''
  } ${colorClass} ${className}`;

  const renderIcon = () => {
    if (icon && typeof icon === 'function') {
      const IconComponent = icon as IconType;
      return <IconComponent className="text-lg" />;
    }
    return icon;
  };

  if (to) {
    return (
      <Link
        to={to as any}
        className={baseClass}
        onClick={disabled ? undefined : onClick}
        id={id}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        {renderIcon()}
        {label}
        {children}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      id={id}
      type={type}
      className={baseClass}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {renderIcon()}
      {label}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
