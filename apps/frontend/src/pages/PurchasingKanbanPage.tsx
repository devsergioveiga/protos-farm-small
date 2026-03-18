import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingCart, X } from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import {
  usePurchasingKanban,
  type KanbanFilters as KanbanFiltersState,
} from '@/hooks/usePurchasingKanban';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import KanbanFilters from '@/components/kanban/KanbanFilters';
import './PurchasingKanbanPage.css';

const FILTER_PRESET_LABELS: Record<string, string> = {
  overdue_po: 'Pedidos atrasados em trânsito e aguardando entrega',
  pending_approval: 'Requisições pendentes de aprovação',
};

const SKELETON_COLUMNS = 7;
const SKELETON_CARDS_PER_COL = [2, 3, 1, 2, 1, 0, 1];

export default function PurchasingKanbanPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPreset = searchParams.get('filter');

  const [filters, setFilters] = useState<KanbanFiltersState>({});

  const orgId = user?.organizationId ?? '';
  const { columns, loading, error, refetch, moveCard } = usePurchasingKanban(orgId, filters);

  const handleFiltersChange = useCallback((newFilters: KanbanFiltersState) => {
    setFilters(newFilters);
  }, []);

  const handleDismissPreset = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('filter');
      return next;
    });
  }, [setSearchParams]);

  const handleCardMove = useCallback(
    async (
      cardId: string,
      from: Parameters<typeof moveCard>[1],
      to: Parameters<typeof moveCard>[2],
    ) => {
      await moveCard(cardId, from, to);
    },
    [moveCard],
  );

  const allEmpty = !loading && !error && columns.every((col) => col.cards.length === 0);

  return (
    <main className="purchasing-kanban" id="main-content">
      <header className="purchasing-kanban__header">
        <h1>Kanban de Compras</h1>
      </header>

      {filterPreset && FILTER_PRESET_LABELS[filterPreset] && (
        <div className="purchasing-kanban__preset-banner" role="status" aria-live="polite">
          <p>Mostrando: {FILTER_PRESET_LABELS[filterPreset]}</p>
          <button
            type="button"
            className="purchasing-kanban__preset-dismiss"
            onClick={handleDismissPreset}
            aria-label="Fechar filtro pré-definido"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <KanbanFilters filters={filters} onChange={handleFiltersChange} />

      {loading && (
        <div
          className="purchasing-kanban__board purchasing-kanban__skeleton"
          aria-busy="true"
          aria-label="Carregando kanban de compras"
        >
          {Array.from({ length: SKELETON_COLUMNS }).map((_, i) => (
            <div key={i} className="purchasing-kanban__skeleton-col">
              <div className="purchasing-kanban__skeleton-header" />
              {Array.from({ length: SKELETON_CARDS_PER_COL[i] ?? 1 }).map((_, j) => (
                <div key={j} className="purchasing-kanban__skeleton-card" />
              ))}
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="purchasing-kanban__error" role="alert">
          <p>{error}</p>
          <button type="button" className="purchasing-kanban__retry" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && allEmpty && (
        <div className="purchasing-kanban__empty">
          <ShoppingCart size={64} className="purchasing-kanban__empty-icon" aria-hidden="true" />
          <h2>Nenhuma compra em andamento</h2>
          <p>As requisições e pedidos aparecerão aqui conforme forem criados.</p>
        </div>
      )}

      {!loading && !error && !allEmpty && (
        <div className="purchasing-kanban__board">
          <KanbanBoard columns={columns} onCardMove={handleCardMove} />
        </div>
      )}
    </main>
  );
}
