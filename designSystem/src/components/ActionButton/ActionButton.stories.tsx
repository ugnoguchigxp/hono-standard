import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActionButton } from './ActionButton';

const meta: Meta<typeof ActionButton> = {
  title: 'Components/ActionButton',
  component: ActionButton,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{
          padding: '2rem',
          backgroundColor: 'hsl(var(--background))',
          minHeight: '300px',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ActionButton>;

export const Default: Story = {
  args: {
    icon: 'brain',
    label: 'AIエージェント',
  },
};

export const Active: Story = {
  args: {
    icon: 'brain',
    label: 'AIエージェント',
    active: true,
  },
};
