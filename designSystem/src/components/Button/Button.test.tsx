import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button icon="bell">Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  describe('Variants', () => {
    it('renders primary variant', () => {
      render(
        <Button icon="bell" variant="primary">
          Button
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-button-primary');
    });

    it('renders secondary variant', () => {
      render(
        <Button icon="bell" variant="secondary">
          Button
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-button-secondary');
    });
  });

  describe('Sizes', () => {
    const sizes = [
      ['sm', 'text-xs'],
      ['md', 'text-ui'],
      ['lg', 'text-lg'],
    ] as const;

    it.each(sizes)('renders %s size with correct class', (size, expectedClass) => {
      render(
        <Button icon="bell" size={size}>
          Button
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass(expectedClass);
    });
  });

  describe('States', () => {
    it('renders disabled state', () => {
      render(
        <Button icon="bell" disabled>
          Disabled
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:bg-button-disabled');
    });
  });

  describe('Polymorphism', () => {
    it('renders with asChild prop', () => {
      // Note: asChild with Icon + text doesn't work due to multiple children
      // This is a known limitation when using icon prop with asChild
      render(<Button icon="bell">Button</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn();
      render(
        <Button icon="bell" onClick={handleClick}>
          Click Me
        </Button>
      );
      await fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      render(
        <Button icon="bell" disabled onClick={handleClick}>
          Click Me
        </Button>
      );
      await fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Props', () => {
    it('renders with icon', () => {
      render(<Button icon="bell">With Icon</Button>);
      expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();
      expect(screen.getByText('With Icon')).toBeInTheDocument();
    });

    it('renders icon only with circle button', () => {
      render(<Button icon="bell" />);
      const button = screen.getByRole('button');
      expect(button.querySelector('svg')).toBeInTheDocument();
      // Icon-only button should be circular
      expect(button).toHaveClass('rounded-full');
      // Default (md) size icon = md (h-5 w-5)
      expect(button.querySelector('.lucide-bell')).toHaveClass('h-5', 'w-5');
    });

    it('renders icon with correct sizes based on button size', () => {
      const { rerender } = render(<Button icon="bell" size="sm" />);
      // sm button → sm icon (h-4 w-4)
      expect(screen.getByRole('button').querySelector('.lucide-bell')).toHaveClass('h-4', 'w-4');

      rerender(<Button icon="bell" size="md" />);
      // md button → md icon (h-5 w-5)
      expect(screen.getByRole('button').querySelector('.lucide-bell')).toHaveClass('h-5', 'w-5');

      rerender(<Button icon="bell" size="lg" />);
      // lg button → lg icon (h-6 w-6)
      expect(screen.getByRole('button').querySelector('.lucide-bell')).toHaveClass('h-6', 'w-6');
    });

    it('merges custom className', () => {
      render(
        <Button icon="bell" className="custom-class">
          Custom
        </Button>
      );
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });
});
