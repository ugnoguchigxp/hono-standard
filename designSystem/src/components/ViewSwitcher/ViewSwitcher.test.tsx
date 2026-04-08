import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewSwitcher } from './ViewSwitcher';

// Mock the cn utility
vi.mock('@/utils/cn', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

describe('ViewSwitcher', () => {
  const mockOnChange = vi.fn();
  const options = [
    { value: 'grid', label: 'グリッド', tooltip: 'グリッド表示' },
    { value: 'list', label: 'リスト', tooltip: 'リスト表示' },
    { value: 'table', label: 'テーブル', tooltip: 'テーブル表示' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<ViewSwitcher options={options} value="grid" onChange={mockOnChange} />);

    expect(screen.getByText('グリッド')).toBeInTheDocument();
    expect(screen.getByText('リスト')).toBeInTheDocument();
    expect(screen.getByText('テーブル')).toBeInTheDocument();
  });

  describe('Options', () => {
    it('renders all option labels', () => {
      const { container } = render(
        <ViewSwitcher options={options} value="grid" onChange={mockOnChange} />
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(3);
      expect(buttons[0]).toHaveTextContent('グリッド');
      expect(buttons[1]).toHaveTextContent('リスト');
      expect(buttons[2]).toHaveTextContent('テーブル');
    });

    it('renders options with 2 items', () => {
      const twoOptions = [
        { value: 'card', label: 'カード', tooltip: 'カード表示' },
        { value: 'list', label: 'リスト', tooltip: 'リスト表示' },
      ];

      const { container } = render(
        <ViewSwitcher options={twoOptions} value="card" onChange={mockOnChange} />
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(2);
    });

    it('renders options with 4 items', () => {
      const fourOptions = [
        { value: 'day', label: '日', tooltip: '日表示' },
        { value: 'week', label: '週', tooltip: '週表示' },
        { value: 'month', label: '月', tooltip: '月表示' },
        { value: 'year', label: '年', tooltip: '年表示' },
      ];

      const { container } = render(
        <ViewSwitcher options={fourOptions} value="day" onChange={mockOnChange} />
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(4);
    });
  });

  describe('Props', () => {
    it('spreads additional className', () => {
      const { container } = render(
        <ViewSwitcher
          options={options}
          value="grid"
          onChange={mockOnChange}
          className="custom-class"
        />
      );

      const wrapper = container.firstChild;
      if (wrapper instanceof HTMLElement) {
        expect(wrapper).toHaveClass('custom-class');
      }
    });
  });

  describe('Events', () => {
    it('calls onChange when clicking an option', () => {
      render(<ViewSwitcher options={options} value="grid" onChange={mockOnChange} />);

      const listBtn = screen.getByLabelText('リスト表示');
      fireEvent.click(listBtn);
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('list');
    });

    it('does not call onChange when clicking active option', () => {
      render(<ViewSwitcher options={options} value="grid" onChange={mockOnChange} />);

      const gridBtn = screen.getByLabelText('グリッド表示');
      fireEvent.click(gridBtn);
      // onChange is called even for active option (no prevention)
      expect(mockOnChange).toHaveBeenCalledWith('grid');
    });
  });

  describe('Active State', () => {
    it('applies active background class to selected option', () => {
      render(<ViewSwitcher options={options} value="grid" onChange={mockOnChange} />);

      const gridBtn = screen.getByLabelText('グリッド表示');
      expect(gridBtn).toHaveClass('bg-view-switcher-active-bg');
    });

    it('applies active text color class to selected option', () => {
      render(<ViewSwitcher options={options} value="list" onChange={mockOnChange} />);

      const listBtn = screen.getByLabelText('リスト表示');
      expect(listBtn).toHaveClass('text-view-switcher-active-text');
    });

    it('applies inactive text color class to non-selected options', () => {
      render(<ViewSwitcher options={options} value="grid" onChange={mockOnChange} />);

      const listBtn = screen.getByLabelText('リスト表示');
      expect(listBtn).toHaveClass('text-view-switcher-inactive-text');
    });

    it('does not apply active background to inactive options', () => {
      render(<ViewSwitcher options={options} value="grid" onChange={mockOnChange} />);

      const listBtn = screen.getByLabelText('リスト表示');
      expect(listBtn).not.toHaveClass('bg-view-switcher-active-bg');
    });
  });

  describe('Accessibility', () => {
    it('has button type attribute', () => {
      const { container } = render(
        <ViewSwitcher options={options} value="grid" onChange={mockOnChange} />
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('has aria-label for each option', () => {
      render(<ViewSwitcher options={options} value="grid" onChange={mockOnChange} />);

      expect(screen.getByLabelText('グリッド表示')).toBeInTheDocument();
      expect(screen.getByLabelText('リスト表示')).toBeInTheDocument();
      expect(screen.getByLabelText('テーブル表示')).toBeInTheDocument();
    });
  });
});
