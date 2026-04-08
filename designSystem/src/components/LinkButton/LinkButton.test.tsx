import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkButton } from './LinkButton';

// Mock navigator.clipboard
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

describe('LinkButton', () => {
  beforeEach(() => {
    mockWriteText.mockClear();
    mockWriteText.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('renders correctly', () => {
      render(<LinkButton text="Copy me" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Copy me')).toBeInTheDocument();
    });

    it('renders default icon (chevron-right)', () => {
      const { container } = render(<LinkButton text="Copy me" />);
      const icon = container.querySelector('.lucide-chevron-right');
      expect(icon).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<LinkButton text="Copy me" className="custom-class" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('has title attribute when iconOnly', () => {
      render(<LinkButton iconOnly text="Copy me" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title');
    });
  });

  describe('Props', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<LinkButton ref={ref} text="Copy me" />);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('spreads additional props', () => {
      render(<LinkButton text="Copy me" data-testid="custom" />);
      expect(screen.getByTestId('custom')).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    it('copies text to clipboard when clicked', async () => {
      const onCopied = vi.fn();
      render(<LinkButton variant="copy" text="Test text" onCopied={onCopied} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await vi.waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Test text');
        expect(onCopied).toHaveBeenCalledWith('Test text');
      });
    });

    it('copies copyValue instead of text when provided', async () => {
      const onCopied = vi.fn();
      render(
        <LinkButton
          variant="copy"
          text="Display text"
          copyValue="Actual copy value"
          onCopied={onCopied}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await vi.waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Actual copy value');
        expect(onCopied).toHaveBeenCalledWith('Actual copy value');
      });
    });

    it('handles clipboard errors', async () => {
      const onCopyError = vi.fn();
      const error = new Error('Clipboard denied');
      mockWriteText.mockRejectedValue(error);

      render(<LinkButton variant="copy" text="Test text" onCopyError={onCopyError} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await vi.waitFor(() => {
        expect(onCopyError).toHaveBeenCalledWith(error);
      });
    });

    it('stops event propagation', async () => {
      const parentClick = vi.fn();
      const TestWrapper = () => {
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper for event propagation
          // biome-ignore lint/a11y/useKeyWithClickEvents: test wrapper for event propagation
          <div onClick={parentClick}>
            <LinkButton variant="copy" text="Test text" />
          </div>
        );
      };

      render(<TestWrapper />);

      const copyButton = screen.getByRole('button', { name: /Test text/i });
      fireEvent.click(copyButton);

      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty text', async () => {
      const onCopied = vi.fn();
      render(<LinkButton variant="copy" text="" onCopied={onCopied} />);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockWriteText).toHaveBeenCalledWith('');
      expect(onCopied).toHaveBeenCalledWith('');
    });

    it('handles whitespace text', async () => {
      const onCopied = vi.fn();
      render(<LinkButton variant="copy" text="   " onCopied={onCopied} />);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockWriteText).toHaveBeenCalledWith('   ');
      expect(onCopied).toHaveBeenCalledWith('   ');
    });

    it('handles special characters', async () => {
      const onCopied = vi.fn();
      const specialText = 'Special chars: !@#$%^&*()';
      render(<LinkButton variant="copy" text={specialText} onCopied={onCopied} />);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockWriteText).toHaveBeenCalledWith(specialText);
      expect(onCopied).toHaveBeenCalledWith(specialText);
    });

    it('handles long text', async () => {
      const onCopied = vi.fn();
      const longText = 'A'.repeat(1000);
      render(<LinkButton variant="copy" text={longText} onCopied={onCopied} />);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(mockWriteText).toHaveBeenCalledWith(longText);
      expect(onCopied).toHaveBeenCalledWith(longText);
    });
  });

  describe('Callback Behavior', () => {
    it('does not call onCopied when not provided', async () => {
      render(<LinkButton variant="copy" text="Test text" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockWriteText).toHaveBeenCalledWith('Test text');
      // No error should be thrown
    });

    it('does not call onCopyError when not provided', async () => {
      mockWriteText.mockRejectedValue(new Error('Test error'));

      render(<LinkButton variant="copy" text="Test text" />);

      const button = screen.getByRole('button');

      // Should not throw error
      expect(() => fireEvent.click(button)).not.toThrow();
    });

    it('calls onCopied with correct value when copyValue is provided', async () => {
      const onCopied = vi.fn();
      render(
        <LinkButton variant="copy" text="Display" copyValue="Copy value" onCopied={onCopied} />
      );

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(onCopied).toHaveBeenCalledTimes(1);
      expect(onCopied).toHaveBeenCalledWith('Copy value');
    });

    it('calls onCopyError with error object', async () => {
      const onCopyError = vi.fn();
      const error = new Error('Permission denied');
      mockWriteText.mockRejectedValue(error);

      render(<LinkButton variant="copy" text="Test text" onCopyError={onCopyError} />);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(onCopyError).toHaveBeenCalledTimes(1);
      expect(onCopyError).toHaveBeenCalledWith(error);
    });
  });

  describe('Component Structure', () => {
    it('renders as button element', () => {
      render(<LinkButton text="Copy me" />);

      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('contains both text and icon', () => {
      render(<LinkButton text="Copy me" />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Copy me');

      const icon = button.querySelector('.lucide-chevron-right');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders link variant by default', () => {
      const { container } = render(<LinkButton text="Copy me" />);
      const icon = container.querySelector('.lucide-chevron-right');
      expect(icon).toBeInTheDocument();
    });

    it('renders copy variant explicitly', () => {
      const { container } = render(<LinkButton variant="copy" text="Copy me" />);
      const icon = container.querySelector('.lucide-files');
      expect(icon).toBeInTheDocument();
    });

    it('renders link variant with chevron-right icon', () => {
      const { container } = render(
        <LinkButton variant="link" text="Open link" href="https://example.com" />
      );
      const icon = container.querySelector('.lucide-chevron-right');
      expect(icon).toBeInTheDocument();
    });

    it('copy variant calls clipboard API', async () => {
      const onCopied = vi.fn();
      render(<LinkButton variant="copy" text="Test" onCopied={onCopied} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await vi.waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Test');
        expect(onCopied).toHaveBeenCalledWith('Test');
      });
    });

    it('link variant opens URL in new tab', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      render(<LinkButton variant="link" text="Open" href="https://example.com" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');

      openSpy.mockRestore();
    });

    it('link variant without href does nothing on click', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      render(<LinkButton variant="link" text="No href" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(openSpy).not.toHaveBeenCalled();

      openSpy.mockRestore();
    });
  });
});
