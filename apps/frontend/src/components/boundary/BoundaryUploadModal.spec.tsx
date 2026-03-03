import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { BoundaryUploadResult } from '@/types/farm';
import type { ClientPreview } from '@/hooks/useBoundaryUpload';

// Mock the lazy-loaded map component
vi.mock('./BoundaryPreviewMap', () => ({
  default: () => <div data-testid="boundary-preview-map">Map</div>,
}));

// Mock BulkUploadZone
vi.mock('@/components/bulk-import/BulkUploadZone', () => ({
  default: ({
    onFileSelect,
    isUploading,
  }: {
    onFileSelect: (f: File) => void;
    isUploading: boolean;
  }) => (
    <div data-testid="upload-zone" data-uploading={isUploading}>
      <button onClick={() => onFileSelect(new File(['{}'], 'test.geojson'))}>Select File</button>
    </div>
  ),
}));

// Mock useBoundaryUpload hook
const mockSelectFile = vi.fn();
const mockUpload = vi.fn();
const mockReset = vi.fn();

let mockHookState: {
  step: string;
  file: File | null;
  clientPreview: ClientPreview | null;
  canPreview: boolean;
  result: BoundaryUploadResult | null;
  error: string | null;
} = {
  step: 'idle',
  file: null,
  clientPreview: null,
  canPreview: false,
  result: null,
  error: null,
};

vi.mock('@/hooks/useBoundaryUpload', () => ({
  useBoundaryUpload: () => ({
    ...mockHookState,
    selectFile: mockSelectFile,
    upload: mockUpload,
    reset: mockReset,
  }),
}));

import BoundaryUploadModal from './BoundaryUploadModal';

const defaultProps = {
  isOpen: true,
  farmId: 'farm-1',
  farmTotalAreaHa: 100,
  existingBoundary: null as GeoJSON.Polygon | null,
  onClose: vi.fn(),
  onUploadComplete: vi.fn(),
};

describe('BoundaryUploadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookState = {
      step: 'idle',
      file: null,
      clientPreview: null,
      canPreview: false,
      result: null,
      error: null,
    };
  });

  it('should not render when isOpen is false', () => {
    render(<BoundaryUploadModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should render dialog with title in idle step', () => {
    render(<BoundaryUploadModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Upload de perímetro')).toBeDefined();
    expect(screen.getByTestId('upload-zone')).toBeDefined();
  });

  it('should show error when present', () => {
    mockHookState.error = 'Formato não suportado';
    render(<BoundaryUploadModal {...defaultProps} />);
    expect(screen.getByRole('alert').textContent).toContain('Formato não suportado');
  });

  it('should call selectFile when file is selected from dropzone', async () => {
    const user = userEvent.setup();
    render(<BoundaryUploadModal {...defaultProps} />);

    await user.click(screen.getByText('Select File'));
    expect(mockSelectFile).toHaveBeenCalledWith(expect.any(File), 100);
  });

  it('should show preview info for GeoJSON file', () => {
    mockHookState.step = 'previewing';
    mockHookState.file = new File(['{}'], 'boundary.geojson');
    mockHookState.canPreview = true;
    mockHookState.clientPreview = {
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
      areaHa: 105,
      divergencePercentage: 5,
    };

    render(<BoundaryUploadModal {...defaultProps} />);

    expect(screen.getByText('Preview do perímetro')).toBeDefined();
    expect(screen.getByText('boundary.geojson')).toBeDefined();
    expect(screen.getByText('105,00 ha')).toBeDefined();
    expect(screen.getByText('100,00 ha')).toBeDefined();
    expect(screen.getByText('Enviar perímetro')).toBeDefined();
    expect(screen.getByText('Cancelar')).toBeDefined();
  });

  it('should show preview map for GeoJSON file', () => {
    mockHookState.step = 'previewing';
    mockHookState.file = new File(['{}'], 'boundary.geojson');
    mockHookState.canPreview = true;
    mockHookState.clientPreview = {
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
      areaHa: 100,
      divergencePercentage: 0,
    };

    render(<BoundaryUploadModal {...defaultProps} />);
    expect(screen.getByTestId('boundary-preview-map')).toBeDefined();
  });

  it('should show no-preview message for KML files', () => {
    mockHookState.step = 'previewing';
    mockHookState.file = new File(['<kml></kml>'], 'boundary.kml');
    mockHookState.canPreview = false;
    mockHookState.clientPreview = null;

    render(<BoundaryUploadModal {...defaultProps} />);
    expect(screen.getByText(/Preview não disponível/)).toBeDefined();
    expect(screen.queryByTestId('boundary-preview-map')).toBeNull();
  });

  it('should show replace note when existing boundary present', () => {
    mockHookState.step = 'previewing';
    mockHookState.file = new File(['<kml></kml>'], 'test.kml');
    mockHookState.canPreview = false;

    render(
      <BoundaryUploadModal
        {...defaultProps}
        existingBoundary={{
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        }}
      />,
    );
    expect(screen.getByText(/perímetro atual será substituído/)).toBeDefined();
  });

  it('should show divergence badge with warning color for >10%', () => {
    mockHookState.step = 'previewing';
    mockHookState.file = new File(['{}'], 'b.geojson');
    mockHookState.canPreview = true;
    mockHookState.clientPreview = {
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
      areaHa: 115,
      divergencePercentage: 15,
    };

    render(<BoundaryUploadModal {...defaultProps} />);
    const badge = screen.getByText(/15,00% de divergência/);
    expect(badge.className).toContain('warning');
  });

  it('should show divergence badge with danger color for >20%', () => {
    mockHookState.step = 'previewing';
    mockHookState.file = new File(['{}'], 'b.geojson');
    mockHookState.canPreview = true;
    mockHookState.clientPreview = {
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
      areaHa: 130,
      divergencePercentage: 30,
    };

    render(<BoundaryUploadModal {...defaultProps} />);
    const badge = screen.getByText(/30,00% de divergência/);
    expect(badge.className).toContain('danger');
  });

  it('should call upload when Enviar button is clicked', async () => {
    const user = userEvent.setup();
    mockHookState.step = 'previewing';
    mockHookState.file = new File(['<kml></kml>'], 'test.kml');
    mockHookState.canPreview = false;

    render(<BoundaryUploadModal {...defaultProps} />);
    await user.click(screen.getByText('Enviar perímetro'));
    expect(mockUpload).toHaveBeenCalledWith('/org/farms/farm-1/boundary');
  });

  it('should call reset when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    mockHookState.step = 'previewing';
    mockHookState.file = new File(['<kml></kml>'], 'test.kml');
    mockHookState.canPreview = false;

    render(<BoundaryUploadModal {...defaultProps} />);
    await user.click(screen.getByText('Cancelar'));
    expect(mockReset).toHaveBeenCalled();
  });

  it('should show uploading state', () => {
    mockHookState.step = 'uploading';

    render(<BoundaryUploadModal {...defaultProps} />);
    expect(screen.getAllByText('Enviando perímetro...').length).toBeGreaterThanOrEqual(1);
  });

  it('should show result on done step', () => {
    mockHookState.step = 'done';
    mockHookState.result = {
      boundaryAreaHa: 100,
      areaDivergence: null,
      warnings: [],
    };

    render(<BoundaryUploadModal {...defaultProps} />);
    expect(screen.getByText('Perímetro salvo com sucesso')).toBeDefined();
    expect(screen.getByText('100,00 ha')).toBeDefined();
    expect(screen.getByText('Fechar')).toBeDefined();
  });

  it('should show warnings in done step', () => {
    mockHookState.step = 'done';
    mockHookState.result = {
      boundaryAreaHa: 100,
      areaDivergence: null,
      warnings: ['Coordenadas ajustadas para WGS84'],
    };

    render(<BoundaryUploadModal {...defaultProps} />);
    expect(screen.getByText('Coordenadas ajustadas para WGS84')).toBeDefined();
  });

  it('should call onUploadComplete and onClose when Fechar is clicked on done step', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onUploadComplete = vi.fn();

    mockHookState.step = 'done';
    mockHookState.result = {
      boundaryAreaHa: 100,
      areaDivergence: null,
      warnings: [],
    };

    render(
      <BoundaryUploadModal
        {...defaultProps}
        onClose={onClose}
        onUploadComplete={onUploadComplete}
      />,
    );

    await user.click(screen.getByText('Fechar'));
    expect(onUploadComplete).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should close on Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<BoundaryUploadModal {...defaultProps} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('should show result divergence badge', () => {
    mockHookState.step = 'done';
    mockHookState.result = {
      boundaryAreaHa: 120,
      areaDivergence: {
        referenceAreaHa: 100,
        boundaryAreaHa: 120,
        percentage: 20,
        warning: true,
      },
      warnings: [],
    };

    render(<BoundaryUploadModal {...defaultProps} />);
    expect(screen.getByText(/20,00% de divergência/)).toBeDefined();
  });

  describe('registration boundary upload', () => {
    const regProps = {
      ...defaultProps,
      registrationId: 'reg-1',
      referenceAreaHa: 75.5,
      entityLabel: 'da matrícula 12345',
    };

    it('should use registration aria-label', () => {
      render(<BoundaryUploadModal {...regProps} />);
      expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe(
        'Upload de perímetro da matrícula 12345',
      );
    });

    it('should use referenceAreaHa for preview comparison', () => {
      mockHookState.step = 'previewing';
      mockHookState.file = new File(['{}'], 'test.geojson');
      mockHookState.canPreview = false;

      render(<BoundaryUploadModal {...regProps} />);
      expect(screen.getByText('75,50 ha')).toBeDefined();
    });

    it('should call selectFile with referenceAreaHa', async () => {
      const user = userEvent.setup();
      render(<BoundaryUploadModal {...regProps} />);

      await user.click(screen.getByText('Select File'));
      expect(mockSelectFile).toHaveBeenCalledWith(expect.any(File), 75.5);
    });

    it('should call upload with registration boundary URL', async () => {
      const user = userEvent.setup();
      mockHookState.step = 'previewing';
      mockHookState.file = new File(['<kml></kml>'], 'test.kml');
      mockHookState.canPreview = false;

      render(<BoundaryUploadModal {...regProps} />);
      await user.click(screen.getByText('Enviar perímetro'));
      expect(mockUpload).toHaveBeenCalledWith('/org/farms/farm-1/registrations/reg-1/boundary');
    });
  });
});
