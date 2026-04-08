import type { Meta, StoryObj } from '@storybook/react-vite';
import { cn } from '@/utils/cn';

import { Rating } from './Rating';

const meta: Meta<typeof Rating> = {
  title: 'Components/Rating',
  component: Rating,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', backgroundColor: 'hsl(var(--background))' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    num: {
      control: { type: 'number', min: 0, max: 5, step: 0.1 },
      description: '評価値 (0.0-5.0)',
    },
    color: {
      control: 'color',
      description: '星の色',
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
      description: 'サイズ',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Rating>;

export const Default: Story = {
  args: {
    num: 2.2,
    color: '#facc15',
    size: 'sm',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className={cn('flex flex-col gap-4')}>
      <div className={cn('flex items-center gap-2')}>
        <span className={cn('w-12 text-sm')}>sm:</span>
        <Rating num={4.5} size="sm" />
      </div>
      <div className={cn('flex items-center gap-2')}>
        <span className={cn('w-12 text-sm')}>md:</span>
        <Rating num={4.5} size="md" />
      </div>
    </div>
  ),
};

const ALL_RATING_COLORS = [
  '#facc15',
  '#ef4444',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#f59e0b',
  '#6366f1',
];
const RANDOM_RATINGS = Array.from({ length: 11 }, () => Math.random() * 5);

export const AllRatings: Story = {
  args: {
    color: '#ef4444',
    size: 'sm',
    num: 2.2,
  },

  render: () => {
    return (
      <div className={cn('flex flex-col gap-2')}>
        {RANDOM_RATINGS.map((rating, index) => (
          <div key={index} className={cn('flex items-center gap-2')}>
            <span className={cn('w-12 text-sm')}>{rating.toFixed(1)}:</span>
            <Rating num={rating} color={ALL_RATING_COLORS[index]} />
          </div>
        ))}
      </div>
    );
  },
};
