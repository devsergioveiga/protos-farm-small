import { describe, it, expect } from 'vitest';

describe('useNotifications — NOTIFICATION_LABELS', () => {
  it('DAILY_DIGEST exists as key in NOTIFICATION_LABELS', async () => {
    const { NOTIFICATION_LABELS } = await import('./useNotifications');
    expect(NOTIFICATION_LABELS).toHaveProperty('DAILY_DIGEST');
  });

  it("NOTIFICATION_LABELS.DAILY_DIGEST equals 'Resumo diario'", async () => {
    const { NOTIFICATION_LABELS } = await import('./useNotifications');
    expect((NOTIFICATION_LABELS as Record<string, string>).DAILY_DIGEST).toBe('Resumo diario');
  });
});
