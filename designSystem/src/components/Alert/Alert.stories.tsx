import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { cn } from '@/utils/cn';
import { Alert } from './Alert';

const meta: Meta<typeof Alert> = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  args: {
    message: '企業WBスコアが前回から15%低下しています。',
  },
  render: (args) => {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) {
      return (
        <button
          type="button"
          onClick={() => setIsVisible(true)}
          className={cn('px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600')}
        >
          Show Alert
        </button>
      );
    }

    return <Alert {...args} onClose={() => setIsVisible(false)} />;
  },
};
