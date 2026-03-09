import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MonitoringReportPage from './MonitoringReportPage';
import type { MonitoringReportResponse } from '@/types/monitoring-report';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'u1', role: 'ADMIN', permissions: ['farms:read', 'farms:update'] },
    permissions: ['farms:read', 'farms:update'],
  }),
}));

import { api } from '@/services/api';

const mockedApi = vi.mocked(api);

const SAMPLE_REPORT: MonitoringReportResponse = {
  summary: {
    farmName: 'Fazenda Sol',
    reportPeriod: { start: '2026-01-01', end: '2026-03-01' },
    generatedAt: '2026-03-01T12:00:00.000Z',
    totalMonitoringPoints: 10,
    totalPestsMonitored: 2,
    totalMonitoringRecords: 42,
    plotsIncluded: [
      { id: 'plot-1', name: 'Talhão A', monitoringPointCount: 5, recordCount: 20 },
      { id: 'plot-2', name: 'Talhão B', monitoringPointCount: 5, recordCount: 22 },
    ],
  },
  pestSummary: [
    {
      pestId: 'pest-1',
      commonName: 'Lagarta-da-soja',
      scientificName: 'Anticarsia gemmatalis',
      category: 'INSETO',
      categoryLabel: 'Inseto',
      affectedCrops: ['Soja'],
      peakLevel: 'ALTO',
      peakLevelLabel: 'Alto',
      firstDetected: '2026-01-10',
      lastDetected: '2026-02-25',
      recordCount: 30,
      affectedPointCount: 6,
      hasNaturalEnemies: true,
    },
  ],
  detailedAnalysis: [
    {
      pestId: 'pest-1',
      pestName: 'Lagarta-da-soja',
      scientificName: 'Anticarsia gemmatalis',
      category: 'INSETO',
      timeline: [
        { date: '2026-01-06', avgIntensity: 0.25, recordCount: 5 },
        { date: '2026-01-13', avgIntensity: 0.5, recordCount: 8 },
      ],
      trend: 'increasing',
      trendLabel: 'Em alta',
      controlDecisions: [
        {
          date: '2026-01-13',
          urgency: 'ALERTA',
          urgencyLabel: 'Alerta',
          affectedPointCount: 4,
          maxLevel: 'ALTO',
          maxLevelLabel: 'Alto',
          justification:
            'Infestação atingiu nível Alto, acima do NC (Moderado). 4 registro(s) na semana.',
        },
      ],
      naturalEnemiesObserved: true,
      ndeDescription: '20 lagartas/m linear',
      ncDescription: '15 lagartas/m linear',
      recommendedProducts: 'Baculovirus, Bt',
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/farms/farm-1/monitoring-report']}>
      <Routes>
        <Route path="/farms/:farmId/monitoring-report" element={<MonitoringReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonitoringReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: farm name fetch
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/org/farms/farm-1') && !url.includes('monitoring-report')) {
        return { id: 'farm-1', name: 'Fazenda Sol' };
      }
      throw new Error('Unexpected API call');
    });
  });

  it('should render the page title and date inputs', () => {
    renderPage();
    expect(screen.getByText('Relatório MIP para Certificadoras')).toBeDefined();
    expect(screen.getByLabelText(/data inicial/i)).toBeDefined();
    expect(screen.getByLabelText(/data final/i)).toBeDefined();
  });

  it('should render the generate button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /gerar relatório/i })).toBeDefined();
  });

  it('should show loading skeleton when generating', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('monitoring-report')) {
        return new Promise(() => {}); // never resolves
      }
      return { id: 'farm-1', name: 'Fazenda Sol' };
    });

    renderPage();
    const btn = screen.getByRole('button', { name: /gerar relatório/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByLabelText(/gerando relatório/i)).toBeDefined();
    });
  });

  it('should display report data after generation', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('monitoring-report')) {
        return SAMPLE_REPORT;
      }
      return { id: 'farm-1', name: 'Fazenda Sol' };
    });

    renderPage();
    const btn = screen.getByRole('button', { name: /gerar relatório/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeDefined(); // total records
    });

    expect(screen.getByText('Talhões Monitorados')).toBeDefined();
    expect(screen.getAllByText('Talhão A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Talhão B').length).toBeGreaterThan(0);
    expect(screen.getByText('Pragas Monitoradas')).toBeDefined();
    expect(screen.getAllByText('Lagarta-da-soja').length).toBeGreaterThan(0);
  });

  it('should show pest detail with control decisions', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('monitoring-report')) {
        return SAMPLE_REPORT;
      }
      return { id: 'farm-1', name: 'Fazenda Sol' };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));

    await waitFor(() => {
      expect(screen.getByText('Análise Detalhada por Praga')).toBeDefined();
    });

    // Expand the detail card — button contains pest name in accessible name
    const expandBtns = screen.getAllByRole('button');
    const pestBtn = expandBtns.find((btn) => btn.textContent?.includes('Lagarta-da-soja'));
    expect(pestBtn).toBeDefined();
    fireEvent.click(pestBtn!);

    await waitFor(() => {
      expect(screen.getByText('Evolução Semanal')).toBeDefined();
      expect(screen.getByText('Decisões de Controle')).toBeDefined();
      expect(screen.getByText(/infestação atingiu nível alto/i)).toBeDefined();
    });
  });

  it('should show NDE and NC descriptions when expanded', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('monitoring-report')) {
        return SAMPLE_REPORT;
      }
      return { id: 'farm-1', name: 'Fazenda Sol' };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));

    await waitFor(() => {
      expect(screen.getByText('Análise Detalhada por Praga')).toBeDefined();
    });

    const expandBtns = screen.getAllByRole('button');
    const pestBtn = expandBtns.find((btn) => btn.textContent?.includes('Lagarta-da-soja'));
    fireEvent.click(pestBtn!);

    await waitFor(() => {
      expect(screen.getByText('20 lagartas/m linear')).toBeDefined();
      expect(screen.getByText('15 lagartas/m linear')).toBeDefined();
      expect(screen.getByText('Baculovirus, Bt')).toBeDefined();
    });
  });

  it('should show error message on failure', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('monitoring-report')) {
        throw new Error('Não foi possível gerar o relatório');
      }
      return { id: 'farm-1', name: 'Fazenda Sol' };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Não foi possível gerar o relatório');
    });
  });

  it('should show empty state when report has no data', async () => {
    const emptyReport: MonitoringReportResponse = {
      summary: {
        farmName: 'Fazenda Sol',
        reportPeriod: { start: '2026-01-01', end: '2026-03-01' },
        generatedAt: '2026-03-01T12:00:00.000Z',
        totalMonitoringPoints: 0,
        totalPestsMonitored: 0,
        totalMonitoringRecords: 0,
        plotsIncluded: [],
      },
      pestSummary: [],
      detailedAnalysis: [],
    };

    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('monitoring-report')) {
        return emptyReport;
      }
      return { id: 'farm-1', name: 'Fazenda Sol' };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));

    await waitFor(() => {
      expect(screen.getByText('Nenhum registro no período')).toBeDefined();
    });
  });

  it('should show Excel download button after report generation', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('monitoring-report')) {
        return SAMPLE_REPORT;
      }
      return { id: 'farm-1', name: 'Fazenda Sol' };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /baixar excel/i })).toBeDefined();
    });
  });

  it('should display natural enemies indicator', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('monitoring-report')) {
        return SAMPLE_REPORT;
      }
      return { id: 'farm-1', name: 'Fazenda Sol' };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /gerar relatório/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Lagarta-da-soja').length).toBeGreaterThan(0);
    });

    // Expand pest detail
    const expandBtns = screen.getAllByRole('button');
    const pestBtn = expandBtns.find((btn) => btn.textContent?.includes('Lagarta-da-soja'));
    fireEvent.click(pestBtn!);

    await waitFor(() => {
      expect(screen.getByText(/inimigos naturais observados/i)).toBeDefined();
    });
  });

  it('should have back navigation link', () => {
    renderPage();
    const backLink = screen.getByText(/voltar à fazenda/i);
    expect(backLink).toBeDefined();
    expect(backLink.closest('a')?.getAttribute('href')).toBe('/farms/farm-1');
  });
});
