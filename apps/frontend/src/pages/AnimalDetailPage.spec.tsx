import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AnimalDetail } from '@/types/animal';
import AnimalDetailPage from './AnimalDetailPage';

const MOCK_ANIMAL: AnimalDetail = {
  id: 'a1',
  farmId: 'farm-1',
  earTag: 'BR-001',
  rfidTag: 'RFID-001',
  name: 'Mimosa',
  sex: 'FEMALE',
  birthDate: '2022-03-15',
  birthDateEstimated: false,
  category: 'VACA_LACTACAO',
  categorySuggested: 'VACA_SECA',
  origin: 'BORN',
  entryWeightKg: 450,
  bodyConditionScore: 3,
  lotId: 'lot-1',
  lotName: 'Lote Maternidade',
  isCompositionEstimated: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  compositions: [
    {
      id: 'c1',
      breedId: 'b1',
      percentage: 50,
      fraction: '1/2',
      breed: { id: 'b1', name: 'Holandesa', code: 'HOL' },
    },
    {
      id: 'c2',
      breedId: 'b2',
      percentage: 50,
      fraction: '1/2',
      breed: { id: 'b2', name: 'Gir Leiteiro', code: 'GIR' },
    },
  ],
  breedSummary: 'Holandesa 50% + Gir Leiteiro 50%',
  sire: { id: 'a-sire', earTag: 'BR-100', name: 'Trovão' },
  dam: { id: 'a-dam', earTag: 'BR-200', name: 'Estrela' },
  photoUrl: null,
  notes: 'Animal dócil, boa produtora.',
  genealogicalRecords: [
    {
      id: 'gr1',
      genealogyClass: 'PO',
      registrationNumber: 'REG-123',
      associationName: 'ABCZ',
      registrationDate: '2023-01-15',
      girolando_grade: null,
      notes: null,
    },
  ],
  offspring: [
    { id: 'a-child-1', earTag: 'BR-301', name: 'Flor', sex: 'FEMALE' },
    { id: 'a-child-2', earTag: 'BR-302', name: null, sex: 'MALE' },
  ],
};

const mockUseAnimalDetail = vi.fn();

vi.mock('@/hooks/useAnimalDetail', () => ({
  useAnimalDetail: (...args: unknown[]) => mockUseAnimalDetail(...args),
}));

vi.mock('@/components/animals/WeighingTab', () => ({
  default: () => <div data-testid="weighing-tab">WeighingTab</div>,
}));

vi.mock('@/components/animals/SanitaryTab', () => ({
  default: () => <div data-testid="sanitary-tab">SanitaryTab</div>,
}));

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => ({
    selectedFarm: { id: 'farm-1', name: 'Fazenda Santa Helena' },
    farms: [],
    isLoadingFarms: false,
    selectedFarmId: 'farm-1',
    selectFarm: vi.fn(),
    refreshFarms: vi.fn(),
  }),
}));

function defaultReturn() {
  return {
    animal: MOCK_ANIMAL,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

function renderPage(animalId = 'a1') {
  return render(
    <MemoryRouter initialEntries={[`/animals/${animalId}`]}>
      <Routes>
        <Route path="/animals/:animalId" element={<AnimalDetailPage />} />
        <Route path="/animals" element={<div>Animals list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AnimalDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render skeleton while loading', () => {
    mockUseAnimalDetail.mockReturnValue({
      ...defaultReturn(),
      animal: null,
      isLoading: true,
    });

    renderPage();
    expect(document.querySelector('.animal-detail__skeleton')).toBeTruthy();
  });

  it('should render animal header with earTag and name', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(screen.getAllByText(/BR-001/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mimosa/).length).toBeGreaterThan(0);
  });

  it('should render sex, category and origin badges', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(screen.getAllByText('Fêmea').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vaca em Lactação').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nascido').length).toBeGreaterThan(0);
  });

  it('should render breadcrumb with earTag', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    const breadcrumb = screen.getByLabelText('Breadcrumb');
    expect(breadcrumb).toBeTruthy();
    expect(screen.getByText('Animais')).toBeTruthy();
  });

  it('should render tabs with "Dados Gerais" active', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    const generalTab = screen.getByRole('tab', { name: /Dados Gerais/ });
    expect(generalTab).toBeTruthy();
    expect(generalTab.getAttribute('aria-selected')).toBe('true');
  });

  it('should render disabled tabs with "Em breve" hint', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    const reproductiveTab = screen.getByRole('tab', { name: /Reprodutivo/ });
    expect(reproductiveTab).toBeTruthy();
    expect(reproductiveTab.hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByText('(Em breve)').length).toBe(1);
  });

  it('should render identification section', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(screen.getByText('Identificação')).toBeTruthy();
    expect(screen.getByText('RFID-001')).toBeTruthy();
    expect(screen.getByText('Lote Maternidade')).toBeTruthy();
  });

  it('should render characteristics section with suggested category', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(screen.getByText('Características')).toBeTruthy();
    expect(screen.getByText(/sugerida: Vaca Seca/)).toBeTruthy();
    expect(screen.getByText('450 kg')).toBeTruthy();
    expect(screen.getByText('3/5')).toBeTruthy();
  });

  it('should render breed composition table', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(screen.getByText('Composição Racial')).toBeTruthy();
    expect(screen.getByText('Holandesa 50% + Gir Leiteiro 50%')).toBeTruthy();
    expect(screen.getByText('Holandesa')).toBeTruthy();
    expect(screen.getByText('Gir Leiteiro')).toBeTruthy();
  });

  it('should render genealogy with parent links', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(screen.getByText('Genealogia')).toBeTruthy();
    expect(screen.getByText('BR-100')).toBeTruthy();
    expect(screen.getByText(/Trovão/)).toBeTruthy();
    expect(screen.getByText('BR-200')).toBeTruthy();
    expect(screen.getByText(/Estrela/)).toBeTruthy();
  });

  it('should render offspring list', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(screen.getByText('BR-301')).toBeTruthy();
    expect(screen.getByText(/Flor/)).toBeTruthy();
    expect(screen.getByText('BR-302')).toBeTruthy();
  });

  it('should render genealogical records table', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(screen.getByText('Registros Genealógicos')).toBeTruthy();
    expect(screen.getByText('Puro de Origem')).toBeTruthy();
    expect(screen.getByText('REG-123')).toBeTruthy();
    expect(screen.getByText('ABCZ')).toBeTruthy();
  });

  it('should render notes section', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(screen.getByText('Observações')).toBeTruthy();
    expect(screen.getByText('Animal dócil, boa produtora.')).toBeTruthy();
  });

  it('should show error state with retry button', async () => {
    const refetch = vi.fn();
    mockUseAnimalDetail.mockReturnValue({
      animal: null,
      isLoading: false,
      error: 'Erro ao carregar animal',
      refetch,
    });

    renderPage();

    expect(screen.getByText('Erro ao carregar animal')).toBeTruthy();
    const retryBtn = screen.getByText('Tentar novamente');
    await userEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it('should show not found state when animal is null without error', () => {
    mockUseAnimalDetail.mockReturnValue({
      animal: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Animal não encontrado')).toBeTruthy();
    expect(screen.getByText('Voltar para animais')).toBeTruthy();
  });

  it('should show placeholder when clicking disabled tab', async () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    // Disabled tabs can't be clicked, so placeholder should not show
    const reproductiveTab = screen.getByRole('tab', { name: /Reprodutivo/ });
    expect(reproductiveTab.hasAttribute('disabled')).toBe(true);
  });

  it('should show photo placeholder when no photo', () => {
    mockUseAnimalDetail.mockReturnValue(defaultReturn());
    renderPage();

    expect(document.querySelector('.animal-detail__photo-placeholder')).toBeTruthy();
  });

  it('should show photo when photoUrl is provided', () => {
    mockUseAnimalDetail.mockReturnValue({
      ...defaultReturn(),
      animal: { ...MOCK_ANIMAL, photoUrl: 'https://example.com/photo.jpg' },
    });
    renderPage();

    const img = document.querySelector('.animal-detail__photo') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.com/photo.jpg');
  });

  it('should show empty genealogy message when no parents/offspring', () => {
    mockUseAnimalDetail.mockReturnValue({
      ...defaultReturn(),
      animal: { ...MOCK_ANIMAL, sire: null, dam: null, offspring: [] },
    });
    renderPage();

    expect(screen.getByText('Sem informações de genealogia')).toBeTruthy();
  });

  it('should show empty notes message when no notes', () => {
    mockUseAnimalDetail.mockReturnValue({
      ...defaultReturn(),
      animal: { ...MOCK_ANIMAL, notes: null },
    });
    renderPage();

    expect(screen.getByText('Sem observações')).toBeTruthy();
  });

  it('should show empty records message when no genealogical records', () => {
    mockUseAnimalDetail.mockReturnValue({
      ...defaultReturn(),
      animal: { ...MOCK_ANIMAL, genealogicalRecords: [] },
    });
    renderPage();

    expect(screen.getByText('Nenhum registro genealógico')).toBeTruthy();
  });

  it('should show estimated composition flag', () => {
    mockUseAnimalDetail.mockReturnValue({
      ...defaultReturn(),
      animal: { ...MOCK_ANIMAL, isCompositionEstimated: true },
    });
    renderPage();

    expect(screen.getByText('Composição estimada')).toBeTruthy();
  });

  it('should show birth date estimated hint', () => {
    mockUseAnimalDetail.mockReturnValue({
      ...defaultReturn(),
      animal: { ...MOCK_ANIMAL, birthDateEstimated: true },
    });
    renderPage();

    expect(screen.getByText('(estimada)')).toBeTruthy();
  });
});
