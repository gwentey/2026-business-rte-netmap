import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState.js';

describe('EmptyState', () => {
  it('renders a title and description', () => {
    render(<EmptyState title="Rien à afficher" description="Chargez un dump ECP." />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Rien à afficher');
    expect(screen.getByText('Chargez un dump ECP.')).toBeInTheDocument();
  });

  it('renders the icon when provided with aria-hidden', () => {
    const { container } = render(
      <EmptyState title="T" icon={<span data-testid="icon">!</span>} />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    const iconWrapper = container.querySelector('[aria-hidden="true"]');
    expect(iconWrapper).not.toBeNull();
  });

  it('renders the action when provided', () => {
    render(
      <EmptyState
        title="T"
        action={<button type="button">Charger</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Charger' })).toBeInTheDocument();
  });

  it('omits description and action when not provided', () => {
    const { container } = render(<EmptyState title="Seulement un titre" />);
    // Seulement le h2, pas de p ni de .action
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('applies size class sm', () => {
    const { container } = render(<EmptyState title="T" size="sm" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('sizeSm');
  });

  it('applies size class lg', () => {
    const { container } = render(<EmptyState title="T" size="lg" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('sizeLg');
  });
});
