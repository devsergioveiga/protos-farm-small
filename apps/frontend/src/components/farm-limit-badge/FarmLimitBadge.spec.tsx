import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FarmLimitBadge from './FarmLimitBadge';

const mockUseFarmLimit = vi.fn();
vi.mock('@/hooks/useFarmLimit', () => ({
  useFarmLimit: () => mockUseFarmLimit(),
}));

describe('FarmLimitBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when limit is null', () => {
    mockUseFarmLimit.mockReturnValue({ limit: null, isLoading: true, error: null });

    const { container } = render(<FarmLimitBadge />);

    expect(container.firstChild).toBeNull();
  });

  it('should render current/max text', () => {
    mockUseFarmLimit.mockReturnValue({
      limit: { current: 3, max: 10, percentage: 30, warning: false, blocked: false },
      isLoading: false,
      error: null,
    });

    render(<FarmLimitBadge />);

    expect(screen.getByRole('status').textContent).toContain('3/10');
  });

  it('should apply ok class when under 80%', () => {
    mockUseFarmLimit.mockReturnValue({
      limit: { current: 3, max: 10, percentage: 30, warning: false, blocked: false },
      isLoading: false,
      error: null,
    });

    render(<FarmLimitBadge />);

    const badge = screen.getByRole('status');
    expect(badge.className).toContain('farm-limit-badge--ok');
  });

  it('should apply warning class at 80%+', () => {
    mockUseFarmLimit.mockReturnValue({
      limit: { current: 8, max: 10, percentage: 80, warning: true, blocked: false },
      isLoading: false,
      error: null,
    });

    render(<FarmLimitBadge />);

    const badge = screen.getByRole('status');
    expect(badge.className).toContain('farm-limit-badge--warning');
  });

  it('should apply blocked class at 100%', () => {
    mockUseFarmLimit.mockReturnValue({
      limit: { current: 10, max: 10, percentage: 100, warning: true, blocked: true },
      isLoading: false,
      error: null,
    });

    render(<FarmLimitBadge />);

    const badge = screen.getByRole('status');
    expect(badge.className).toContain('farm-limit-badge--blocked');
  });

  it('should show alert icon when blocked', () => {
    mockUseFarmLimit.mockReturnValue({
      limit: { current: 10, max: 10, percentage: 100, warning: true, blocked: true },
      isLoading: false,
      error: null,
    });

    render(<FarmLimitBadge />);

    const badge = screen.getByRole('status');
    expect(badge.querySelector('svg')).toBeTruthy();
  });

  it('should have accessible aria-label', () => {
    mockUseFarmLimit.mockReturnValue({
      limit: { current: 8, max: 10, percentage: 80, warning: true, blocked: false },
      isLoading: false,
      error: null,
    });

    render(<FarmLimitBadge />);

    const badge = screen.getByRole('status');
    expect(badge.getAttribute('aria-label')).toContain('8 de 10 fazendas');
    expect(badge.getAttribute('aria-label')).toContain('próximo do limite');
  });
});
