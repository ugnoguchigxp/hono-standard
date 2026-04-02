import { Link } from '@tanstack/react-router';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import type {
  Comment,
  CreateCommentInput,
  CreateThreadInput,
  Thread,
} from '../repositories/bbs.repository';

// --- Thread List ---
const columnHelper = createColumnHelper<Thread>();

const columns = [
  columnHelper.accessor('title', {
    header: 'Title',
    cell: (info) => (
      <Link to="/bbs/$id" params={{ id: info.row.original.id }}>
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created At',
    cell: (info) => new Date(info.getValue()).toLocaleString(),
  }),
];

export const ThreadList = ({ threads }: { threads: Thread[] | undefined }) => {
  const table = useReactTable({
    data: threads || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                style={{ borderBottom: '2px solid #555', padding: '12px', textAlign: 'left' }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} style={{ borderBottom: '1px solid #444', padding: '12px' }}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// --- Create Thread Form ---
export const CreateThreadForm = ({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: CreateThreadInput) => void;
  isPending: boolean;
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && content.trim()) {
      onSubmit({ title, content });
      setTitle('');
      setContent('');
    }
  };

  return (
    <section
      style={{
        marginBottom: '3rem',
        padding: '1.5rem',
        background: '#333',
        borderRadius: '12px',
      }}
    >
      <h3>Create New Thread</h3>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thread Title"
          required
          style={{
            padding: '0.8rem',
            background: '#222',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px',
          }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          required
          style={{
            padding: '0.8rem',
            minHeight: 100,
            background: '#222',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px',
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          style={{ padding: '0.8rem 2rem', fontWeight: 'bold' }}
        >
          {isPending ? 'Creating...' : 'Create Thread'}
        </button>
      </form>
    </section>
  );
};

// --- Comment Form ---
export const CommentForm = ({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: CreateCommentInput) => void;
  isPending: boolean;
}) => {
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSubmit({ content });
      setContent('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        required
        style={{
          padding: '0.5rem',
          minHeight: 80,
          background: '#222',
          color: '#fff',
          border: '1px solid #555',
        }}
      />
      <button type="submit" disabled={isPending} style={{ alignSelf: 'flex-end' }}>
        {isPending ? 'Posting...' : 'Post Comment'}
      </button>
    </form>
  );
};

// --- Thread Detail View ---
export const ThreadDetailView = ({ thread }: { thread: Thread }) => {
  return (
    <article
      style={{ borderBottom: '2px solid #555', marginBottom: '2rem', paddingBottom: '1rem' }}
    >
      <h1>{thread.title}</h1>
      <p style={{ whiteSpace: 'pre-wrap' }}>{thread.content}</p>
      <small>
        Posted by: {thread.authorId} at {new Date(thread.createdAt).toLocaleString()}
      </small>
    </article>
  );
};

// --- Comment List ---
export const CommentList = ({ comments }: { comments: Comment[] | undefined }) => {
  return (
    <section>
      <h3>Comments ({comments?.length || 0})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {comments?.map((comment) => (
          <div
            key={comment.id}
            style={{ padding: '1rem', background: '#333', borderRadius: '8px' }}
          >
            <p style={{ margin: '0 0 0.5rem 0' }}>{comment.content}</p>
            <small>
              By: {comment.authorId} at {new Date(comment.createdAt).toLocaleString()}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
};
