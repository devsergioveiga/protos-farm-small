import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ConfirmBoundaryEdit from './ConfirmBoundaryEdit';

describe('ConfirmBoundaryEdit', () => {
  it('should show previous and new area with difference', () => {
    render(
      <ConfirmBoundaryEdit
        previousAreaHa={50}
        newAreaHa={55}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Confirmar alteração de perímetro')).toBeDefined();
    expect(screen.getByText('Área anterior')).toBeDefined();
    expect(screen.getByText('Área nova')).toBeDefined();
    expect(screen.getByText('Diferença')).toBeDefined();
    expect(screen.getByText(/50\s*ha/)).toBeDefined();
    expect(screen.getByText(/55\s*ha/)).toBeDefined();
  });

  it('should show warning when difference > 10%', () => {
    render(
      <ConfirmBoundaryEdit
        previousAreaHa={50}
        newAreaHa={60}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/Variação superior a 10%/)).toBeDefined();
  });

  it('should not show warning when difference <= 10%', () => {
    render(
      <ConfirmBoundaryEdit
        previousAreaHa={50}
        newAreaHa={52}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmBoundaryEdit
        previousAreaHa={50}
        newAreaHa={55}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Confirmar alteração'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmBoundaryEdit
        previousAreaHa={50}
        newAreaHa={55}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
