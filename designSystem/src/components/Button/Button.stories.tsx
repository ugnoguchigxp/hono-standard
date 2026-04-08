import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    icon: 'check',
    children: 'Button',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    icon: 'upload',
    children: 'Secondary',
    variant: 'secondary',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-8 p-4">
      <section>
        <h3 className="mb-4 text-lg font-bold">Variants</h3>
        <div className="flex flex-wrap gap-4">
          <Button icon="upload" variant="primary">
            Primary
          </Button>
          <Button icon="upload" variant="secondary">
            Secondary
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-bold">Sizes (with text)</h3>
        <div className="flex flex-wrap items-center gap-4">
          <Button icon="upload" size="sm">
            Button
          </Button>
          <Button icon="upload" size="md">
            Button
          </Button>
          <Button icon="upload" size="lg">
            Button
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-bold">Icon Only (Circle Buttons)</h3>
        <div className="flex flex-wrap items-center gap-4">
          <Button icon="upload" size="sm" variant="primary" />
          <Button icon="upload" size="md" variant="primary" />
          <Button icon="upload" size="lg" variant="primary" />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-bold">Icon Only - Secondary</h3>
        <div className="flex flex-wrap items-center gap-4">
          <Button icon="upload" size="sm" variant="secondary" />
          <Button icon="upload" size="md" variant="secondary" />
          <Button icon="upload" size="lg" variant="secondary" />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-bold">States</h3>
        <div className="flex flex-wrap gap-4">
          <Button icon="upload">Normal</Button>
          <Button icon="upload" disabled>
            Disabled
          </Button>
          <Button icon="upload" size="md" disabled />
        </div>
      </section>
    </div>
  ),
};
