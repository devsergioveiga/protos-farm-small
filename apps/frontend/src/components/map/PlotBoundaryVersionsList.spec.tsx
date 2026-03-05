import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PlotBoundaryVersionsList from './PlotBoundaryVersionsList';

const mockUsePlotBoundaryVersions = vi.fn();

vi.mock('@/hooks/usePlotBoundaryVersions', () => ({
  usePlotBoundaryVersions: (...args: unknown[]) => mockUsePlotBoundaryVersions(...args),
}));

describe('PlotBoundaryVersionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render skeleton during loading', () => {
    mockUsePlotBoundaryVersions.mockReturnValue({
      versions: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<PlotBoundaryVersionsList farmId="farm-1" plotId="plot-1" />);
    expect(screen.getByLabelText('Carregando versões')).toBeDefined();
  });

  it('should render empty state when no versions', () => {
    mockUsePlotBoundaryVersions.mockReturnValue({
      versions: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PlotBoundaryVersionsList farmId="farm-1" plotId="plot-1" />);
    expect(screen.getByText('Nenhuma versão anterior registrada')).toBeDefined();
  });

  it('should render error state', () => {
    mockUsePlotBoundaryVersions.mockReturnValue({
      versions: [],
      isLoading: false,
      error: 'Erro de rede',
      refetch: vi.fn(),
    });

    render(<PlotBoundaryVersionsList farmId="farm-1" plotId="plot-1" />);
    expect(
      screen.getByText('Não foi possível carregar as versões do perímetro. Tente novamente.'),
    ).toBeDefined();
  });

  it('should render list of versions with badge "Atual" on most recent', () => {
    mockUsePlotBoundaryVersions.mockReturnValue({
      versions: [
        {
          id: 'v1',
          version: 1,
          boundaryAreaHa: 45.5,
          editedAt: '2026-01-15T10:00:00Z',
          editSource: 'file_upload',
        },
        {
          id: 'v2',
          version: 2,
          boundaryAreaHa: 44.8,
          editedAt: '2026-02-20T14:30:00Z',
          editSource: 'map_editor',
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PlotBoundaryVersionsList farmId="farm-1" plotId="plot-1" />);

    expect(screen.getByText('v1')).toBeDefined();
    expect(screen.getByText('v2')).toBeDefined();
    expect(screen.getByText('Atual')).toBeDefined();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('should translate editSource labels', () => {
    mockUsePlotBoundaryVersions.mockReturnValue({
      versions: [
        {
          id: 'v1',
          version: 1,
          boundaryAreaHa: 30.0,
          editedAt: '2026-01-10T08:00:00Z',
          editSource: 'file_upload',
        },
        {
          id: 'v2',
          version: 2,
          boundaryAreaHa: 15.0,
          editedAt: '2026-01-20T08:00:00Z',
          editSource: 'subdivide',
        },
        {
          id: 'v3',
          version: 3,
          boundaryAreaHa: 45.0,
          editedAt: '2026-02-01T08:00:00Z',
          editSource: 'merge',
        },
        {
          id: 'v4',
          version: 4,
          boundaryAreaHa: 44.5,
          editedAt: '2026-03-01T08:00:00Z',
          editSource: 'map_editor',
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PlotBoundaryVersionsList farmId="farm-1" plotId="plot-1" />);

    expect(screen.getByText('Upload de arquivo')).toBeDefined();
    expect(screen.getByText('Subdivisão')).toBeDefined();
    expect(screen.getByText('Mesclagem')).toBeDefined();
    expect(screen.getByText('Editor de mapa')).toBeDefined();
  });

  it('should display area in hectares formatted in pt-BR', () => {
    mockUsePlotBoundaryVersions.mockReturnValue({
      versions: [
        {
          id: 'v1',
          version: 1,
          boundaryAreaHa: 123.45,
          editedAt: '2026-01-10T08:00:00Z',
          editSource: 'file_upload',
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PlotBoundaryVersionsList farmId="farm-1" plotId="plot-1" />);

    expect(screen.getByText('123,45 ha')).toBeDefined();
  });
});
