import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={PLOT} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Talhão Norte')).toBeDefined();
    expect(screen.getByText('Soja')).toBeDefined();
    expect(screen.getByText('Latossolo vermelho')).toBeDefined();
    expect(screen.getByText(/45,5/)).toBeDefined();
  });

  it('should show all optional fields when present', () => {
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={PLOT} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('TN-01')).toBeDefined();
    expect(screen.getByText('Milho')).toBeDefined();
    expect(screen.getByText('Próximo ao rio')).toBeDefined();
    expect(screen.getByText('15/02/2026')).toBeDefined();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={PLOT} onClose={onClose} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Fechar detalhes do talhão'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should not render when plot is null', () => {
    const { container } = render(
      <MemoryRouter>
        <PlotDetailsPanel plot={null} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('should handle minimal plot without optional fields', () => {
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={MINIMAL_PLOT} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Talhão Sul')).toBeDefined();
    expect(screen.getByText('Não definida')).toBeDefined();
    expect(screen.queryByText('Código')).toBeNull();
    expect(screen.queryByText('Cultura anterior')).toBeNull();
    expect(screen.queryByText('Tipo de solo')).toBeNull();
    expect(screen.queryByText('Observações')).toBeNull();
  });

  it('should show edit geometry button when onEditGeometry is provided', () => {
    const onEditGeometry = vi.fn();
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={PLOT} onClose={vi.fn()} onEditGeometry={onEditGeometry} />
      </MemoryRouter>,
    );

    const editBtn = screen.getByLabelText('Editar perímetro');
    expect(editBtn).toBeDefined();
    fireEvent.click(editBtn);
    expect(onEditGeometry).toHaveBeenCalledWith(PLOT);
  });

  it('should not show edit geometry button when onEditGeometry is not provided', () => {
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={PLOT} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText('Editar perímetro')).toBeNull();
  });

  it('should show subdivide button when onSubdivide is provided', () => {
    const onSubdivide = vi.fn();
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={PLOT} onClose={vi.fn()} onSubdivide={onSubdivide} />
      </MemoryRouter>,
    );

    const subdivideBtn = screen.getByLabelText('Subdividir talhão');
    expect(subdivideBtn).toBeDefined();
    fireEvent.click(subdivideBtn);
    expect(onSubdivide).toHaveBeenCalledWith(PLOT);
  });

  it('should not show subdivide button when onSubdivide is not provided', () => {
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={PLOT} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText('Subdividir talhão')).toBeNull();
  });

  it('should show delete button when onDelete is provided', () => {
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={PLOT} onClose={vi.fn()} onDelete={onDelete} />
      </MemoryRouter>,
    );

    const deleteBtn = screen.getByLabelText('Excluir talhão');
    expect(deleteBtn).toBeDefined();
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(PLOT);
  });

  it('should not show delete button when onDelete is not provided', () => {
    render(
      <MemoryRouter>
        <PlotDetailsPanel plot={PLOT} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText('Excluir talhão')).toBeNull();
  });
});
