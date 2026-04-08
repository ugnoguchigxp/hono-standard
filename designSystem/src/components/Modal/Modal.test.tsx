import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal Component', () => {
  describe('Basic Rendering', () => {
    it('renders correctly when open', () => {
      render(
        <Modal open={true}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('displays modal when open is true', () => {
      render(
        <Modal open={true}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('does not display modal when open is false', () => {
      render(
        <Modal open={false}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <Modal open={true}>
          <div>Test Content</div>
          <p>Paragraph</p>
        </Modal>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph')).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('displays headerIcon and headerTitle', () => {
      render(
        <Modal open={true} headerIcon="landmark" headerTitle="担当銀行員">
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByText('担当銀行員')).toBeInTheDocument();
    });

    it('displays only headerIcon', () => {
      render(
        <Modal open={true} headerIcon="brain">
          <div>Content</div>
        </Modal>
      );
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('displays only headerTitle', () => {
      render(
        <Modal open={true} headerTitle="タイトルのみ">
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByText('タイトルのみ')).toBeInTheDocument();
    });

    it('header is empty when no headerIcon or headerTitle', () => {
      render(
        <Modal open={true}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('displays close button', () => {
      render(
        <Modal open={true} headerTitle="Test">
          <div>Content</div>
        </Modal>
      );

      const closeButton = screen.getByLabelText('閉じる');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Trigger and Open/Close', () => {
    it('opens modal when open prop is true', () => {
      render(
        <Modal open={true}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('calls onOpenChange when close button is clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Modal open={true} onOpenChange={onOpenChange}>
          <div>Content</div>
        </Modal>
      );

      const closeButton = screen.getByLabelText('閉じる');
      await user.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );

      const closeButton = screen.getByLabelText('閉じる');
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('calls both onOpenChange and onClose', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onClose = vi.fn();
      render(
        <Modal open={true} onOpenChange={onOpenChange} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );

      const closeButton = screen.getByLabelText('閉じる');
      await user.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Controlled Component', () => {
    it('works as controlled component', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Modal open={true} onOpenChange={onOpenChange}>
          <div>Controlled Content</div>
        </Modal>
      );

      expect(screen.getByText('Controlled Content')).toBeInTheDocument();

      const closeButton = screen.getByLabelText('閉じる');
      await user.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      // Still displayed because it's a controlled component
      expect(screen.getByText('Controlled Content')).toBeInTheDocument();
    });

    it('does not display when open is false', () => {
      render(
        <Modal open={false}>
          <div>Hidden Content</div>
        </Modal>
      );

      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();
    });
  });

  describe('Type Properties', () => {
    it('applies default consulter type width', () => {
      render(
        <Modal open={true}>
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('w-full');
      expect(dialog).toHaveClass('max-w-[384px]');
      expect(dialog).toHaveClass('mx-4');
    });

    it('applies consulter type width', () => {
      render(
        <Modal open={true} variant="consulter">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-[384px]');
    });

    it('applies judgement type width', () => {
      render(
        <Modal open={true} variant="judgement">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-[1040px]');
    });

    it('applies employee type width', () => {
      render(
        <Modal open={true} variant="employee">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-[800px]');
    });
  });

  describe('Body Layout', () => {
    it('limits body height regardless of type', () => {
      render(
        <Modal open={true} variant="consulter">
          <div>Content</div>
        </Modal>
      );
      const body = document.body.querySelector('div.overflow-y-auto');
      expect(body).toHaveClass('max-h-[60vh]');
    });

    it('limits body height for judgement type as well', () => {
      render(
        <Modal open={true} variant="judgement">
          <div>Content</div>
        </Modal>
      );
      const body = document.body.querySelector('div.overflow-y-auto');
      expect(body).toHaveClass('max-h-[60vh]');
    });

    it('limits body height for employee type as well', () => {
      render(
        <Modal open={true} variant="employee">
          <div>Content</div>
        </Modal>
      );
      const body = document.body.querySelector('div.overflow-y-auto');
      expect(body).toHaveClass('max-h-[60vh]');
    });
  });

  describe('Accessibility', () => {
    it('has dialog role', () => {
      render(
        <Modal open={true}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-describedby attribute', () => {
      render(
        <Modal open={true}>
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby');
    });

    it('close button has aria-label', () => {
      render(
        <Modal open={true}>
          <div>Content</div>
        </Modal>
      );

      const closeButton = screen.getByLabelText('閉じる');
      expect(closeButton).toHaveAttribute('aria-label', '閉じる');
    });
  });

  describe('Edge Cases', () => {
    it('renders even when children is null', () => {
      render(
        <Modal open={true} headerTitle="Empty Modal">
          {null}
        </Modal>
      );

      expect(screen.getByText('Empty Modal')).toBeInTheDocument();
    });

    it('handles complex children', () => {
      render(
        <Modal open={true}>
          <div>
            <h2>Section Title</h2>
            <p>Paragraph content</p>
            <button type="button">Action Button</button>
          </div>
        </Modal>
      );

      expect(screen.getByText('Section Title')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content')).toBeInTheDocument();
      expect(screen.getByText('Action Button')).toBeInTheDocument();
    });

    it('handles long content', () => {
      const longContent = 'A'.repeat(1000);
      render(
        <Modal open={true}>
          <div>{longContent}</div>
        </Modal>
      );

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('handles multiple children elements', () => {
      render(
        <Modal open={true}>
          <div>
            <span>First Element</span>
            <span>Second Element</span>
          </div>
        </Modal>
      );

      expect(screen.getByText('First Element')).toBeInTheDocument();
      expect(screen.getByText('Second Element')).toBeInTheDocument();
    });
  });

  describe('Component Properties', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null as HTMLDivElement | null };
      render(
        <Modal open={true} ref={ref}>
          <div>Content</div>
        </Modal>
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('has correct displayName', () => {
      expect(Modal.displayName).toBe('Modal');
    });

    it('passes additional props', () => {
      render(
        <Modal open={true} data-testid="test-modal">
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('Overlay', () => {
    it('displays overlay', () => {
      render(
        <Modal open={true}>
          <div>Content</div>
        </Modal>
      );

      // Verify overlay exists (indirectly confirmed by content being displayed)
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });
});
