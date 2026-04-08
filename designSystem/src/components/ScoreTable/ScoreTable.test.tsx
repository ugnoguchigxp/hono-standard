import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScoreTable, ScoreTableRow } from './ScoreTable';

describe('ScoreTable', () => {
  it('renders correctly', () => {
    render(
      <ScoreTable>
        <ScoreTableRow label="Test" value="Value" />
      </ScoreTable>
    );
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <ScoreTable ref={ref}>
        <ScoreTableRow label="Test" value="Value" />
      </ScoreTable>
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('ScoreTableRow', () => {
  it('renders label and value', () => {
    render(<ScoreTableRow label="判定" value="C" />);
    expect(screen.getByText('判定')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('renders sub-label with automatic parentheses', () => {
    const { container } = render(<ScoreTableRow label="判定" subLabel="5段階" value="C" />);
    const subLabelSpan = container.querySelector('.text-table-neutral') as HTMLElement;
    expect(subLabelSpan).toBeInTheDocument();
    expect(subLabelSpan.textContent).toContain('5段階');
  });

  it('renders value with unit', () => {
    render(<ScoreTableRow label="スコア" value={62} valueUnit="点" />);
    expect(screen.getByText('62点')).toBeInTheDocument();
  });

  it('renders value label without change', () => {
    const { container } = render(
      <ScoreTableRow label="判定" value="C" valueLabel="成長フェーズ" />
    );
    const valueLabelSpan = container.querySelector(
      '.text-table-text:not(.font-medium)'
    ) as HTMLElement;
    expect(valueLabelSpan).toBeInTheDocument();
    expect(valueLabelSpan.textContent).toContain('成長フェーズ');
  });

  it('shows help icon when showHelp is true', () => {
    render(<ScoreTableRow label="Test" value="Value" showHelp onHelpClick={() => {}} />);
    expect(screen.getByLabelText('Help')).toBeInTheDocument();
  });

  it('calls onHelpClick when help icon is clicked', () => {
    const handleHelpClick = vi.fn();
    render(<ScoreTableRow label="Test" value="Value" showHelp onHelpClick={handleHelpClick} />);

    const helpButton = screen.getByLabelText('Help');
    fireEvent.click(helpButton);
    expect(handleHelpClick).toHaveBeenCalledTimes(1);
  });

  it('applies separator variant', () => {
    const { container } = render(<ScoreTableRow label="Test" value="Value" variant="separator" />);
    const row = container.firstChild;
    expect(row).toHaveClass('border-t');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ScoreTableRow ref={ref} label="Test" value="Value" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  describe('valueChange', () => {
    it.each([
      ['positive', 8, '位', undefined, '8位', 'text-table-success'],
      ['negative', -15, '点', '%', '15%', 'text-table-error'],
      ['zero', 0, '位', undefined, '±0位', 'text-table-neutral-zero'],
    ])('renders %s change with correct color and icon', (_description, valueChange, valueUnit, valueChangeUnit, expectedText, expectedClass) => {
      const { container } = render(
        <ScoreTableRow
          label="Test"
          value={100}
          valueUnit={valueUnit}
          valueChange={valueChange}
          valueChangeUnit={valueChangeUnit}
        />
      );
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      const changeElement = screen.getByText(expectedText);
      expect(changeElement).toHaveClass(expectedClass);
      // Check icon is rendered
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('uses valueUnit when valueChangeUnit is not specified', () => {
      const { container } = render(
        <ScoreTableRow label="全国" value={1034} valueUnit="位" valueChange={-5} />
      );
      expect(screen.getByText('5位')).toBeInTheDocument();
      // Check icon is rendered
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});

describe('ScoreTable Integration', () => {
  it('renders complete score table with all features', () => {
    const { container } = render(
      <ScoreTable>
        <ScoreTableRow label="判定" subLabel="5段階" value="C" valueLabel="成長フェーズ" showHelp />
        <ScoreTableRow
          label="スコア"
          subLabel="総100点"
          value={62}
          valueUnit="点"
          valueChange={-15}
          valueChangeUnit="%"
        />
      </ScoreTable>
    );

    expect(screen.getByText('判定')).toBeInTheDocument();
    // Check sub-label with parentheses
    const subLabelSpan = container.querySelector('.text-table-neutral') as HTMLElement;
    expect(subLabelSpan.textContent).toContain('5段階');
    expect(screen.getByText('C')).toBeInTheDocument();
    // Check value label with parentheses
    const valueLabelSpan = container.querySelector(
      '.text-table-text:not(.font-medium)'
    ) as HTMLElement;
    expect(valueLabelSpan.textContent).toContain('成長フェーズ');
    expect(screen.getByText('スコア')).toBeInTheDocument();
    expect(screen.getByText('62点')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();
    // Check icon is rendered
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders multiple rows with separator', () => {
    render(
      <ScoreTable>
        <ScoreTableRow label="判定" subLabel="5段階" value="C" valueLabel="成長フェーズ" />
        <ScoreTableRow
          variant="separator"
          label="スコア"
          value={62}
          valueUnit="点"
          valueChange={-15}
          valueChangeUnit="%"
        />
      </ScoreTable>
    );

    expect(screen.getByText('判定')).toBeInTheDocument();
    expect(screen.getByText('スコア')).toBeInTheDocument();
  });
});
