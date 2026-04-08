import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Alert } from './Alert';

describe('Alert', () => {
  it('renders the message', () => {
    render(<Alert message="Test message" />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders close button and calls callback on click', () => {
    const handleClose = vi.fn();
    render(<Alert message="Test" onClose={handleClose} />);

    const closeButton = screen.getByLabelText('閉じる');
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button when onClose is not provided', () => {
    render(<Alert message="Test" />);
    expect(screen.queryByLabelText('閉じる')).not.toBeInTheDocument();
  });

  it('applies alert color utility classes', () => {
    const { container } = render(<Alert message="Test" />);
    const alertDiv = container.firstChild as HTMLElement;
    expect(alertDiv).toHaveClass('bg-[var(--alert-bg)]', 'border-[var(--alert-border)]');
    const icon = container.querySelector('svg');
    expect(icon).toHaveClass('text-[var(--alert-text)]');
    const message = screen.getByText('Test');
    expect(message).toHaveClass('text-[var(--alert-text)]');
  });

  it('aligns close button styling with alert tokens', () => {
    const handleClose = vi.fn();
    const { getByLabelText } = render(<Alert message="Closable" onClose={handleClose} />);
    const closeButton = getByLabelText('閉じる');
    expect(closeButton).toHaveClass('text-[var(--alert-text)]');
    const iconSvg = closeButton.querySelector('svg');
    expect(iconSvg).not.toBeNull();
    expect(iconSvg?.getAttribute('stroke')).toBe('var(--alert-text)');
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('has role="alert" attribute', () => {
    const { container } = render(<Alert message="Test" />);
    const alertDiv = container.firstChild as HTMLElement;
    expect(alertDiv).toHaveAttribute('role', 'alert');
  });

  it('applies custom className', () => {
    const { container } = render(<Alert message="Test" className="custom-class" />);
    const alertDiv = container.firstChild as HTMLElement;
    expect(alertDiv).toHaveClass('custom-class');
  });
});
