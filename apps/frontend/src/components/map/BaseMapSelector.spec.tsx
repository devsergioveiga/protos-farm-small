import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import BaseMapSelector from './BaseMapSelector';

describe('BaseMapSelector', () => {
  it('should render all three basemap buttons', () => {
    render(<BaseMapSelector selected="topographic" onChange={vi.fn()} />);

    expect(screen.getByText('Topo')).toBeDefined();
    expect(screen.getByText('Satélite')).toBeDefined();
    expect(screen.getByText('Híbrido')).toBeDefined();
  });

  it('should mark selected button with aria-pressed', () => {
    render(<BaseMapSelector selected="satellite" onChange={vi.fn()} />);

    const satBtn = screen.getByText('Satélite').closest('button');
    const topoBtn = screen.getByText('Topo').closest('button');

    expect(satBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(topoBtn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('should call onChange with correct type on click', () => {
    const onChange = vi.fn();
    render(<BaseMapSelector selected="topographic" onChange={onChange} />);

    fireEvent.click(screen.getByText('Híbrido'));
    expect(onChange).toHaveBeenCalledWith('hybrid');
  });
});
