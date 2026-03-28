import { useState, useEffect, useCallback } from 'react';
import { Syringe, Plus, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { api } from '@/services/api';
import type { InseminationItem } from '@/types/iatf-execution';
import BulkInseminationModal from '@/components/inseminations/BulkInseminationModal';
import './InseminationsPage.css';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function InseminationsPage() {
  const { selectedFarm } = useFarmContext();
  const [inseminations, setInseminations] = useState<InseminationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const limit = 20;

  const fetchData = useCallback(async () => {
    if (!selectedFarm) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (typeFilter) params.set('inseminationType', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get<{
        data: InseminationItem[];
        meta: { total: number };
      }>(`/org/farms/${selectedFarm.id}/inseminations?${params.toString()}`);

      let filtered = res.data;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(
          (i) =>
            i.animalEarTag.toLowerCase().includes(q) ||
            (i.animalName && i.animalName.toLowerCase().includes(q)) ||
            (i.bullName && i.bullName.toLowerCase().includes(q)) ||
            i.inseminatorName.toLowerCase().includes(q),
        );
      }

      setInseminations(filtered);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar inseminações');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarm, page, typeFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  const totalPages = Math.ceil(total / limit);

  if (!selectedFarm) {
    return (
      <main className="inseminations-page">
        <div className="inseminations-page__empty">
          <Syringe size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="inseminations-page__empty-title">Selecione uma fazenda</h2>
          <p className="inseminations-page__empty-desc">
            Escolha uma fazenda no seletor acima para gerenciar inseminações.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="inseminations-page">
      {toast && (
        <div
          className={`inseminations-page__toast inseminations-page__toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      <header className="inseminations-page__header">
        <div>
          <h1 className="inseminations-page__title">Inseminações</h1>
          <p className="inseminations-page__subtitle">
            Registre inseminações sem necessidade de protocolo IATF
          </p>
        </div>
        <button
          type="button"
          className="inseminations-page__btn-primary"
          onClick={() => setShowModal(true)}
        >
          <Plus size={20} aria-hidden="true" />
          Nova inseminação
        </button>
      </header>

      <section className="inseminations-page__filters">
        <div className="inseminations-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por brinco, nome, touro ou inseminador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar inseminações"
          />
        </div>
        <div className="inseminations-page__filter-group">
          <Filter size={16} aria-hidden="true" className="inseminations-page__filter-icon" />
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por tipo"
          >
            <option value="">Todos os tipos</option>
            <option value="IATF">IATF</option>
            <option value="NATURAL_HEAT">Cio natural</option>
            <option value="HEAT_DURING_PROTOCOL">Cio durante protocolo</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label="Data inicial"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label="Data final"
          />
        </div>
      </section>

      {isLoading ? (
        <div className="inseminations-page__skeleton">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="inseminations-page__skeleton-row" />
          ))}
        </div>
      ) : error ? (
        <div className="inseminations-page__error" role="alert">
          {error}
          <button type="button" onClick={() => void fetchData()}>
            Tentar novamente
          </button>
        </div>
      ) : inseminations.length === 0 ? (
        <div className="inseminations-page__empty">
          <Syringe size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="inseminations-page__empty-title">Nenhuma inseminação registrada</h2>
          <p className="inseminations-page__empty-desc">
            Registre a primeira inseminação para começar o acompanhamento reprodutivo.
          </p>
          <button
            type="button"
            className="inseminations-page__btn-primary"
            onClick={() => setShowModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Nova inseminação
          </button>
        </div>
      ) : (
        <>
          <div className="inseminations-page__table-wrapper">
            <table className="inseminations-page__table">
              <thead>
                <tr>
                  <th scope="col">Brinco</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Data</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Touro</th>
                  <th scope="col">Inseminador</th>
                  <th scope="col">Doses</th>
                </tr>
              </thead>
              <tbody>
                {inseminations.map((ins) => (
                  <tr key={ins.id}>
                    <td className="inseminations-page__cell-tag">{ins.animalEarTag}</td>
                    <td>{ins.animalName || '—'}</td>
                    <td>{formatDate(ins.inseminationDate)}</td>
                    <td>
                      <span
                        className={`inseminations-page__badge inseminations-page__badge--${ins.inseminationType.toLowerCase()}`}
                      >
                        {ins.inseminationTypeLabel}
                      </span>
                    </td>
                    <td>{ins.bullName || '—'}</td>
                    <td>{ins.inseminatorName}</td>
                    <td className="inseminations-page__cell-center">{ins.dosesUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="inseminations-page__cards">
            {inseminations.map((ins) => (
              <div key={ins.id} className="inseminations-page__card">
                <div className="inseminations-page__card-header">
                  <span className="inseminations-page__card-tag">{ins.animalEarTag}</span>
                  <span
                    className={`inseminations-page__badge inseminations-page__badge--${ins.inseminationType.toLowerCase()}`}
                  >
                    {ins.inseminationTypeLabel}
                  </span>
                </div>
                {ins.animalName && (
                  <p className="inseminations-page__card-name">{ins.animalName}</p>
                )}
                <div className="inseminations-page__card-details">
                  <span>{formatDate(ins.inseminationDate)}</span>
                  <span>{ins.bullName || 'Sem touro'}</span>
                  <span>{ins.inseminatorName}</span>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="inseminations-page__pagination" aria-label="Paginação">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span>
                Página {page} de {totalPages} ({total} registros)
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Próxima página"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      <BulkInseminationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        farmId={selectedFarm.id}
        onSuccess={(count) => {
          setShowModal(false);
          void fetchData();
          showToast(
            'success',
            count === 1
              ? 'Inseminação registrada com sucesso'
              : `${count} inseminações registradas com sucesso`,
          );
        }}
      />
    </main>
  );
}

export default InseminationsPage;
