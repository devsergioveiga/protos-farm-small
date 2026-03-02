import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import LayerControlPanel, { type LayerConfig } from './LayerControlPanel';

const LAYERS: LayerConfig[] = [
  { id: 'perimeter', label: 'Perímetro', enabled: true },
  { id: 'registrations', label: 'Matrículas', enabled: true },
  { id: 'plots', label: 'Talhões', enabled: true },
  { id: 'pastures', label: 'Pastos', enabled: false, disabled: true, futureLabel: 'Em breve' },
];

describe('LayerControlPanel', () => {
  it('should render all layer labels', () => {
    render(<LayerControlPanel layers={LAYERS} onToggle={vi.fn()} />);

    expect(screen.getByText('Perímetro')).toBeDefined();
    expect(screen.getByText('Matrículas')).toBeDefined();
    expect(screen.getByText('Talhões')).toBeDefined();
  });

  it('should show disabled layers with future badge', () => {
    render(<LayerControlPanel layers={LAYERS} onToggle={vi.fn()} />);

    expect(screen.getByText('Em breve')).toBeDefined();

    const pasturesToggle = screen.getByLabelText('Camada Pastos');
    expect(pasturesToggle.hasAttribute('disabled')).toBe(true);

    // Talhões is now enabled, not disabled
    const plotsToggle = screen.getByLabelText('Camada Talhões');
    expect(plotsToggle.hasAttribute('disabled')).toBe(false);
  });

  it('should call onToggle when enabled layer is clicked', () => {
    const onToggle = vi.fn();
    render(<LayerControlPanel layers={LAYERS} onToggle={onToggle} />);

    const perimeterToggle = screen.getByLabelText('Camada Perímetro');
    fireEvent.click(perimeterToggle);

    expect(onToggle).toHaveBeenCalledWith('perimeter');
  });
});
