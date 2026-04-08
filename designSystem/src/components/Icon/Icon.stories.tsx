import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, type IconProps, iconMap } from './Icon';

const meta: Meta<typeof Icon> = {
  title: 'Components/Icon',
  component: Icon,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: Object.keys(iconMap),
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {
  args: {
    type: 'menu',
    size: 'md',
  },
};

export const AllIcons: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => {
    const iconTypes = Object.keys(iconMap) as IconProps['type'][];

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '16px',
        }}
      >
        {iconTypes.map((type) => (
          <div
            key={type}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '16px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            <Icon type={type} size="lg" />
            <span style={{ fontSize: '12px', textAlign: 'center' }}>{type}</span>
          </div>
        ))}
      </div>
    );
  },
};
