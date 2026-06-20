import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Avatar, initials } from './Avatar.js';

describe('initials', () => {
  it('takes the first and last initial', () => {
    expect(initials('Amara Okafor')).toBe('AO');
  });

  it('handles a single name', () => {
    expect(initials('Lena')).toBe('L');
  });

  it('ignores extra whitespace and middle names', () => {
    expect(initials('  john  ronald  tolkien ')).toBe('JT');
  });

  it('falls back to ? for an empty name', () => {
    expect(initials('   ')).toBe('?');
  });
});

describe('Avatar', () => {
  it('renders initials and an accessible label when there is no image', () => {
    render(<Avatar name="Amara Okafor" />);
    const img = screen.getByRole('img', { name: 'Amara Okafor' });
    expect(img.textContent).toBe('AO');
  });

  it('renders the image when src is provided', () => {
    const { container } = render(<Avatar name="Amara Okafor" src="/a.jpg" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/a.jpg');
  });
});
