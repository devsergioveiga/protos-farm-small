import { useState, useRef } from 'react';
import {
  LogOut,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Undo2,
  Search,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useAnimalExits } from '@/hooks/useAnimalExits';
import { api } from '@/services/api';
import PermissionGate from '@/components/auth/PermissionGate';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { AnimalExitType, AnimalExitItem } from '@/types/animal-exit';
import { EXIT_TYPES, EXIT_TYPE_LABELS } from '@/types/animal-exit';
import './AnimalExitsPage.css';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function AnimalExitsPage() {
  const { selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [exitTypeFilter, setExitTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [undoTarget, setUndoTarget] = useState<AnimalExitItem | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const prevFarmIdRef = useRef(selectedFarm?.id);
  if (prevFarmIdRef.current !== selectedFarm?.id) {
    prevFarmIdRef.current = selectedFarm?.id;
    setPage(1);
    setExitTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setSearchInput('');
    setSearch('');
  }

  const { exits, total, isLoading, error, refetch } = useAnimalExits({
    farmId: selectedFarm?.id ?? null,
    page,
    exitType: exitTypeFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: search || undefined,
  });

  const totalPages = Math.ceil(total / 20);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  };

  const handleExport = async () => {
    if (!selectedFarm) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (exitTypeFilter) params.set('exitType', exitTypeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (search) params.set('search', search);

      const blob = await api.getBlob(
        `/org/farms/${selectedFarm.id}/animal-exits/export?${params.toString()}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'saidas-animais.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast('Erro ao exportar CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUndo = async () => {
    if (!undoTarget || !selectedFarm) return;
    setIsUndoing(true);
    try {
      await api.delete(`/org/farms/${selectedFarm.id}/animal-exits/${undoTarget.id}`);
      setToast('Saída desfeita. Animal restaurado ao rebanho ativo.');
      setUndoTarget(null);
      void refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao desfazer saída';
      setToast(message);
    } finally {
      setIsUndoing(false);
    }
  };

  // Auto-dismiss toast
  if (toast) {
    setTimeout(() => setToast(null), 5000);
  }

  if (!selectedFarm) {
    return (
      <main className="animal-exits">
        <div className="animal-exits__empty">
          <LogOut size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="animal-exits__empty-title">Selecione uma fazenda</h2>
          <p className="animal-exits__empty-desc">
            Escolha uma fazenda no seletor acima para visualizar as saídas de animais.
          </p>
        </div>
      </main>
    );
  }

  return (
    <section className="animal-exits" aria-labelledby="animal-exits-title">
      <header className="animal-exits__header">
        <div>
          <h1 className="animal-exits__title" id="animal-exits-title">
            Saídas de Animais
          </h1>
          <p className="animal-exits__subtitle">
            Registros de morte, venda, doação, abate e transferência
          </p>
        </div>
        <div className="animal-exits__header-actions">
          <button
            type="button"
            className="animal-exits__export-btn"
            onClick={() => void handleExport()}
            disabled={isExporting || exits.length === 0}
          >
            <Download aria-hidden="true" size={18} />
            {isExporting ? 'Exportando...' : 'CSV'}
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="animal-exits__toolbar">
        <div className="animal-exits__search">
          <Search aria-hidden="true" size={18} className="animal-exits__search-icon" />
          <input
            type="text"
            className="animal-exits__search-input"
            placeholder="Buscar por brinco ou nome..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Buscar saídas de animais"
          />
        </div>
        <select
          className="animal-exits__filter-select"
          value={exitTypeFilter}
          onChange={(e) => {
            setExitTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por tipo de saída"
        >
          <option value="">Todos os tipos</option>
          {EXIT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EXIT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="animal-exits__filter-date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          aria-label="Data inicial"
        />
        <input
          type="date"
          className="animal-exits__filter-date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          aria-label="Data final"
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="animal-exits__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="animal-exits__skeleton-list" aria-live="polite">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animal-exits__skeleton" style={{ height: 48 }} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="animal-exits__error" role="alert">
          <AlertCircle aria-hidden="true" size={20} />
          {error}
          <button
            type="button"
            className="animal-exits__retry-btn"
            onClick={() => void refetch()}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && exits.length === 0 && (
        <div className="animal-exits__empty">
          <LogOut size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="animal-exits__empty-title">Nenhuma saída registrada</h2>
          <p className="animal-exits__empty-desc">
            As saídas de animais aparecem aqui quando registradas na ficha do animal ou em lote
            na listagem de animais.
          </p>
        </div>
      )}

      {/* Table (desktop) */}
      {!isLoading && !error && exits.length > 0 && (
        <>
          <div className="animal-exits__table-wrap">
            <table className="animal-exits__table">
              <thead>
                <tr>
                  <th scope="col">Brinco</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Data</th>
                  <th scope="col">Comprador / Causa</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {exits.map((item) => (
                  <tr key={item.id}>
                    <td className="animal-exits__ear-tag">{item.animalEarTag}</td>
                    <td>{item.animalName ?? '—'}</td>
                    <td>
                      <span
                        className={`animal-exits__badge animal-exits__badge--${item.exitType.toLowerCase()}`}
                      >
                        {item.exitTypeLabel}
                      </span>
                    </td>
                    <td>{formatDate(item.exitDate)}</td>
                    <td>
                      {item.exitType === 'MORTE'
                        ? `${item.deathTypeLabel ?? ''} — ${item.deathCause ?? ''}`
                        : item.buyerName ?? '—'}
                    </td>
                    <td>{formatCurrency(item.salePriceTotal)}</td>
                    <td>
                      <PermissionGate permission="animals:delete">
                        <button
                          type="button"
                          className="animal-exits__undo-btn"
                          onClick={() => setUndoTarget(item)}
                          aria-label={`Desfazer saída de ${item.animalEarTag}`}
                        >
                          <Undo2 aria-hidden="true" size={16} />
                          Desfazer
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards (mobile) */}
          <div className="animal-exits__cards">
            {exits.map((item) => (
              <div key={item.id} className="animal-exits__card">
                <div className="animal-exits__card-header">
                  <span className="animal-exits__ear-tag">{item.animalEarTag}</span>
                  <span
                    className={`animal-exits__badge animal-exits__badge--${item.exitType.toLowerCase()}`}
                  >
                    {item.exitTypeLabel}
                  </span>
                </div>
                {item.animalName && (
                  <div className="animal-exits__card-row">
                    <span className="animal-exits__card-label">Nome</span>
                    <span className="animal-exits__card-value">{item.animalName}</span>
                  </div>
                )}
                <div className="animal-exits__card-row">
                  <span className="animal-exits__card-label">Data</span>
                  <span className="animal-exits__card-value">{formatDate(item.exitDate)}</span>
                </div>
                {item.exitType === 'MORTE' && (
                  <div className="animal-exits__card-row">
                    <span className="animal-exits__card-label">Causa</span>
                    <span className="animal-exits__card-value">
                      {item.deathTypeLabel} — {item.deathCause}
                    </span>
                  </div>
                )}
                {item.buyerName && (
                  <div className="animal-exits__card-row">
                    <span className="animal-exits__card-label">Comprador</span>
                    <span className="animal-exits__card-value">{item.buyerName}</span>
                  </div>
                )}
                {item.salePriceTotal != null && (
                  <div className="animal-exits__card-row">
                    <span className="animal-exits__card-label">Valor</span>
                    <span className="animal-exits__card-value">
                      {formatCurrency(item.salePriceTotal)}
                    </span>
                  </div>
                )}
                <PermissionGate permission="animals:delete">
                  <button
                    type="button"
                    className="animal-exits__undo-btn"
                    onClick={() => setUndoTarget(item)}
                    aria-label={`Desfazer saída de ${item.animalEarTag}`}
                  >
                    <Undo2 aria-hidden="true" size={16} />
                    Desfazer
                  </button>
                </PermissionGate>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="animal-exits__pagination" aria-label="Paginação de saídas">
              <button
                type="button"
                className="animal-exits__pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="animal-exits__pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </nav>
          )}
        </>
      )}

      {/* Undo confirmation */}
      {undoTarget && (
        <ConfirmModal
          isOpen={!!undoTarget}
          title="Desfazer saída"
          message={`Deseja desfazer a saída de "${undoTarget.animalEarTag}"? O animal será restaurado ao rebanho ativo.`}
          confirmLabel={isUndoing ? 'Desfazendo...' : 'Desfazer saída'}
          variant="warning"
          onConfirm={() => void handleUndo()}
          onCancel={() => setUndoTarget(null)}
        />
      )}
    </section>
  );
}

export default AnimalExitsPage;
