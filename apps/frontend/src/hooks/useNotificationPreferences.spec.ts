import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

vi.mock('../stores/AuthContext', () => ({
  useAuth: () => ({ user: { organizationId: 'org-123' } }),
}));

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue([]);
    mockPut.mockResolvedValue({});
  });

  it('fetchPreferences calls api.get with orgId in path', async () => {
    const { useNotificationPreferences } = await import('./useNotificationPreferences');

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/org/org-123/notification-preferences');
  });

  it('togglePreference calls api.put with orgId in path and correct body', async () => {
    const { useNotificationPreferences } = await import('./useNotificationPreferences');

    mockGet.mockResolvedValue([{ eventType: 'RC_APPROVED', badge: false, email: true }]);

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockPut.mockClear();

    await result.current.togglePreference('RC_APPROVED', 'badge', true);

    expect(mockPut).toHaveBeenCalledWith('/org/org-123/notification-preferences', {
      eventType: 'RC_APPROVED',
      channel: 'badge',
      enabled: true,
    });
  });
});
