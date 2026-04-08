import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScoreIcon } from './ScoreIcon';

const meta: Meta<typeof ScoreIcon> = {
  title: 'Components/ScoreIcon',
  component: ScoreIcon,
  tags: ['autodocs'],
  argTypes: {
    score: {
      control: 'select',
      options: ['A', 'B', 'C', 'D', 'E'],
      description: 'スコアタイプ (A-E)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScoreIcon>;

export const Default: Story = {
  args: {
    score: 'A',
  },
};

export const AllScores: Story = {
  render: () => {
    const scores = ['A', 'B', 'C', 'D', 'E'] as const;

    return (
      <div className="flex flex-wrap gap-8 p-4">
        <div className="flex flex-col items-center gap-4">
          <h3 className="text-lg font-bold text-foreground">全スコア</h3>
          <div className="flex flex-wrap gap-6 justify-center">
            {scores.map((score) => (
              <ScoreIcon key={score} score={score} />
            ))}
          </div>
        </div>
      </div>
    );
  },
};
