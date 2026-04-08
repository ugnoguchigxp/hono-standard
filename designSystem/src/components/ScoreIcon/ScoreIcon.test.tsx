import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScoreIcon, scoreConfig } from './ScoreIcon';

describe('ScoreIcon', () => {
  it('renders correctly', () => {
    render(<ScoreIcon score="A" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    const { container } = render(<ScoreIcon score="B" />);
    const icon = container.querySelector('[role="img"]');
    expect(icon).toHaveAttribute('aria-label', 'Score B: 安定フェーズ');
  });

  describe('Score Types', () => {
    const scores = [
      ['A', '成熟フェーズ'],
      ['B', '安定フェーズ'],
      ['C', '成長フェーズ'],
      ['D', '発展フェーズ'],
      ['E', '準備フェーズ'],
    ] as const;

    it.each(scores)('renders score %s with correct label', (score, label) => {
      const { container } = render(<ScoreIcon score={score} />);
      expect(screen.getByText(score)).toBeInTheDocument();

      const icon = container.querySelector('[role="img"]');
      expect(icon).toHaveAttribute('aria-label', `Score ${score}: ${label}`);

      const config = scoreConfig[score];
      expect(config.label).toBe(label);
    });
  });

  describe('Label Display', () => {
    it('always shows label', () => {
      render(<ScoreIcon score="A" />);
      expect(screen.getByText('成熟フェーズ')).toBeInTheDocument();
    });
  });

  describe('Progress Ring', () => {
    const EXPECTED_CIRCLE_COUNT = 2; // background + progress

    it('renders SVG with correct circles', () => {
      const { container } = render(<ScoreIcon score="A" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();

      const circles = container.querySelectorAll('circle');
      expect(circles).toHaveLength(EXPECTED_CIRCLE_COUNT);
    });

    it.each([
      ['A' as const, 100],
      ['B' as const, 80],
      ['C' as const, 60],
      ['D' as const, 40],
      ['E' as const, 20],
    ])('applies correct progress %d%% for score %s', (score, progress) => {
      const { container } = render(<ScoreIcon score={score} />);
      const progressCircle = container.querySelectorAll('circle')[1];

      expect(progressCircle).toBeInTheDocument();

      // Verify progress configuration matches expected value
      const config = scoreConfig[score];
      expect(config.progress).toBe(progress);
    });
  });

  describe('Styling', () => {
    it('applies CSS variable-based color classes', () => {
      const { container } = render(<ScoreIcon score="A" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toHaveClass('text-score-a');
      const scoreClasses = {
        A: ['text-score-a'],
        B: ['text-score-b'],
        C: ['text-score-c'],
        D: ['text-score-d'],
        E: ['text-score-e'],
      };

      Object.entries(scoreClasses).forEach(([score, classes]) => {
        const { container } = render(<ScoreIcon score={score as keyof typeof scoreConfig} />);
        const icon = container.querySelector('[role="img"]');
        classes.forEach((cls) => {
          expect(icon).toHaveClass(cls);
        });
      });
    });

    it('applies custom className', () => {
      const { container } = render(<ScoreIcon score="A" className="custom-class" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toHaveClass('custom-class');
    });
  });

  describe('Props and Attributes', () => {
    it('passes through other props', () => {
      const { container } = render(
        <ScoreIcon score="A" data-testid="test-score-icon" title="Score Icon" />
      );
      const icon = container.querySelector('[role="img"]');
      expect(icon).toHaveAttribute('data-testid', 'test-score-icon');
      expect(icon).toHaveAttribute('title', 'Score Icon');
    });

    it('handles click events', () => {
      const handleClick = vi.fn();
      const { container } = render(<ScoreIcon score="A" onClick={handleClick} />);

      const icon = container.querySelector('[role="img"]');

      // Verify element exists before clicking
      expect(icon).toBeInTheDocument();

      // Type guard: after null check, TypeScript knows icon is Element
      if (!icon) {
        throw new Error('Icon not found');
      }

      fireEvent.click(icon);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('merges custom className with variant classes', () => {
      const { container } = render(<ScoreIcon score="B" className="custom-class" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toHaveClass('custom-class');
      expect(icon).toHaveClass('w-[140px]', 'h-[140px]', 'text-score-b');
    });
  });

  describe('Forward Ref', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null as HTMLDivElement | null };
      render(<ScoreIcon ref={ref} score="A" />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveClass('relative', 'flex', 'flex-col');
    });

    it('allows ref methods to be called', () => {
      const ref = { current: null as HTMLDivElement | null };
      render(<ScoreIcon ref={ref} score="A" />);

      expect(ref.current?.getAttribute('role')).toBe('img');
    });
  });

  describe('Score Config', () => {
    it('has correct configuration for all scores', () => {
      expect(scoreConfig.A).toEqual({
        label: '成熟フェーズ',
        progress: 100,
      });

      expect(scoreConfig.B).toEqual({
        label: '安定フェーズ',
        progress: 80,
      });

      expect(scoreConfig.C).toEqual({
        label: '成長フェーズ',
        progress: 60,
      });

      expect(scoreConfig.D).toEqual({
        label: '発展フェーズ',
        progress: 40,
      });

      expect(scoreConfig.E).toEqual({
        label: '準備フェーズ',
        progress: 20,
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles missing score gracefully (defaults to A)', () => {
      const { container } = render(<ScoreIcon />);
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('成熟フェーズ')).toBeInTheDocument();

      const icon = container.querySelector('[role="img"]');
      expect(icon).toHaveAttribute('aria-label', 'Score A: 成熟フェーズ');
    });
  });

  describe('Accessibility', () => {
    it('has img role', () => {
      const { container } = render(<ScoreIcon score="A" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toBeInTheDocument();
    });

    it('includes score and label in aria-label', () => {
      const { container } = render(<ScoreIcon score="C" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toHaveAttribute('aria-label', 'Score C: 成長フェーズ');
    });

    it('score text is selectable=false', () => {
      render(<ScoreIcon score="A" />);
      const scoreText = screen.getByText('A');
      const selectableWrapper = scoreText.parentElement;
      expect(selectableWrapper).toHaveClass('select-none');
    });
  });
});
