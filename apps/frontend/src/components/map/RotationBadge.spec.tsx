import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RotationBadge from './RotationBadge';
import type { RotationIndicator } from '@/types/farm';

describe('RotationBadge', () => {
  it('should render "Sem dados" for level 0', () => {
    const rotation: RotationIndicator = {
      level: 0,
      label: 'Sem dados',
      description: 'Nenhuma safra registrada.',
      uniqueCrops: [],
      seasonsAnalyzed: 0,
    };

    render(<RotationBadge rotation={rotation} />);
    expect(screen.getByText('Sem dados')).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('should render "Monocultura" for level 1', () => {
    const rotation: RotationIndicator = {
      level: 1,
      label: 'Monocultura',
      description: 'Apenas Soja nas últimas 3 safras.',
      uniqueCrops: ['Soja'],
      seasonsAnalyzed: 3,
    };

    render(<RotationBadge rotation={rotation} />);
    expect(screen.getByText('Monocultura')).toBeDefined();
  });

  it('should render "Rotação simples" for level 2', () => {
    const rotation: RotationIndicator = {
      level: 2,
      label: 'Rotação simples',
      description: 'Alternância entre Soja e Milho.',
      uniqueCrops: ['Soja', 'Milho'],
      seasonsAnalyzed: 4,
    };

    render(<RotationBadge rotation={rotation} />);
    expect(screen.getByText('Rotação simples')).toBeDefined();
  });

  it('should render "Rotação diversificada" for level 3', () => {
    const rotation: RotationIndicator = {
      level: 3,
      label: 'Rotação diversificada',
      description: '3 culturas diferentes.',
      uniqueCrops: ['Soja', 'Milho', 'Algodão'],
      seasonsAnalyzed: 6,
    };

    render(<RotationBadge rotation={rotation} />);
    expect(screen.getByText('Rotação diversificada')).toBeDefined();
  });

  it('should have accessible aria-label', () => {
    const rotation: RotationIndicator = {
      level: 2,
      label: 'Rotação simples',
      description: 'desc',
      uniqueCrops: ['Soja', 'Milho'],
      seasonsAnalyzed: 4,
    };

    render(<RotationBadge rotation={rotation} />);
    expect(screen.getByLabelText('Rotação: Rotação simples')).toBeDefined();
  });
});
