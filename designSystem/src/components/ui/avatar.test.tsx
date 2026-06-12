import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

describe('Avatar', () => {
  it('renders image when provided', async () => {
    const { container } = render(
      <Avatar>
        <AvatarImage
          data-testid="avatar-img"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
          alt="Template avatar"
        />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders fallback when image is not provided', () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );

    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});
