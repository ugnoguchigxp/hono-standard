import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div>
      <h1>Welcome to Hono Standard</h1>
      <p>A simple Monolithic API + Frontend template.</p>
    </div>
  );
}
