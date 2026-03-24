import { useState, useRef, useEffect } from 'react';
import { Calendar, Plus, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWorkSchedules } from '@/hooks/useWorkSchedules';
import { useAuth } from '@/stores/AuthContext';
import { api } from '@/services/api';
import CreateWorkScheduleModal from '@/components/work-schedules/CreateWorkScheduleModal';
import { WORK_SCHEDULE_TYPE_LABELS, DAY_LABELS } from '@/types/work-schedule';
import './WorkSchedulesPage.css';

const LIMIT = 20;

function WorkSchedulesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSeedingTemplates, setIsSeedingTemplates] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const { workSchedules, total, isLoading, error, refetch } = useWorkSchedules({
    search: search || undefined,
    page,
    limit: LIMIT,
  });

  const totalPages = Math.ceil(total / LIMIT);

  const handleSeedTemplates = async () => {
    const orgId = user?.organizationId;
    if (!orgId) return;
    setIsSeedingTemplates(true);
    try {
      await api.post(`/org/${orgId}/work-schedules/seed-templates`, {});
      void refetch();
    } catch {
      // silently handle — user gets feedback from refetch
    } finally {
      setIsSeedingTemplates(false);
    }
  };

  const handleSuccess = () => {
    void refetch();
  };

  const formatTime = (time: string) => {
    // Display HH:mm as is
    return time.substring(0, 5);
  };

  return (
    <main className="work-schedules" id="main-content">
      {/* Header */}
      <div className="work-schedules__header">
        <div>
          <h1 className="work-schedules__title">Escalas de Trabalho</h1>
          {total > 0 && (
            <p className="work-schedules__subtitle">
              {total} escala{total !== 1 ? 's' : ''} cadastrada{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="work-schedules__header-actions">
          <button
            type="button"
            className="work-schedules__btn work-schedules__btn--secondary"
            onClick={() => void handleSeedTemplates()}
            disabled={isSeedingTemplates}
            aria-label="Gerar escalas template para uso rural"
          >
            {isSeedingTemplates ? 'Gerando...' : 'Gerar Templates'}
          </button>
          <button
            type="button"
            className="work-schedules__btn work-schedules__btn--primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Cadastrar escala
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="work-schedules__toolbar">
        <input
          type="search"
          className="work-schedules__search"
          placeholder="Buscar por nome..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Buscar escalas de trabalho"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="work-schedules__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="work-schedules__table-wrapper">
          <table className="work-schedules__table" aria-label="Carregando escalas...">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Tipo</th>
                <th scope="col">Dias</th>
                <th scope="col">Horário</th>
                <th scope="col">Intervalo</th>
                <th scope="col">Template</th>
                <th scope="col">Em uso</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="work-schedules__skeleton-row">
                  <td><div className="work-schedules__skeleton work-schedules__skeleton--name" /></td>
                  <td><div className="work-schedules__skeleton work-schedules__skeleton--text" /></td>
                  <td><div className="work-schedules__skeleton work-schedules__skeleton--text" /></td>
                  <td><div className="work-schedules__skeleton work-schedules__skeleton--text" /></td>
                  <td><div className="work-schedules__skeleton work-schedules__skeleton--text" /></td>
                  <td><div className="work-schedules__skeleton work-schedules__skeleton--badge" /></td>
                  <td><div className="work-schedules__skeleton work-schedules__skeleton--text" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && workSchedules.length === 0 && (
        <div className="work-schedules__empty">
          <Calendar size={48} className="work-schedules__empty-icon" aria-hidden="true" />
          <h2 className="work-schedules__empty-title">Nenhuma escala cadastrada</h2>
          <p className="work-schedules__empty-body">
            Configure as escalas de trabalho para vincular aos contratos.
          </p>
          <div className="work-schedules__empty-actions">
            <button
              type="button"
              className="work-schedules__btn work-schedules__btn--primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Cadastrar escala
            </button>
            <button
              type="button"
              className="work-schedules__btn work-schedules__btn--secondary"
              onClick={() => void handleSeedTemplates()}
              disabled={isSeedingTemplates}
            >
              {isSeedingTemplates ? 'Gerando...' : 'Gerar Templates'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && workSchedules.length > 0 && (
        <>
          <div className="work-schedules__table-wrapper">
            <table className="work-schedules__table" aria-label="Lista de escalas de trabalho">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Dias</th>
                  <th scope="col">Horário</th>
                  <th scope="col">Intervalo</th>
                  <th scope="col">Template</th>
                  <th scope="col">Em uso</th>
                </tr>
              </thead>
              <tbody>
                {workSchedules.map((ws) => (
                  <tr key={ws.id} className="work-schedules__row">
                    <td className="work-schedules__cell-name">{ws.name}</td>
                    <td>{WORK_SCHEDULE_TYPE_LABELS[ws.type]}</td>
                    <td>
                      <div className="work-schedules__days">
                        {ws.workDays.map((d) => (
                          <span key={d} className="work-schedules__day-chip">
                            {DAY_LABELS[d]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="work-schedules__cell-time">
                      {formatTime(ws.startTime)} – {formatTime(ws.endTime)}
                    </td>
                    <td>{ws.breakMinutes} min</td>
                    <td>
                      {ws.isTemplate && (
                        <span className="work-schedules__template-badge">Template</span>
                      )}
                    </td>
                    <td>{ws._count?.contracts ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="work-schedules__pagination" role="navigation" aria-label="Paginação">
              <button
                type="button"
                className="work-schedules__page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="work-schedules__page-info" aria-live="polite">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="work-schedules__page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Próxima página"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}

      <CreateWorkScheduleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleSuccess}
      />
    </main>
  );
}

export default WorkSchedulesPage;
