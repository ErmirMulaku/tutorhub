import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Price } from './Price.js';
import { StarRating } from './StarRating.js';

describe('Price', () => {
  it('formats whole-dollar amounts without decimals', () => {
    render(<Price cents={4500} currency="USD" locale="en" />);
    expect(screen.getByText(/\$45\b/)).not.toBeNull();
  });

  it('keeps cents when the amount is not a round dollar', () => {
    render(<Price cents={4550} currency="USD" locale="en" />);
    expect(screen.getByText(/\$45\.50/)).not.toBeNull();
  });

  it('renders the muted unit suffix', () => {
    const { container } = render(<Price cents={3000} unit="/hr" locale="en" />);
    expect(container.querySelector('.th-price__unit')?.textContent).toBe('/hr');
  });
});

describe('StarRating', () => {
  it('exposes the rounded rating via an accessible label', () => {
    render(<StarRating value={4.27} />);
    expect(screen.getByRole('img', { name: 'Rated 4.3 out of 5' })).not.toBeNull();
  });

  it('clamps out-of-range values and clips the fill to a percentage width', () => {
    const { container } = render(<StarRating value={7} />);
    const fill = container.querySelector('.th-rating__fill') as HTMLElement;
    expect(fill.style.inlineSize).toBe('100%');
  });

  it('shows the numeric value and review count when asked', () => {
    render(<StarRating value={3.8} showValue count={12} />);
    expect(screen.getByText('3.8 (12)')).not.toBeNull();
  });
});
