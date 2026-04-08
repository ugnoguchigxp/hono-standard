import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Rating } from './Rating';

describe('Rating', () => {
  describe('Star rendering', () => {
    it('renders 5 empty stars for 0.0 rating', () => {
      const { container } = render(<Rating num={0} />);
      const stars = container.querySelectorAll('svg');
      expect(stars).toHaveLength(5);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 0.0 / 5.0');
    });

    it('renders 5 full stars for 5.0 rating', () => {
      const { container } = render(<Rating num={5} />);
      const stars = container.querySelectorAll('svg');
      expect(stars).toHaveLength(5);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 5.0 / 5.0');
    });

    it('renders 3 full stars, 1 partial star, and 1 empty star for 3.5 rating', () => {
      const { container } = render(<Rating num={3.5} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 3.5 / 5.0');
      const partialStarContainer = container.querySelector('.relative.inline-block');
      expect(partialStarContainer).toBeInTheDocument();
    });

    it('renders correct number of stars for 2.3 rating', () => {
      render(<Rating num={2.3} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 2.3 / 5.0');
    });

    it('renders 1 full star for 1.0 rating', () => {
      const { container } = render(<Rating num={1.0} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 1.0 / 5.0');
      const stars = container.querySelectorAll('svg');
      expect(stars).toHaveLength(5);
    });

    it('renders 4 full stars and 1 empty star for 4.0 rating', () => {
      const { container } = render(<Rating num={4.0} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 4.0 / 5.0');
      const stars = container.querySelectorAll('svg');
      expect(stars).toHaveLength(5);
    });

    it('renders partial star for 0.5 rating', () => {
      const { container } = render(<Rating num={0.5} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 0.5 / 5.0');
      const partialStarContainer = container.querySelector('.relative.inline-block');
      expect(partialStarContainer).toBeInTheDocument();
    });

    it('renders partial star for 4.7 rating', () => {
      const { container } = render(<Rating num={4.7} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 4.7 / 5.0');
      const partialStarContainer = container.querySelector('.relative.inline-block');
      expect(partialStarContainer).toBeInTheDocument();
    });

    it('renders correct partial star width for 2.25 rating', () => {
      const { container } = render(<Rating num={2.25} />);
      const partialStarContainer = container.querySelector('.absolute.inset-0.overflow-hidden');
      expect(partialStarContainer).toBeInTheDocument();
      expect(partialStarContainer).toHaveStyle({ width: '25%' });
    });

    it('renders correct partial star width for 3.75 rating', () => {
      const { container } = render(<Rating num={3.75} />);
      const partialStarContainer = container.querySelector('.absolute.inset-0.overflow-hidden');
      expect(partialStarContainer).toBeInTheDocument();
      expect(partialStarContainer).toHaveStyle({ width: '75%' });
    });
  });

  describe('Value clamping', () => {
    it('clamps negative values to 0', () => {
      render(<Rating num={-1} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 0.0 / 5.0');
    });

    it('clamps large negative values to 0', () => {
      render(<Rating num={-100} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 0.0 / 5.0');
    });

    it('clamps values above 5 to 5', () => {
      render(<Rating num={10} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 5.0 / 5.0');
    });

    it('clamps very large values to 5', () => {
      render(<Rating num={999} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 5.0 / 5.0');
    });

    it('handles edge case of exactly 5.0', () => {
      render(<Rating num={5.0} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 5.0 / 5.0');
    });

    it('handles edge case of exactly 0.0', () => {
      render(<Rating num={0.0} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 0.0 / 5.0');
    });

    it('handles values just below 5', () => {
      render(<Rating num={4.99} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 5.0 / 5.0');
    });

    it('handles values just above 0', () => {
      render(<Rating num={0.01} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 0.0 / 5.0');
    });
  });

  describe('Color customization', () => {
    it('applies default color when not specified', () => {
      const { container } = render(<Rating num={4} />);
      const stars = container.querySelectorAll('svg');
      expect(stars.length).toBeGreaterThan(0);
      const filledStar = container.querySelector('svg[fill="#facc15"]');
      expect(filledStar).toBeInTheDocument();
    });

    it('applies custom red color to stars', () => {
      const { container } = render(<Rating num={4} color="#ff0000" />);
      const filledStar = container.querySelector('svg[fill="#ff0000"]');
      expect(filledStar).toBeInTheDocument();
    });

    it('applies custom blue color to stars', () => {
      const { container } = render(<Rating num={3} color="#0000ff" />);
      const filledStar = container.querySelector('svg[fill="#0000ff"]');
      expect(filledStar).toBeInTheDocument();
    });

    it('applies custom green color to stars', () => {
      const { container } = render(<Rating num={2.5} color="#00ff00" />);
      const filledStar = container.querySelector('svg[fill="#00ff00"]');
      expect(filledStar).toBeInTheDocument();
    });

    it('applies color to partial stars', () => {
      const { container } = render(<Rating num={3.5} color="#ff6600" />);
      const partialStar = container.querySelector('.relative.inline-block svg[fill="#ff6600"]');
      expect(partialStar).toBeInTheDocument();
    });

    it('applies color to empty star strokes', () => {
      const { container } = render(<Rating num={2} color="#9933cc" />);
      const emptyStar = container.querySelector('svg[stroke="#9933cc"][fill="none"]');
      expect(emptyStar).toBeInTheDocument();
    });

    it('supports hex color with alpha', () => {
      const { container } = render(<Rating num={4} color="#ff000080" />);
      const filledStar = container.querySelector('svg[fill="#ff000080"]');
      expect(filledStar).toBeInTheDocument();
    });

    it('supports rgb color format', () => {
      const { container } = render(<Rating num={4} color="rgb(255, 0, 0)" />);
      const filledStar = container.querySelector('svg[fill="rgb(255, 0, 0)"]');
      expect(filledStar).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('applies sm size variant', () => {
      const { container } = render(<Rating num={4} size="sm" />);
      expect(container.firstChild).toHaveClass('text-sm');
    });

    it('applies md size variant', () => {
      const { container } = render(<Rating num={4} size="md" />);
      expect(container.firstChild).toHaveClass('text-base');
    });

    it('uses md as default size', () => {
      const { container } = render(<Rating num={4} />);
      expect(container.firstChild).toHaveClass('text-base');
    });
  });

  describe('Props and Attributes', () => {
    it('applies custom className', () => {
      const { container } = render(<Rating num={4} className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('passes through other props', () => {
      render(<Rating num={4} data-testid="test-rating" title="Rating Title" />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('data-testid', 'test-rating');
      expect(rating).toHaveAttribute('title', 'Rating Title');
    });
  });

  describe('Accessibility', () => {
    it("has role='img' for screen readers", () => {
      render(<Rating num={3.5} />);
      const rating = screen.getByRole('img');
      expect(rating).toBeInTheDocument();
    });

    it('provides descriptive aria-label', () => {
      render(<Rating num={4.2} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 4.2 / 5.0');
    });

    it('provides aria-label with one decimal place', () => {
      render(<Rating num={3.567} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 3.6 / 5.0');
    });

    it('hides decorative stars from screen readers', () => {
      const { container } = render(<Rating num={3} />);
      const hiddenStars = container.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenStars.length).toBeGreaterThan(0);
    });

    it('hides all individual stars with aria-hidden', () => {
      const { container } = render(<Rating num={3.5} />);
      const allStars = container.querySelectorAll('svg');
      const hiddenStars = container.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenStars.length).toBeGreaterThan(0);
      expect(allStars.length).toBeGreaterThan(0);
    });

    it('provides semantic rating information', () => {
      render(<Rating num={4.8} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAccessibleName('評価: 4.8 / 5.0');
    });

    it('maintains accessibility with custom props', () => {
      render(<Rating num={3.2} color="#ff0000" size="sm" />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '評価: 3.2 / 5.0');
    });
  });

  describe('Base Classes', () => {
    it('has base rating classes', () => {
      const { container } = render(<Rating num={4} />);
      expect(container.firstChild).toHaveClass('inline-flex', 'items-center', 'gap-0.5');
    });

    it('maintains base classes with custom className', () => {
      const { container } = render(<Rating num={4} className="custom" />);
      expect(container.firstChild).toHaveClass('inline-flex', 'items-center', 'gap-0.5', 'custom');
    });
  });

  describe('Component Integration', () => {
    it('works with multiple instances', () => {
      const { container } = render(
        <div>
          <Rating num={3} />
          <Rating num={4.5} />
          <Rating num={2.5} />
        </div>
      );
      const ratings = container.querySelectorAll('[role="img"]');
      expect(ratings).toHaveLength(3);
    });

    it('maintains independent state for multiple instances', () => {
      render(
        <div>
          <Rating num={1} data-testid="rating-1" />
          <Rating num={5} data-testid="rating-5" />
        </div>
      );
      expect(screen.getByTestId('rating-1')).toHaveAttribute('aria-label', '評価: 1.0 / 5.0');
      expect(screen.getByTestId('rating-5')).toHaveAttribute('aria-label', '評価: 5.0 / 5.0');
    });

    it('can be nested in other components', () => {
      const { container } = render(
        <div className="wrapper">
          <div className="inner">
            <Rating num={4} />
          </div>
        </div>
      );
      const rating = container.querySelector('[role="img"]');
      expect(rating).toBeInTheDocument();
    });
  });

  describe('Performance and Rendering', () => {
    it('renders efficiently with integer values', () => {
      const { container } = render(<Rating num={3} />);
      const partialStarContainer = container.querySelector('.relative.inline-block');
      expect(partialStarContainer).not.toBeInTheDocument();
    });

    it('renders efficiently with no partial stars needed', () => {
      const { container } = render(<Rating num={4.0} />);
      const partialStarContainer = container.querySelector('.relative.inline-block');
      expect(partialStarContainer).not.toBeInTheDocument();
    });

    it('updates correctly when num prop changes', () => {
      const { rerender } = render(<Rating num={2} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 2.0 / 5.0');

      rerender(<Rating num={4.5} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 4.5 / 5.0');
    });

    it('updates correctly when color prop changes', () => {
      const { container, rerender } = render(<Rating num={3} color="#ff0000" />);
      expect(container.querySelector('svg[fill="#ff0000"]')).toBeInTheDocument();

      rerender(<Rating num={3} color="#00ff00" />);
      expect(container.querySelector('svg[fill="#00ff00"]')).toBeInTheDocument();
    });

    it('updates correctly when size prop changes', () => {
      const { container, rerender } = render(<Rating num={3} size="sm" />);
      expect(container.firstChild).toHaveClass('text-sm');

      rerender(<Rating num={3} size="md" />);
      expect(container.firstChild).toHaveClass('text-base');
    });
  });

  describe('Edge Cases and Special Values', () => {
    it('handles very small decimal values', () => {
      render(<Rating num={0.001} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 0.0 / 5.0');
    });

    it('handles values very close to 5', () => {
      render(<Rating num={4.999} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 5.0 / 5.0');
    });

    it('handles NaN gracefully', () => {
      render(<Rating num={Number.NaN} />);
      const rating = screen.getByRole('img');
      expect(rating).toBeInTheDocument();
      expect(rating).toHaveAttribute('aria-label', '評価: 0.0 / 5.0');
    });

    it('handles Infinity gracefully', () => {
      render(<Rating num={Number.POSITIVE_INFINITY} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 5.0 / 5.0');
    });

    it('handles negative Infinity gracefully', () => {
      render(<Rating num={Number.NEGATIVE_INFINITY} />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '評価: 0.0 / 5.0');
    });
  });

  describe('Component displayName', () => {
    it('has correct displayName', () => {
      expect(Rating.displayName).toBe('Rating');
    });
  });
});
