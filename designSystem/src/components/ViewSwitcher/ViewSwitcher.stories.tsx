import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ViewSwitcher } from './ViewSwitcher';

const meta: Meta<typeof ViewSwitcher> = {
  title: 'Components/ViewSwitcher',
  component: ViewSwitcher,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', backgroundColor: 'hsl(var(--background))' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ViewSwitcher>;

const threeViewOptions = [
  { value: '業界', label: '業界', tooltip: '業界' },
  { value: '全国', label: '全国', tooltip: '全国' },
  { value: 'ベンチマーク', label: 'ベンチマーク', tooltip: 'ベンチマーク' },
];

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState(threeViewOptions[0]?.value ?? '業界');
    return <ViewSwitcher value={value} onChange={setValue} options={threeViewOptions} />;
  },
};

// All variants display
export const ThreeOptions: Story = {
  render: () => {
    const [value, setValue] = useState(threeViewOptions[1]?.value ?? '全国');
    return <ViewSwitcher value={value} onChange={setValue} options={threeViewOptions} />;
  },
};

// Two options example
export const TwoOptions: Story = {
  render: () => {
    const options = [
      { value: 'card', label: 'カード', tooltip: 'カード表示' },
      { value: 'compact', label: 'コンパクト', tooltip: 'コンパクト表示' },
    ];
    const [value, setValue] = useState(options[0]?.value ?? 'card');
    return <ViewSwitcher value={value} onChange={setValue} options={options} />;
  },
};

// Four options example
export const FourOptions: Story = {
  render: () => {
    const options = [
      { value: 'day', label: '日', tooltip: '日表示' },
      { value: 'week', label: '週', tooltip: '週表示' },
      { value: 'month', label: '月', tooltip: '月表示' },
      { value: 'year', label: '年', tooltip: '年表示' },
    ];
    const [value, setValue] = useState(options[0]?.value ?? 'day');
    return <ViewSwitcher value={value} onChange={setValue} options={options} />;
  },
};

// Interactive example
export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState(threeViewOptions[0]?.value ?? '業界');
    return (
      <div className="flex flex-col gap-4">
        <ViewSwitcher value={value} onChange={setValue} options={threeViewOptions} />
        <div className="text-sm text-muted-foreground">
          Current selection: <strong>{value}</strong>
        </div>
      </div>
    );
  },
};
