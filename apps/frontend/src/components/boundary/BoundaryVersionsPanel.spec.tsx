import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { BoundaryVersionItem, BoundaryVersionDetail } from '@/types/farm';

const mockVersions: BoundaryVersionItem[] = [
  {
    id: 'v-2',
    farmId: 'farm-1',
    registrationId: null,
    boundaryAreaHa: 120.5,
    uploadedBy: 'user-1',
    uploadedAt: '2026-03-01T10:00:00.000Z',
    filename: 'updated.geojson',
    version: 2,
  },
  {
    id: 'v-1',
    farmId: 'farm-1',
    registrationId: null,
    boundaryAreaHa: 100.0,
    uploadedBy: 'user-1',
    uploadedAt: '2026-02-01T10:00:00.000Z',
    filename: 'original.geojson',
    version: 1,
  },
];

const mockGeometry: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-47.0, -15.0],
      [-47.0, -16.0],
      [-46.0, -16.0],
      [-46.0, -15.0],
      [-47.0, -15.0],
    ],
  ],
};

const mockFetchVersionGeometry = vi.fn();

let mockHookReturn: {
  versions: BoundaryVersionItem[];
  isLoading: boolean;
  error: string | null;
  fetchVersionGeometry: (id: string) => Promise<BoundaryVersionDetail | null>;
} = {
  versions: mockVersions,
  isLoading: false,
  error: null,
  fetchVersionGeometry: mockFetchVersionGeometry,
};

vi.mock('@/hooks/useBoundaryVersions', () => ({
  useBoundaryVersions: () => mockHookReturn,
}));

import BoundaryVersionsPanel from './BoundaryVersionsPanel';

const defaultProps = {
  farmId: 'farm-1',
  entityLabel: 'da fazenda',
  onClose: vi.fn(),
  onPreviewVersion: vi.fn(),
};

describe('BoundaryVersionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookReturn = {
      versions: mockVersions,
      isLoading: false,
      error: null,
      fetchVersionGeometry: mockFetchVersionGeometry,
    };
    mockFetchVersionGeometry.mockResolvedValue({
      ...mockVersions[1],
      boundaryGeoJSON: mockGeometry,
    });
  });

  it('should render skeleton while loading', () => {
    mockHookReturn = { ...mockHookReturn, isLoading: true, versions: [] };
    render(<BoundaryVersionsPanel {...defaultProps} />);
    expect(screen.getByLabelText('Carregando versões')).toBeDefined();
  });

  it('should render version cards with data', () => {
    render(<BoundaryVersionsPanel {...defaultProps} />);
    expect(screen.getByText('v2')).toBeDefined();
    expect(screen.getByText('v1')).toBeDefined();
    expect(screen.getByText('Atual')).toBeDefined();
    expect(screen.getByText('120,50 ha')).toBeDefined();
    expect(screen.getByText('100,00 ha')).toBeDefined();
  });

  it('should show "Atual" badge on the latest version', () => {
    render(<BoundaryVersionsPanel {...defaultProps} />);
    expect(screen.getByText('Atual')).toBeDefined();
  });

  it('should call onPreviewVersion when clicking a previous version', async () => {
    const user = userEvent.setup();
    render(<BoundaryVersionsPanel {...defaultProps} />);

    const v1Button = screen.getByLabelText('Visualizar versão 1 no mapa');
    await user.click(v1Button);

    await waitFor(() => {
      expect(mockFetchVersionGeometry).toHaveBeenCalledWith('v-1');
      expect(defaultProps.onPreviewVersion).toHaveBeenCalledWith(mockGeometry);
    });
  });

  it('should clear preview when clicking selected version again', async () => {
    const user = userEvent.setup();
    render(<BoundaryVersionsPanel {...defaultProps} />);

    const v1Button = screen.getByLabelText('Visualizar versão 1 no mapa');
    await user.click(v1Button);

    await waitFor(() => {
      expect(defaultProps.onPreviewVersion).toHaveBeenCalledWith(mockGeometry);
    });

    await user.click(v1Button);

    await waitFor(() => {
      expect(defaultProps.onPreviewVersion).toHaveBeenCalledWith(null);
    });
  });

  it('should call onClose when clicking close button', async () => {
    const user = userEvent.setup();
    render(<BoundaryVersionsPanel {...defaultProps} />);

    await user.click(screen.getByLabelText('Fechar histórico de versões'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render empty state when no versions', () => {
    mockHookReturn = { ...mockHookReturn, versions: [] };
    render(<BoundaryVersionsPanel {...defaultProps} />);
    expect(screen.getByText('Nenhuma versão anterior')).toBeDefined();
  });

  it('should render error state', () => {
    mockHookReturn = { ...mockHookReturn, error: 'Erro ao carregar versões' };
    render(<BoundaryVersionsPanel {...defaultProps} />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Erro ao carregar versões')).toBeDefined();
  });

  it('should disable click on current version', () => {
    render(<BoundaryVersionsPanel {...defaultProps} />);
    const currentBtn = screen.getByLabelText('Versão 2 (atual)') as HTMLButtonElement;
    expect(currentBtn.disabled).toBe(true);
  });
});
