import type { Meta, StoryObj } from '@storybook/react-vite';
import { DesignSystemPreview } from '../../pencil';

const meta = {
  title: 'Catalog/.pen Preview',
  component: DesignSystemPreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DesignSystemPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullCatalog: Story = {};
