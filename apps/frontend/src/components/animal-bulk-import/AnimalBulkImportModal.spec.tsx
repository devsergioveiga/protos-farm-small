import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AnimalBulkPreviewResult, AnimalBulkImportResult } from '@/types/animal';

// Mock useBulkImportAnimals hook
const mockUploadFile = vi.fn();
const mockConfirmImport = vi.fn();
const mockGoToPreview = vi.fn();
const mockGoToMapping = vi.fn();
const mockReset = vi.fn();
const mockToggleIndex = vi.fn();
const mockSelectAllValid = vi.fn();
const mockDeselectAll = vi.fn();
const mockSetColumnMapping = vi.fn();

let mockStep = 'idle';
let mockPreview: AnimalBulkPreviewResult | null = null;
let mockResult: AnimalBulkImportResult | null = null;
let mockError: string | null = null;
let mockSelectedIndices = new Set<number>();
let mockColumnMapping = {};

vi.mock('@/hooks/useBulkImportAnimals', () => ({
  useBulkImportAnimals: () => ({
    step: mockStep,
    preview: mockPreview,
    result: mockResult,
    error: mockError,
    columnMapping: mockColumnMapping,
    setColumnMapping: mockSetColumnMapping,
    selectedIndices: mockSelectedIndices,
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

import AnimalBulkImportModal from './AnimalBulkImportModal';

const samplePreview: AnimalBulkPreviewResult = {
  filename: 'animals.csv',
  totalRows: 3,
  validCount: 2,
  invalidCount: 1,
  columnHeaders: ['Brinco', 'Sexo', 'Raça', 'Percentual'],
  rows: [
    {
      index: 0,
      parsed: { earTag: 'BR001', sex: 'MALE', name: 'Touro1' },
      derived: {
        suggestedCategory: 'BEZERRO',
        resolvedBreeds: [{ breedId: 'b1', breedName: 'Nelore', percentage: 100 }],
      },
      validation: { valid: true, errors: [], warnings: [] },
    },
    {
      index: 1,
      parsed: { earTag: 'BR002', sex: 'FEMALE' },
      derived: { suggestedCategory: 'BEZERRA' },
      validation: { valid: true, errors: [], warnings: ['Brinco duplicado no arquivo'] },
    },
    {
      index: 2,
      parsed: { earTag: '', sex: '' },
      derived: {},
      validation: {
        valid: false,
        errors: ['Brinco é obrigatório', 'Sexo é obrigatório'],
        warnings: [],
      },
    },
  ],
};

const sampleResult: AnimalBulkImportResult = {
  imported: 2,
  skipped: 1,
  items: [
    { index: 0, status: 'imported', animalId: 'a1', earTag: 'BR001' },
    { index: 1, status: 'imported', animalId: 'a2', earTag: 'BR002' },
    { index: 2, status: 'skipped', earTag: '', reason: 'Brinco é obrigatório' },
  ],
  warnings: [],
};

const defaultProps = {
  isOpen: true,
  farmId: 'farm-1',
  onClose: vi.fn(),
  onImportComplete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStep = 'idle';
  mockPreview = null;
  mockResult = null;
  mockError = null;
  mockSelectedIndices = new Set();
  mockColumnMapping = {};
});

describe('AnimalBulkImportModal', () => {
  it('should render upload zone when idle', () => {
    render(<AnimalBulkImportModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Arraste um arquivo/)).toBeDefined();
  });

  it('should not render when closed', () => {
    render(<AnimalBulkImportModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should show accepted file formats', () => {
    render(<AnimalBulkImportModal {...defaultProps} />);
    expect(screen.getByText(/CSV, Excel/)).toBeDefined();
  });

  it('should close on Escape key', () => {
    render(<AnimalBulkImportModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close on X button click', () => {
    render(<AnimalBulkImportModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show column mapping form with groups', () => {
    mockStep = 'mapping';
    mockPreview = samplePreview;
    render(<AnimalBulkImportModal {...defaultProps} />);

    expect(screen.getAllByText('Mapeamento de colunas')).toHaveLength(2); // title + form heading
    expect(screen.getByText('Identificação')).toBeDefined();
    expect(screen.getByText('Dados básicos')).toBeDefined();
    expect(screen.getByText('Composição racial')).toBeDefined();
    expect(screen.getByText('Saúde e genealogia')).toBeDefined();
    expect(screen.getByText('Visualizar preview')).toBeDefined();
  });

  it('should call goToPreview when clicking next', async () => {
    mockStep = 'mapping';
    mockPreview = samplePreview;
    const user = userEvent.setup();
    render(<AnimalBulkImportModal {...defaultProps} />);

    await user.click(screen.getByText('Visualizar preview'));
    expect(mockGoToPreview).toHaveBeenCalled();
  });

  it('should show preview table with rows', () => {
    mockStep = 'previewing';
    mockPreview = samplePreview;
    mockSelectedIndices = new Set([0, 1]);
    render(<AnimalBulkImportModal {...defaultProps} />);

    expect(screen.getByText('Preview dos animais')).toBeDefined();
    expect(screen.getByText('3 linhas encontradas')).toBeDefined();
    expect(screen.getByText('BR001')).toBeDefined();
    expect(screen.getByText('BR002')).toBeDefined();
  });

  it('should show error badges for invalid rows', () => {
    mockStep = 'previewing';
    mockPreview = samplePreview;
    mockSelectedIndices = new Set([0, 1]);
    render(<AnimalBulkImportModal {...defaultProps} />);

    expect(screen.getByText('Brinco é obrigatório')).toBeDefined();
    expect(screen.getByText('Sexo é obrigatório')).toBeDefined();
  });

  it('should show warning badges', () => {
    mockStep = 'previewing';
    mockPreview = samplePreview;
    mockSelectedIndices = new Set([0, 1]);
    render(<AnimalBulkImportModal {...defaultProps} />);

    expect(screen.getByText('Brinco duplicado no arquivo')).toBeDefined();
  });

  it('should show import button with count', () => {
    mockStep = 'previewing';
    mockPreview = samplePreview;
    mockSelectedIndices = new Set([0, 1]);
    render(<AnimalBulkImportModal {...defaultProps} />);

    expect(screen.getByText('Importar 2 animais')).toBeDefined();
  });

  it('should show report after done', () => {
    mockStep = 'done';
    mockResult = sampleResult;
    render(<AnimalBulkImportModal {...defaultProps} />);

    expect(screen.getByText('Importação concluída')).toBeDefined();
    expect(screen.getByText('2 animais importados')).toBeDefined();
    expect(screen.getByText('1 animais ignorados')).toBeDefined();
  });

  it('should call onImportComplete when closing after done', async () => {
    mockStep = 'done';
    mockResult = sampleResult;
    const user = userEvent.setup();
    render(<AnimalBulkImportModal {...defaultProps} />);

    await user.click(screen.getByText('Fechar'));
    expect(defaultProps.onImportComplete).toHaveBeenCalled();
  });

  it('should show error message', () => {
    mockError = 'Arquivo corrompido';
    render(<AnimalBulkImportModal {...defaultProps} />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Arquivo corrompido')).toBeDefined();
  });
});
