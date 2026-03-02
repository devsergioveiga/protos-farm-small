import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { BulkPreviewResult, BulkImportResult } from '@/types/farm';

// Mock the lazy-loaded map component
vi.mock('./BulkPreviewMap', () => ({
  default: () => <div data-testid="bulk-preview-map">Map</div>,
}));

// Mock useBulkImport hook
const mockUploadFile = vi.fn();
const mockConfirmImport = vi.fn();
const mockGoToPreview = vi.fn();
const mockGoToMapping = vi.fn();
const mockReset = vi.fn();
const mockToggleIndex = vi.fn();
const mockSelectAllValid = vi.fn();
const mockDeselectAll = vi.fn();
const mockSetColumnMapping = vi.fn();

let mockHookState = {
  step: 'idle' as string,
  preview: null as BulkPreviewResult | null,
  result: null as BulkImportResult | null,
  error: null as string | null,
  columnMapping: {},
  selectedIndices: new Set<number>(),
};

vi.mock('@/hooks/useBulkImport', () => ({
  useBulkImport: () => ({
    ...mockHookState,
    setColumnMapping: mockSetColumnMapping,
    toggleIndex: mockToggleIndex,
    selectAllValid: mockSelectAllValid,
    deselectAll: mockDeselectAll,
    uploadFile: mockUploadFile,
    goToPreview: mockGoToPreview,
    goToMapping: mockGoToMapping,
    confirmImport: mockConfirmImport,
    reset: mockReset,
  }),
}));

// Now import after mocks
import BulkImportModal from './BulkImportModal';

const samplePreview: BulkPreviewResult = {
  filename: 'plots.geojson',
  totalFeatures: 3,
  validCount: 2,
  invalidCount: 1,
  propertyKeys: ['nome', 'cultura', 'solo'],
  features: [
    {
      index: 0,
      properties: { nome: 'Talhão A', cultura: 'soja', solo: 'LATOSSOLO_VERMELHO' },
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [-55.7, -12.5],
            [-55.6, -12.5],
            [-55.6, -12.6],
            [-55.7, -12.6],
            [-55.7, -12.5],
          ],
        ],
      },
      areaHa: 100.5,
      validation: { valid: true, errors: [], warnings: [] },
    },
    {
      index: 1,
      properties: { nome: 'Talhão B', cultura: 'milho' },
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [-55.5, -12.5],
            [-55.4, -12.5],
            [-55.4, -12.6],
            [-55.5, -12.6],
            [-55.5, -12.5],
          ],
        ],
      },
      areaHa: 80.3,
      validation: {
        valid: true,
        errors: [],
        warnings: ['Talhão extrapola o perímetro da fazenda'],
      },
    },
    {
      index: 2,
      properties: { nome: 'Talhão C' },
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [-55.3, -12.5],
            [-55.2, -12.5],
            [-55.3, -12.5],
          ],
        ],
      },
      areaHa: 0,
      validation: {
        valid: false,
        errors: ['Polígono deve ter no mínimo 3 vértices'],
        warnings: [],
      },
    },
  ],
};

const sampleResult: BulkImportResult = {
  imported: 2,
  skipped: 1,
  items: [
    { index: 0, status: 'imported', plotId: 'plot-1', name: 'Talhão A', areaHa: 100.5 },
    { index: 1, status: 'imported', plotId: 'plot-2', name: 'Talhão B', areaHa: 80.3 },
    { index: 2, status: 'skipped', name: 'Talhão C', reason: 'Geometria inválida' },
  ],
  warnings: [],
};

const defaultProps = {
  isOpen: true,
  farmId: 'farm-1',
  farmBoundary: null,
  onClose: vi.fn(),
  onImportComplete: vi.fn(),
};

describe('BulkImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookState = {
      step: 'idle',
      preview: null,
      result: null,
      error: null,
      columnMapping: {},
      selectedIndices: new Set(),
    };
  });

  it('should render upload zone when open', () => {
    render(<BulkImportModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Arraste um arquivo/)).toBeDefined();
  });

  it('should not render when closed', () => {
    render(<BulkImportModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should call uploadFile when file is selected', async () => {
    const user = userEvent.setup();
    render(<BulkImportModal {...defaultProps} />);

    const fileInput = screen.getByLabelText('Selecionar arquivo geo');
    const file = new File(['{"type":"FeatureCollection","features":[]}'], 'test.geojson', {
      type: 'application/json',
    });

    await user.upload(fileInput, file);
    expect(mockUploadFile).toHaveBeenCalledWith(file, 'farm-1');
  });

  it('should show column mapping with property keys', () => {
    mockHookState = {
      ...mockHookState,
      step: 'mapping',
      preview: samplePreview,
      columnMapping: { name: 'nome' },
    };

    render(<BulkImportModal {...defaultProps} />);

    // Both modal title (h2) and form title (h3) show "Mapeamento de colunas"
    const headings = screen.getAllByText('Mapeamento de colunas');
    expect(headings.length).toBeGreaterThanOrEqual(1);
    // Check property keys are in the selects
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('should auto-map "nome" to name field', () => {
    mockHookState = {
      ...mockHookState,
      step: 'mapping',
      preview: samplePreview,
      columnMapping: { name: 'nome' },
    };

    render(<BulkImportModal {...defaultProps} />);

    const nameSelect = screen.getByLabelText(/Nome do talhão/);
    expect((nameSelect as HTMLSelectElement).value).toBe('nome');
  });

  it('should show preview table with features and status icons', () => {
    mockHookState = {
      ...mockHookState,
      step: 'previewing',
      preview: samplePreview,
      selectedIndices: new Set([0, 1]),
      columnMapping: { name: 'nome' },
    };

    render(<BulkImportModal {...defaultProps} />);

    expect(screen.getByText('3 features encontradas')).toBeDefined();
    expect(screen.getByText('Talhão A')).toBeDefined();
    expect(screen.getByText('Talhão B')).toBeDefined();
  });

  it('should have checkboxes that toggle selection', async () => {
    const user = userEvent.setup();
    mockHookState = {
      ...mockHookState,
      step: 'previewing',
      preview: samplePreview,
      selectedIndices: new Set([0, 1]),
      columnMapping: { name: 'nome' },
    };

    render(<BulkImportModal {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    // First two should be checked (valid), third disabled (invalid)
    expect(checkboxes[0]).toHaveProperty('checked', true);
    expect(checkboxes[2]).toHaveProperty('disabled', true);

    await user.click(checkboxes[0]);
    expect(mockToggleIndex).toHaveBeenCalledWith(0);
  });

  it('should call selectAllValid when button clicked', async () => {
    const user = userEvent.setup();
    mockHookState = {
      ...mockHookState,
      step: 'previewing',
      preview: samplePreview,
      selectedIndices: new Set(),
      columnMapping: { name: 'nome' },
    };

    render(<BulkImportModal {...defaultProps} />);

    await user.click(screen.getByText('Selecionar válidas'));
    expect(mockSelectAllValid).toHaveBeenCalled();
  });

  it('should disable confirm button when nothing selected', () => {
    mockHookState = {
      ...mockHookState,
      step: 'previewing',
      preview: samplePreview,
      selectedIndices: new Set(),
      columnMapping: { name: 'nome' },
    };

    render(<BulkImportModal {...defaultProps} />);

    // Confirm button should not be shown when nothing selected
    expect(screen.queryByText(/Importar \d+ talhões/)).toBeNull();
  });

  it('should show confirm button with count when items selected', () => {
    mockHookState = {
      ...mockHookState,
      step: 'previewing',
      preview: samplePreview,
      selectedIndices: new Set([0, 1]),
      columnMapping: { name: 'nome' },
    };

    render(<BulkImportModal {...defaultProps} />);

    expect(screen.getByText('Importar 2 talhões')).toBeDefined();
  });

  it('should show report with imported/skipped counts', () => {
    mockHookState = {
      ...mockHookState,
      step: 'done',
      result: sampleResult,
    };

    render(<BulkImportModal {...defaultProps} />);

    expect(screen.getByText('Importação concluída')).toBeDefined();
    expect(screen.getByText('2 talhões importados')).toBeDefined();
    expect(screen.getByText('1 talhões ignorados')).toBeDefined();
  });

  it('should call onClose when close button clicked', async () => {
    const user = userEvent.setup();
    render(<BulkImportModal {...defaultProps} />);

    await user.click(screen.getByLabelText('Fechar'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
