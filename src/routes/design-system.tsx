import { createFileRoute } from '@tanstack/react-router';
import { DesignSystemPreview } from '@repo/design-system/pencil';

export const Route = createFileRoute('/design-system')({
  component: DesignSystemPreview,
});
