import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div className="p-8">
      <h1>Welcome to Hono Standard</h1>
      <p className="mb-4">A simple Monolithic API + Frontend template.</p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/health"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          健康記録ダッシュボード
        </Link>
        <Link
          to="/bbs"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold shadow-sm hover:bg-accent"
        >
          BBS
        </Link>
      </div>
    </div>
  );
}
