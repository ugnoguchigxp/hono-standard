import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { RankChart } from './RankChart';

const meta: Meta<typeof RankChart> = {
  title: 'Components/RankChart',
  component: RankChart,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{
          padding: '2rem',
          backgroundColor: 'hsl(var(--background))',
          minHeight: '500px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RankChart>;

const viewOptions = [
  { value: 'industry', label: '業界', tooltip: '業界平均と比較' },
  { value: 'national', label: '全国', tooltip: '全国平均と比較' },
  { value: 'benchmark', label: 'ベンチマーク', tooltip: 'ベンチマークと比較' },
];

export const Default: Story = {
  render: () => {
    const [currentView, setCurrentView] = React.useState('industry');

    const viewData = {
      industry: [
        { label: 'E', value: 35 },
        { label: 'D', value: 55 },
        { label: 'C', value: 80 },
        { label: 'B', value: 60 },
        { label: 'A', value: 45 },
      ],
      national: [
        { label: 'E', value: 30 },
        { label: 'D', value: 50 },
        { label: 'C', value: 75 },
        { label: 'B', value: 65 },
        { label: 'A', value: 50 },
      ],
      benchmark: [
        { label: 'E', value: 25 },
        { label: 'D', value: 45 },
        { label: 'C', value: 70 },
        { label: 'B', value: 70 },
        { label: 'A', value: 55 },
      ],
    };

    return (
      <RankChart
        score="C"
        rankData={viewData[currentView as keyof typeof viewData] || viewData.industry}
        viewOptions={viewOptions}
        currentView={currentView}
        onViewChange={setCurrentView}
      />
    );
  },
};

export const DynamicScoreByView: Story = {
  render: () => {
    const [currentView, setCurrentView] = React.useState('industry');

    // Different score for each view
    const viewConfig = {
      industry: {
        score: 'D' as const,
        data: [
          { label: 'E', value: 35 },
          { label: 'D', value: 80 },
          { label: 'C', value: 60 },
          { label: 'B', value: 50 },
          { label: 'A', value: 45 },
        ],
      },
      national: {
        score: 'A' as const,
        data: [
          { label: 'E', value: 30 },
          { label: 'D', value: 40 },
          { label: 'C', value: 55 },
          { label: 'B', value: 65 },
          { label: 'A', value: 90 },
        ],
      },
      benchmark: {
        score: 'C' as const,
        data: [
          { label: 'E', value: 25 },
          { label: 'D', value: 45 },
          { label: 'C', value: 85 },
          { label: 'B', value: 60 },
          { label: 'A', value: 50 },
        ],
      },
    };

    const currentConfig = viewConfig[currentView as keyof typeof viewConfig];

    return (
      <div className="flex flex-col gap-4 items-center">
        <RankChart
          score={currentConfig.score}
          rankData={currentConfig.data}
          viewOptions={viewOptions}
          currentView={currentView}
          onViewChange={setCurrentView}
        />

        <div className="text-sm text-muted-foreground">
          Industry: D | National: A | Benchmark: C
        </div>
      </div>
    );
  },
};
