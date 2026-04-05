import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from '../../../components/ui/separator';

const meta = {
  title: 'Components/Navigation & Layout/Separator',
  component: Separator,
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[360px] space-y-4">
      <p className="text-sm">Top section</p>
      <Separator />
      <div className="flex h-8 items-center gap-3">
        <span className="text-sm">Left</span>
        <Separator orientation="vertical" />
        <span className="text-sm">Right</span>
      </div>
    </div>
  ),
};
