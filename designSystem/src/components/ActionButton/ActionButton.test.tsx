import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionButton } from './ActionButton';

describe('ActionButton', () => {
  it('renders correctly', () => {
    render(<ActionButton icon="brain" label="AIエージェント" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('AIエージェント')).toBeInTheDocument();
  });

  it('renders with correct background color', () => {
    render(<ActionButton icon="brain" label="Test" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-action-button');
  });

  describe('Active State', () => {
    it('shows badge when active is true', () => {
      const { container } = render(<ActionButton icon="brain" label="Test" active />);
      const badge = container.querySelector('.bg-destructive');
      expect(badge).toBeInTheDocument();
    });

    it('does not show badge when active is false', () => {
      const { container } = render(<ActionButton icon="brain" label="Test" active={false} />);
      const badge = container.querySelector('.bg-destructive');
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe('Icon', () => {
    it('renders with string icon', () => {
      const { container } = render(<ActionButton icon="brain" label="Test" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders without icon', () => {
      const { container } = render(<ActionButton label="Test" />);
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<ActionButton ref={ref} icon="brain" label="Test" />);
      expect(ref).toHaveBeenCalled();
    });

    it('spreads additional props', () => {
      render(<ActionButton icon="brain" label="Test" data-testid="custom-button" />);
      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });

    it('merges custom className', () => {
      render(<ActionButton icon="brain" label="Test" className="custom-class" />);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('handles disabled state', () => {
      render(<ActionButton icon="brain" label="Test" disabled />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('passes through aria attributes', () => {
      render(<ActionButton icon="brain" label="Test" aria-label="Custom label" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom label');
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<ActionButton icon="brain" label="Test" onClick={handleClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<ActionButton icon="brain" label="Test" onClick={handleClick} disabled />);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Component Metadata', () => {
    it('has correct displayName', () => {
      expect(ActionButton.displayName).toBe('ActionButton');
    });
  });
});
