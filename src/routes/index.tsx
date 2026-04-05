import { Button } from '@repo/design-system';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div className="p-8">
      <h1>Welcome to Hono Standard</h1>
      <p className="mb-4">A simple Monolithic API + Frontend template.</p>
      <Button>Design System Button</Button>
    </div>
  );
}
