import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';

const meta = {
  title: 'Components/Data Display/Avatar',
  component: Avatar,
  tags: ['autodocs'],
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarImage
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23e0f2fe'/%3E%3Ctext x='32' y='39' font-size='20' text-anchor='middle' fill='%230c4a6e' font-family='sans-serif'%3EUI%3C/text%3E%3C/svg%3E"
          alt="User avatar"
        />
        <AvatarFallback>YN</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>DS</AvatarFallback>
      </Avatar>
    </div>
  ),
};
