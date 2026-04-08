import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { iconMap } from '@/components/Icon';
import { Modal } from './Modal';

const meta: Meta<typeof Modal> = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['consulter', 'judgement', 'employee'],
    },
    headerIcon: {
      control: 'select',
      options: Object.keys(iconMap),
    },
    headerTitle: {
      control: 'text',
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          padding: '2rem',
          backgroundColor: 'hsl(var(--background))',
          height: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Consulter: Story = {
  args: {
    variant: 'consulter',
    headerIcon: 'landmark',
    headerTitle: '担当銀行員',
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Consulter Modal</Button>
        <Modal {...args} open={open} onOpenChange={setOpen}></Modal>
      </>
    );
  },
};

export const Judgement: Story = {
  args: {
    variant: 'judgement',
    headerIcon: 'brain',
    headerTitle: '判定説明',
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Judgement Modal</Button>
        <Modal {...args} open={open} onOpenChange={setOpen}></Modal>
      </>
    );
  },
};

export const Employee: Story = {
  args: {
    variant: 'employee',
    headerIcon: 'tabletSmartphone',
    headerTitle: '従業員の声詳細',
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Employee Modal</Button>
        <Modal {...args} open={open} onOpenChange={setOpen}></Modal>
      </>
    );
  },
};
