import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import RegistrationsPanel from './RegistrationsPanel';
import type { FarmRegistration, AreaDivergence } from '@/types/farm';

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const REG1: FarmRegistration = {
  id: 'reg-1',
  farmId: 'farm-1',
  number: '12345',
  cnsCode: 'CNS-001',
  cartorioName: '1º Ofício de Uberlândia',
  comarca: 'Uberlândia',
  state: 'MG',
  livro: 'L-10',
  registrationDate: '2025-06-15T00:00:00Z',
  areaHa: 75.5,
  boundaryAreaHa: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const REG2: FarmRegistration = {
  id: 'reg-2',
  farmId: 'farm-1',
  number: '67890',
  cnsCode: null,
  cartorioName: '2º Ofício de Uberlândia',
  comarca: 'Uberlândia',
  state: 'MG',
  livro: null,
  registrationDate: null,
  areaHa: 50,
  boundaryAreaHa: null,
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const defaultProps = {
  registrations: [REG1, REG2],
  farmTotalAreaHa: 150,
  areaDivergence: null as AreaDivergence | null,
  isLoading: false,
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
};

describe('RegistrationsPanel', () => {
  it('should render the panel title', () => {
    render(<RegistrationsPanel {...defaultProps} />);
    expect(screen.getByText('Matrículas')).toBeDefined();
  });

  it('should render registration cards with details', () => {
    render(<RegistrationsPanel {...defaultProps} registrations={[REG1]} />);

    expect(screen.getByText('Matrícula 12345')).toBeDefined();
    expect(screen.getByText('1º Ofício de Uberlândia')).toBeDefined();
    expect(screen.getByText('Uberlândia')).toBeDefined();
    expect(screen.getByText(/75,50/)).toBeDefined();
    expect(screen.getByText('CNS-001')).toBeDefined();
    expect(screen.getByText('L-10')).toBeDefined();
    // Date depends on timezone — just verify something date-like appears
    expect(screen.getByText(/\/06\/2025/)).toBeDefined();
  });

  it('should hide optional fields when null', () => {
    render(<RegistrationsPanel {...defaultProps} registrations={[REG2]} />);

    expect(screen.queryByText('CNS')).toBeNull();
    expect(screen.queryByText('Livro')).toBeNull();
    expect(screen.queryByText('Data registro')).toBeNull();
  });

  it('should show empty state when no registrations', () => {
    render(<RegistrationsPanel {...defaultProps} registrations={[]} />);

    expect(screen.getByText('Nenhuma matrícula cadastrada')).toBeDefined();
    expect(screen.getByText('Adicionar matrícula')).toBeDefined();
  });

  it('should call onAdd when empty state CTA is clicked', () => {
    const onAdd = vi.fn();
    render(<RegistrationsPanel {...defaultProps} registrations={[]} onAdd={onAdd} />);

    fireEvent.click(screen.getByText('Adicionar matrícula'));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('should call onAdd when add button is clicked', () => {
    const onAdd = vi.fn();
    render(<RegistrationsPanel {...defaultProps} onAdd={onAdd} />);

    fireEvent.click(screen.getByLabelText('Adicionar matrícula'));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<RegistrationsPanel {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Fechar painel de matrículas'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<RegistrationsPanel {...defaultProps} onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText('Editar matrícula 12345'));
    expect(onEdit).toHaveBeenCalledWith(REG1);
  });

  it('should show confirm dialog when delete is clicked and call onDelete on confirm', () => {
    const onDelete = vi.fn();
    render(<RegistrationsPanel {...defaultProps} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText('Excluir matrícula 12345'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getByText('Excluir matrícula?')).toBeDefined();

    const deleteBtn = dialog.querySelector('.reg-panel__confirm-btn--delete') as HTMLElement;
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(REG1);
  });

  it('should dismiss confirm dialog on cancel', () => {
    render(<RegistrationsPanel {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Excluir matrícula 12345'));
    expect(screen.getByText('Excluir matrícula?')).toBeDefined();

    const dialog = screen.getByRole('dialog');
    const cancelBtn = dialog.querySelector('.reg-panel__confirm-btn--cancel') as HTMLElement;
    fireEvent.click(cancelBtn);
    expect(screen.queryByText('Excluir matrícula?')).toBeNull();
  });

  it('should show divergence alert when divergent is true', () => {
    const divergence: AreaDivergence = { divergent: true, percentage: 12.5 };
    render(<RegistrationsPanel {...defaultProps} areaDivergence={divergence} />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/12,5/)).toBeDefined();
  });

  it('should not show divergence alert when divergent is false', () => {
    const divergence: AreaDivergence = { divergent: false, percentage: 2 };
    render(<RegistrationsPanel {...defaultProps} areaDivergence={divergence} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should show skeleton when loading', () => {
    render(<RegistrationsPanel {...defaultProps} isLoading={true} />);

    expect(screen.getByLabelText('Carregando matrículas')).toBeDefined();
  });
});
