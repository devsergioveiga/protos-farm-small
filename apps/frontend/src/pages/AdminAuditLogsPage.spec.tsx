import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AuditLog } from '@/types/admin';

const MOCK_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    actorId: 'user-1',
    actorEmail: 'admin@protos.farm',
    actorRole: 'SUPER_ADMIN',
    action: 'CREATE_ORGANIZATION',
    targetType: 'organization',
    targetId: 'org-12345678',
    metadata: { name: 'Agro Corp' },
    ipAddress: '192.168.1.1',
    farmId: null,
    organizationId: 'org-1',
    createdAt: '2026-03-01T10:30:00.000Z',
  },
  {
    id: 'log-2',
    actorId: 'user-1',
    actorEmail: 'admin@protos.farm',
    actorRole: 'SUPER_ADMIN',
    action: 'UPDATE_ORGANIZATION_STATUS',
    targetType: 'organization',
    targetId: 'org-22345678',
    metadata: null,
    ipAddress: '10.0.0.1',
    farmId: null,
    organizationId: 'org-2',
    createdAt: '2026-03-01T11:00:00.000Z',
  },
];

const mockUseAdminAuditLogs = vi.fn();
vi.mock('@/hooks/useAdminAuditLogs', () => ({
  useAdminAuditLogs: (...args: unknown[]) => mockUseAdminAuditLogs(...args),
}));

describe('AdminAuditLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function defaultReturn() {
    return {
      logs: MOCK_LOGS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  }

  async function renderPage() {
    const { default: AdminAuditLogsPage } = await import('./AdminAuditLogsPage');
    return render(<AdminAuditLogsPage />);
  }

  it('should render audit logs list', async () => {
    mockUseAdminAuditLogs.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.getByText('Auditoria')).toBeDefined();
    // Action labels appear both in filter dropdown and in log entries
    expect(screen.getAllByText('Criar organização').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Alterar status').length).toBeGreaterThanOrEqual(2);
    // Table + mobile cards both render, so at least 2 instances
    expect(screen.getAllByText('admin@protos.farm').length).toBeGreaterThanOrEqual(2);
  });

  it('should render empty state when no logs', async () => {
    mockUseAdminAuditLogs.mockReturnValue({
      ...defaultReturn(),
      logs: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await renderPage();

    expect(screen.getByText('Nenhum registro de auditoria encontrado')).toBeDefined();
  });

  it('should render skeleton while loading', async () => {
    mockUseAdminAuditLogs.mockReturnValue({
      ...defaultReturn(),
      logs: [],
      isLoading: true,
    });

    await renderPage();

    const section = document.querySelector('[aria-live="polite"]');
    expect(section).toBeTruthy();
  });

  it('should show pagination when multiple pages', async () => {
    mockUseAdminAuditLogs.mockReturnValue({
      ...defaultReturn(),
      meta: { page: 2, limit: 20, total: 60, totalPages: 3 },
    });

    await renderPage();

    expect(screen.getByText('Página 2 de 3')).toBeDefined();
  });

  it('should have filter controls', async () => {
    mockUseAdminAuditLogs.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.getByLabelText('Ação')).toBeDefined();
    expect(screen.getByLabelText('De')).toBeDefined();
    expect(screen.getByLabelText('Até')).toBeDefined();
  });

  it('should show error message', async () => {
    mockUseAdminAuditLogs.mockReturnValue({
      ...defaultReturn(),
      logs: MOCK_LOGS,
      error: 'Erro ao carregar logs',
    });

    await renderPage();

    expect(screen.getByRole('alert').textContent).toContain('Erro ao carregar logs');
  });
});
