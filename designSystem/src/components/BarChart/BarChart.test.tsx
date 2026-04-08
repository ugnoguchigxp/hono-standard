import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { BarChart, type BarChartDataItem } from './BarChart';

const mockData: BarChartDataItem[] = [
  { label: 'E', value: 75 },
  { label: 'D', value: 120 },
  { label: 'C', value: 200 },
  { label: 'B', value: 110 },
  { label: 'A', value: 65 },
];

describe('BarChart', () => {
  it('renders correctly with required props', () => {
    const { container } = render(<BarChart data={mockData} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders all bars', () => {
    const { container } = render(<BarChart data={mockData} />);
    const bars = container.querySelectorAll('button[data-index]');
    expect(bars).toHaveLength(mockData.length);
  });

  it('renders labels correctly', () => {
    render(<BarChart data={mockData} />);
    for (const item of mockData) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
  });

  describe('Props', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<BarChart ref={ref} data={mockData} />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('spreads additional props', () => {
      render(<BarChart data={mockData} data-testid="custom-chart" />);
      expect(screen.getByTestId('custom-chart')).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = render(<BarChart data={mockData} className="custom-class" />);
      const element = container.firstChild;
      if (element instanceof HTMLElement) {
        expect(element.className).toContain('custom-class');
      }
    });
  });

  describe('Active Bar', () => {
    it('highlights active bar when activeIndex is provided', () => {
      const { container } = render(<BarChart data={mockData} activeIndex={2} />);
      const bars = container.querySelectorAll('.rounded-t-lg');
      const activeBar = bars[2];
      if (activeBar instanceof HTMLElement) {
        expect(activeBar.className).toContain('bg-primary');
      }
    });

    it('renders non-active bars with muted background', () => {
      const { container } = render(<BarChart data={mockData} activeIndex={2} />);
      const bars = container.querySelectorAll('.rounded-t-lg');
      const nonActiveBar = bars[0];
      if (nonActiveBar instanceof HTMLElement) {
        expect(nonActiveBar.className).toContain('bg-muted');
      }
    });
  });

  describe('Data Validation', () => {
    it('renders with empty data array', () => {
      const { container } = render(<BarChart data={[]} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('renders with single data item', () => {
      const singleData: BarChartDataItem[] = [{ label: 'A', value: 100 }];
      render(<BarChart data={singleData} />);
      expect(screen.getByText('A')).toBeInTheDocument();
    });
  });
});
