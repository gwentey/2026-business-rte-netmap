import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton.js';

describe('Skeleton', () => {
  it('renders with default variant (text) and aria-label', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Chargement');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('accepts custom width and height as numbers (pixels)', () => {
    render(<Skeleton width={200} height={50} data-testid="sk" />);
    const node = screen.getByTestId('sk');
    expect(node.style.width).toBe('200px');
    expect(node.style.height).toBe('50px');
  });

  it('accepts custom width as string (CSS value)', () => {
    render(<Skeleton width="50%" data-testid="sk" />);
    expect(screen.getByTestId('sk').style.width).toBe('50%');
  });

  it('renders multiple lines with last line at 60% width', () => {
    render(<Skeleton variant="text" lines={3} />);
    const group = screen.getByRole('status');
    expect(group.children).toHaveLength(3);
    expect((group.children[2] as HTMLElement).style.width).toBe('60%');
  });

  it('supports circle variant', () => {
    const { container } = render(<Skeleton variant="circle" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('circle');
  });

  it('supports card variant', () => {
    const { container } = render(<Skeleton variant="card" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('card');
  });
});
