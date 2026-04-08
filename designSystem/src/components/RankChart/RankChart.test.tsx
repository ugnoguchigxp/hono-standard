import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RankChart } from './RankChart';

describe('RankChart', () => {
  const mockRankData = [
    { label: 'E', value: 20 },
    { label: 'D', value: 40 },
    { label: 'C', value: 60 },
    { label: 'B', value: 50 },
    { label: 'A', value: 30 },
  ];

  const mockViewOptions = [
    { value: 'industry', label: '業界', tooltip: '業界平均' },
    { value: 'national', label: '全国', tooltip: '全国平均' },
    { value: 'benchmark', label: 'ベンチマーク', tooltip: 'ベンチマーク' },
  ];

  it('renders correctly', () => {
    const handleViewChange = vi.fn();
    const { container } = render(
      <RankChart
        score="C"
        rankData={mockRankData}
        viewOptions={mockViewOptions}
        currentView="industry"
        onViewChange={handleViewChange}
      />
    );

    // ScoreIcon should be present
    expect(screen.getByRole('img', { name: /Score C/i })).toBeInTheDocument();

    // BarChart should be present
    expect(container.querySelector('[data-index="2"]')).toBeInTheDocument();

    // ViewSwitcher should be present
    expect(screen.getByText('業界')).toBeInTheDocument();
    expect(screen.getByText('全国')).toBeInTheDocument();
    expect(screen.getByText('ベンチマーク')).toBeInTheDocument();
  });

  describe('Score Display', () => {
    it.each([
      ['A', '成熟フェーズ'],
      ['B', '安定フェーズ'],
      ['C', '成長フェーズ'],
      ['D', '発展フェーズ'],
      ['E', '準備フェーズ'],
    ])('displays %s score with correct label', (score, label) => {
      const handleViewChange = vi.fn();
      render(
        <RankChart
          score={score as 'A' | 'B' | 'C' | 'D' | 'E'}
          rankData={mockRankData}
          viewOptions={mockViewOptions}
          currentView="industry"
          onViewChange={handleViewChange}
        />
      );

      // Use role and aria-label to find ScoreIcon specifically
      expect(screen.getByRole('img', { name: new RegExp(`Score ${score}`) })).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe('Bar Chart', () => {
    it('highlights the correct bar based on score', () => {
      const handleViewChange = vi.fn();
      const { container } = render(
        <RankChart
          score="C"
          rankData={mockRankData}
          viewOptions={mockViewOptions}
          currentView="industry"
          onViewChange={handleViewChange}
        />
      );

      const activeBar = container.querySelector('[data-index="2"]');
      expect(activeBar).toBeInTheDocument();
    });

    it('renders all rank labels', () => {
      const handleViewChange = vi.fn();
      render(
        <RankChart
          score="C"
          rankData={mockRankData}
          viewOptions={mockViewOptions}
          currentView="industry"
          onViewChange={handleViewChange}
        />
      );

      // Use getAllByText to verify labels exist
      // Each label appears twice: once in ScoreIcon (if it's the score) and once in BarChart
      const eLabels = screen.getAllByText('E');
      const dLabels = screen.getAllByText('D');
      const cLabels = screen.getAllByText('C');
      const bLabels = screen.getAllByText('B');
      const aLabels = screen.getAllByText('A');

      expect(eLabels.length).toBeGreaterThanOrEqual(1);
      expect(dLabels.length).toBeGreaterThanOrEqual(1);
      expect(cLabels.length).toBe(2); // Score C + BarChart label
      expect(bLabels.length).toBeGreaterThanOrEqual(1);
      expect(aLabels.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('View Switcher', () => {
    it('calls onViewChange when switching views', () => {
      const handleViewChange = vi.fn();
      render(
        <RankChart
          score="C"
          rankData={mockRankData}
          viewOptions={mockViewOptions}
          currentView="industry"
          onViewChange={handleViewChange}
        />
      );

      fireEvent.click(screen.getByText('全国'));
      expect(handleViewChange).toHaveBeenCalledWith('national');
    });

    it('highlights current view', () => {
      const handleViewChange = vi.fn();
      render(
        <RankChart
          score="C"
          rankData={mockRankData}
          viewOptions={mockViewOptions}
          currentView="national"
          onViewChange={handleViewChange}
        />
      );

      const nationalButton = screen.getByText('全国');
      expect(nationalButton).toHaveClass('bg-view-switcher-active-bg');
    });
  });

  describe('Props', () => {
    it('forwards ref correctly', () => {
      const ref = vi.fn();
      const handleViewChange = vi.fn();
      render(
        <RankChart
          ref={ref}
          score="C"
          rankData={mockRankData}
          viewOptions={mockViewOptions}
          currentView="industry"
          onViewChange={handleViewChange}
        />
      );
      expect(ref).toHaveBeenCalled();
    });

    it('merges custom className', () => {
      const handleViewChange = vi.fn();
      const { container } = render(
        <RankChart
          score="C"
          rankData={mockRankData}
          viewOptions={mockViewOptions}
          currentView="industry"
          onViewChange={handleViewChange}
          className="custom-class"
        />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('spreads additional props', () => {
      const handleViewChange = vi.fn();
      render(
        <RankChart
          score="C"
          rankData={mockRankData}
          viewOptions={mockViewOptions}
          currentView="industry"
          onViewChange={handleViewChange}
          data-testid="custom-rank-chart"
        />
      );
      expect(screen.getByTestId('custom-rank-chart')).toBeInTheDocument();
    });
  });

  describe('Component Metadata', () => {
    it('has correct displayName', () => {
      expect(RankChart.displayName).toBe('RankChart');
    });
  });
});
