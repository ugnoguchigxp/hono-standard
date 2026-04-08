import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarChart, type BarChartDataItem } from './BarChart';

const meta: Meta<typeof BarChart> = {
  title: 'Components/BarChart',
  component: BarChart,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BarChart>;

// Sample data
const scoreData: BarChartDataItem[] = [
  { label: 'E', value: 10 },
  { label: 'D', value: 20 },
  { label: 'C', value: 50 },
  { label: 'B', value: 10 },
  { label: 'A', value: 10 },
];

// Default
export const Default: Story = {
  args: {
    data: scoreData,
    activeIndex: 2,
  },
};

// Simple Data
export const SimpleData: Story = {
  args: {
    data: [
      { label: 'A', value: 100 },
      { label: 'B', value: 150 },
      { label: 'C', value: 80 },
    ],
    activeIndex: 1,
  },
};
