import type { Meta, StoryObj } from '@storybook/react-vite';

import { Stepper } from './Stepper';

const meta: Meta<typeof Stepper> = {
  title: 'Components/Stepper',
  component: Stepper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Stepper component with customizable steps and current step',
      },
    },
  },
  argTypes: {
    steps: {
      description: 'Array of step objects with id and label',
      control: {
        type: 'object',
      },
    },
    currentStep: {
      description: 'Current step index (0-based)',
      control: {
        type: 'range',
        min: 0,
        max: 4,
        step: 1,
      },
    },
    size: {
      description: 'Size of the stepper',
      control: {
        type: 'select',
        options: ['xxl', 'xs'],
      },
    },
    className: {
      description: 'Additional CSS classes',
      control: {
        type: 'text',
      },
    },
  },
  decorators: [
    (Story) => (
      <>
        <div style={{ padding: '2rem', backgroundColor: 'hsl(var(--background))' }}>
          <Story />
        </div>
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Stepper>;

export const Default: Story = {
  args: {
    currentStep: 2,
    size: 'xs',
  },
};
