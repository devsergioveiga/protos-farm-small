import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import PlotDetailsPanel from './PlotDetailsPanel';
import type { FieldPlot } from '@/types/farm';

const PLOT: FieldPlot = {
  id: 'plot-1',
  farmId: 'farm-1',
  registrationId: null,
  name: 'Talhão Norte',
  code: 'TN-01',
  soilType: 'LATOSSOLO_VERMELHO',
  currentCrop: 'Soja',
  previousCrop: 'Milho',
  notes: 'Próximo ao rio',
  boundaryAreaHa: 45.5,
  status: 'ACTIVE',
  createdAt: '2026-02-15T10:00:00Z',
};

const MINIMAL_PLOT: FieldPlot = {
  id: 'plot-2',
  farmId: 'farm-1',
  registrationId: null,
  name: 'Talhão Sul',
  code: null,
  soilType: null,
  currentCrop: null,
  previousCrop: null,
  notes: null,
  boundaryAreaHa: 20,
  status: 'ACTIVE',
  createdAt: '2026-01-10T00:00:00Z',
};

describe('PlotDetailsPanel', () => {
  it('should render plot details (name, area, crop, soil)', () => {
    render(<PlotDetailsPanel plot={PLOT} onClose={vi.fn()} />);

    expect(screen.getByText('Talhão Norte')).toBeDefined();
    expect(screen.getByText('Soja')).toBeDefined();
    expect(screen.getByText('Latossolo vermelho')).toBeDefined();
    expect(screen.getByText(/45,5/)).toBeDefined();
  });

  it('should show all optional fields when present', () => {
    render(<PlotDetailsPanel plot={PLOT} onClose={vi.fn()} />);

    expect(screen.getByText('TN-01')).toBeDefined();
    expect(screen.getByText('Milho')).toBeDefined();
    expect(screen.getByText('Próximo ao rio')).toBeDefined();
    expect(screen.getByText('15/02/2026')).toBeDefined();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PlotDetailsPanel plot={PLOT} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Fechar detalhes do talhão'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should not render when plot is null', () => {
    const { container } = render(<PlotDetailsPanel plot={null} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('should handle minimal plot without optional fields', () => {
    render(<PlotDetailsPanel plot={MINIMAL_PLOT} onClose={vi.fn()} />);

    expect(screen.getByText('Talhão Sul')).toBeDefined();
    expect(screen.getByText('Não definida')).toBeDefined();
    expect(screen.queryByText('Código')).toBeNull();
    expect(screen.queryByText('Cultura anterior')).toBeNull();
    expect(screen.queryByText('Tipo de solo')).toBeNull();
    expect(screen.queryByText('Observações')).toBeNull();
  });

  it('should show edit geometry button when onEditGeometry is provided', () => {
    const onEditGeometry = vi.fn();
    render(<PlotDetailsPanel plot={PLOT} onClose={vi.fn()} onEditGeometry={onEditGeometry} />);

    const editBtn = screen.getByLabelText('Editar perímetro');
    expect(editBtn).toBeDefined();
    fireEvent.click(editBtn);
    expect(onEditGeometry).toHaveBeenCalledWith(PLOT);
  });

  it('should not show edit geometry button when onEditGeometry is not provided', () => {
    render(<PlotDetailsPanel plot={PLOT} onClose={vi.fn()} />);

    expect(screen.queryByLabelText('Editar perímetro')).toBeNull();
  });
});
