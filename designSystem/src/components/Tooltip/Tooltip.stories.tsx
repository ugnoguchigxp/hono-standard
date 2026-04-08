import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/Button';

import { Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    content: {
      control: 'text',
    },
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
    },
    sideOffset: {
      control: { type: 'number', min: 0, max: 50 },
    },
    showArrow: {
      control: 'boolean',
    },
    delayDuration: {
      control: { type: 'number', min: 0, max: 1000 },
    },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div style={{ padding: '3rem', backgroundColor: 'hsl(var(--background))' }}>
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  args: {
    content: 'Tooltip content',
    side: 'bottom',
    align: 'center',
    sideOffset: 0,
    showArrow: true,
    delayDuration: 0,
  },
  render: (args) => (
    <Tooltip
      content={args.content}
      side={args.side}
      align={args.align}
      sideOffset={args.sideOffset}
      showArrow={args.showArrow}
      delayDuration={args.delayDuration}
    >
      <Button variant="outline">Hover me</Button>
    </Tooltip>
  ),
};

export const WithHtmlContent: Story = {
  args: {
    side: 'bottom',
    align: 'center',
    sideOffset: 5,
    showArrow: true,
    delayDuration: 0,
  },
  render: (args) => (
    <TooltipProvider delayDuration={args.delayDuration}>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover me</Button>
        </TooltipTrigger>
        <TooltipContent
          side={args.side}
          align={args.align}
          sideOffset={args.sideOffset}
          showArrow={args.showArrow}
        >
          <div style={{ padding: '4px 0' }}>
            <strong>Rich Tooltip</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
              Supports <code>code</code> and <em>emphasis</em>
            </p>
          </div>
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  ),
};
