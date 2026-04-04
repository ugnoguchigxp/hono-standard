import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from './icon-button';
import { Search } from 'lucide-react';

describe('IconButton', () => {
  it('renders correctly', () => {
    render(
      <IconButton aria-label="Search">
        <Search />
      </IconButton>
    );
    const button = screen.getByRole('button', { name: /search/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('h-9 w-9'); // from size="icon"
  });
});
