import type { Meta, StoryObj } from '@storybook/react-vite';
import { LinkButton } from './LinkButton';

const meta: Meta<typeof LinkButton> = {
  title: 'Components/LinkButton',
  component: LinkButton,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', backgroundColor: 'var(--background)' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LinkButton>;

export const Default: Story = {
  args: {
    variant: 'link',
    text: 'Open Link',
    href: 'https://example.com',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Link Variant (Default)</h3>
        <LinkButton variant="link" text="Open Link" href="https://example.com" />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Copy Variant</h3>
        <LinkButton variant="copy" text="Copy this text" />
      </div>
    </div>
  ),
};

export const CopyExamples: Story = {
  render: () => (
    <div className="space-y-4">
      <LinkButton variant="copy" text="Copy this text" />
      <LinkButton variant="copy" text="ID: 12345" copyValue="12345" />
      <LinkButton variant="copy" text="sample@example.com" />
    </div>
  ),
};

export const LinkExamples: Story = {
  render: () => (
    <div className="space-y-4">
      <LinkButton text="Open Example" href="https://example.com" />
      <LinkButton text="Open Documentation" href="https://docs.example.com" />
      <LinkButton text="View Source" href="https://github.com/example/repo" />
    </div>
  ),
};

export const WithCallbacks: Story = {
  render: () => (
    <LinkButton
      variant="copy"
      text="Copy with callback"
      copyValue="Copied!"
      onCopied={(value) => alert(`Copied: ${value}`)}
      onCopyError={(error) => alert(`Error: ${error}`)}
    />
  ),
};

export const IconVariations: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Default (Text + Icon)</h3>
        <div className="space-y-2">
          <LinkButton text="Open Link" href="https://example.com" />
          <LinkButton variant="copy" text="Copy this text" />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Icon Only</h3>
        <div className="flex gap-4">
          <LinkButton iconOnly text="Open Link" href="https://example.com" />
          <LinkButton iconOnly variant="copy" text="Copy this text" />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Text Only (No Icon)</h3>
        <div className="space-y-2">
          <LinkButton hideIcon text="Open Link" href="https://example.com" />
          <LinkButton hideIcon variant="copy" text="Copy this text" />
        </div>
      </div>
    </div>
  ),
};

export const CustomIcons: Story = {
  render: () => {
    const linkExamples = [
      { text: 'Settings', href: '/settings', icon: 'settings' as const },
      { text: 'Home', href: '/', icon: 'house' as const },
      { text: 'Upload', href: '/upload', icon: 'upload' as const },
      { text: 'Notifications', href: '/notifications', icon: 'bell' as const },
    ];

    const copyExamples = [
      { text: 'Copy with clipboard icon', icon: 'clipboard' as const },
      { text: 'Copy with check icon', icon: 'check' as const },
    ];

    return (
      <div className="space-y-4">
        <h3 className="mb-2 text-sm font-semibold">Custom Icons</h3>
        <div className="flex flex-wrap gap-4 items-center">
          {linkExamples.map((props) => (
            <LinkButton key={props.text} {...props} />
          ))}
          {copyExamples.map((props) => (
            <LinkButton key={props.text} variant="copy" {...props} />
          ))}
        </div>
      </div>
    );
  },
};
