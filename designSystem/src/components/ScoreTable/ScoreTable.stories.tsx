import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScoreTable, ScoreTableRow } from './ScoreTable';

const meta: Meta<typeof ScoreTable> = {
  title: 'Components/ScoreTable',
  component: ScoreTable,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', backgroundColor: 'var(--background)' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ScoreTable>;

export const Default: Story = {
  render: () => (
    <ScoreTable>
      <ScoreTableRow label="判定" subLabel="5段階" value="C" valueLabel="成長フェーズ" showHelp />
    </ScoreTable>
  ),
};

export const Complete: Story = {
  render: () => {
    const rows = [
      {
        id: 'judgement',
        label: '判定',
        subLabel: '5段階',
        value: 'C',
        valueLabel: '成長フェーズ',
        showHelp: true,
      },
      {
        id: 'score',
        label: 'スコア',
        subLabel: '総100点',
        value: 62,
        valueUnit: '点',
        valueChange: -15,
        valueChangeUnit: '%',
      },
      {
        id: 'industry',
        label: '業界',
        subLabel: '総500位',
        value: 84,
        valueUnit: '位',
        valueChange: 8,
      },
      {
        id: 'national',
        label: '全国',
        subLabel: '総4000位',
        value: 1034,
        valueUnit: '位',
        valueChange: -5,
      },
      {
        id: 'benchmark',
        label: 'ベンチマーク',
        subLabel: '総130位',
        value: 5,
        valueUnit: '位',
        valueChange: 0,
      },
    ];

    return (
      <div className="space-y-8 max-w-2xl">
        <div>
          <h3 className="text-lg font-semibold mb-3">Score Table/Item</h3>
          <ScoreTable>
            <ScoreTableRow
              label="判定"
              subLabel="5段階"
              value="C"
              valueLabel="成長フェーズ"
              showHelp
            />
          </ScoreTable>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Score Table</h3>
          <ScoreTable>
            {rows.map((row) => {
              const { id, ...rowProps } = row;
              return <ScoreTableRow key={id} {...rowProps} />;
            })}
          </ScoreTable>
        </div>
      </div>
    );
  },
};

export const WithSeparator: Story = {
  render: () => {
    const rows = [
      {
        id: 'judgement-1',
        label: '判定',
        subLabel: '5段階',
        value: 'C',
        valueLabel: '成長フェーズ',
        showHelp: true,
      },
      {
        id: 'judgement-2',
        variant: 'separator' as const,
        label: '判定',
        subLabel: '5段階',
        value: 'C',
        valueLabel: '成長フェーズ',
      },
      {
        id: 'score',
        label: 'スコア',
        subLabel: '総100点',
        value: 62,
        valueUnit: '点',
        valueChange: -15,
        valueChangeUnit: '%',
      },
    ];

    return (
      <ScoreTable>
        {rows.map((row) => {
          const { id, ...rowProps } = row;
          return <ScoreTableRow key={id} {...rowProps} />;
        })}
      </ScoreTable>
    );
  },
};

export const SimpleRows: Story = {
  render: () => {
    const tables = [
      {
        id: 'table-1',
        rows: [
          {
            id: 'row-1-1',
            label: '判定',
            subLabel: '5段階',
            value: 'A',
            valueLabel: '成熟フェーズ',
            showHelp: true,
          },
        ],
      },
      {
        id: 'table-2',
        rows: [
          {
            id: 'row-2-1',
            label: '判定',
            value: 'C',
            valueLabel: '成長フェーズ',
          },
          { id: 'row-2-2', label: 'スコア', value: 62, valueUnit: '点' },
        ],
      },
      {
        id: 'table-3',
        rows: [
          { id: 'row-3-1', label: 'Status', value: 'Active' },
          { id: 'row-3-2', label: 'Count', value: 150 },
        ],
      },
    ];

    return (
      <div className="space-y-6 max-w-2xl">
        {tables.map((table) => (
          <ScoreTable key={table.id}>
            {table.rows.map((row) => {
              const { id, ...rowProps } = row;
              return <ScoreTableRow key={id} {...rowProps} />;
            })}
          </ScoreTable>
        ))}
      </div>
    );
  },
};

export const WithApiData: Story = {
  render: () => {
    // Simulated API response
    const apiData = {
      judgement: {
        score: 'C',
        label: '5段階',
        phase: '成長フェーズ',
      },
      metrics: [
        {
          name: 'スコア',
          category: '総100点',
          currentValue: 62,
          unit: '点',
          changeValue: -15,
          changeUnit: '%',
        },
        {
          name: '業界',
          category: '総500位',
          currentValue: 84,
          unit: '位',
          changeValue: 8,
        },
        {
          name: '全国',
          category: '総4000位',
          currentValue: 1034,
          unit: '位',
          changeValue: -5,
        },
      ],
    };

    // Transform API data to component props
    const rows = [
      {
        id: 'judgement',
        label: '判定',
        subLabel: apiData.judgement.label,
        value: apiData.judgement.score,
        valueLabel: apiData.judgement.phase,
        showHelp: true,
      },
      ...apiData.metrics.map((metric) => ({
        id: `metric-${metric.name}`,
        label: metric.name,
        subLabel: metric.category,
        value: metric.currentValue,
        valueUnit: metric.unit,
        valueChange: metric.changeValue,
        valueChangeUnit: metric.changeUnit,
      })),
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">API Data Example</h3>
        <ScoreTable>
          {rows.map((row) => {
            const { id, ...rowProps } = row;
            return <ScoreTableRow key={id} {...rowProps} />;
          })}
        </ScoreTable>
      </div>
    );
  },
};
