import { useState, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Clock,
  UsersRound,
  MapPin,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useTeamOperations } from '@/hooks/useTeamOperations';
import PermissionGate from '@/components/auth/PermissionGate';
import TeamOperationModal from '@/components/team-operations/TeamOperationModal';
import { TEAM_OPERATION_TYPES } from '@/types/team-operation';
import type { TeamOperationItem } from '@/types/team-operation';
import './TeamOperationsPage.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function TeamOperationsPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOp, setSelectedOp] = useState<TeamOperationItem | null>(null);

  const { operations, meta, isLoading, error, refetch } = useTeamOperations({
    farmId: selectedFarmId,
    page,
    operationType: typeFilter || undefined,
  });

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedOp(null);
    void refetch();
  }, [refetch]);

  const handleCardClick = useCallback((op: TeamOperationItem) => {
    setSelectedOp(op);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, op: TeamOperationItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(op);
      }
    },
    [handleCardClick],
  );

  if (!selectedFarmId) {
    return (
      <section className="team-ops">
        <div className="team-ops__empty">
          <ClipboardList size={64} aria-hidden="true" />
          <h2 className="team-ops__empty-title">Selecione uma fazenda</h2>
          <p className="team-ops__empty-desc">
            Escolha uma fazenda no seletor acima para ver as operações em bloco.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="team-ops">
      <div className="team-ops__header">
        <div className="team-ops__header-text">
          <h1 className="team-ops__title">Operações em bloco</h1>
          <p className="team-ops__subtitle">
            Operações de equipe em {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="team-ops__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="team-ops__btn team-ops__btn--primary"
              onClick={() => setShowModal(true)}
            >
              <Plus size={20} aria-hidden="true" />
              Nova operação
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toolbar */}
      <div className="team-ops__toolbar">
        <select
          className="team-ops__filter-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por tipo de operação"
        >
          <option value="">Todos os tipos</option>
          {TEAM_OPERATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="team-ops__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="team-ops__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="team-ops__skeleton team-ops__skeleton--card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {operations.length === 0 && !isLoading && !error ? (
        <div className="team-ops__empty">
          <ClipboardList size={64} aria-hidden="true" />
          <h2 className="team-ops__empty-title">Nenhuma operação registrada</h2>
          <p className="team-ops__empty-desc">
            Registre operações em bloco para apontar atividades de uma equipe inteira de uma vez.
          </p>
        </div>
      ) : null}

      {/* Cards grid */}
      {operations.length > 0 && !isLoading && (
        <div className="team-ops__grid">
          {operations.map((op) => (
            <div
              key={op.id}
              className="team-ops__card"
              onClick={() => handleCardClick(op)}
              onKeyDown={(e) => handleCardKeyDown(e, op)}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes da operação ${op.operationTypeLabel} em ${op.fieldPlotName}`}
            >
              <div className="team-ops__card-header">
                <h3 className="team-ops__card-name">{op.operationTypeLabel}</h3>
                <span className="team-ops__badge team-ops__badge--type">
                  {op.entryCount} {op.entryCount === 1 ? 'membro' : 'membros'}
                </span>
              </div>

              <div className="team-ops__card-details">
                <span className="team-ops__card-detail">
                  <MapPin size={14} aria-hidden="true" />
                  {op.fieldPlotName}
                </span>
                <span className="team-ops__card-detail">
                  <UsersRound size={14} aria-hidden="true" />
                  {op.teamName}
                </span>
                <span className="team-ops__card-detail">
                  <Calendar size={14} aria-hidden="true" />
                  {formatDate(op.performedAt)}
                </span>
                <span className="team-ops__card-detail">
                  <Clock size={14} aria-hidden="true" />
                  {formatTime(op.timeStart)} — {formatTime(op.timeEnd)} ({op.durationHours}h)
                </span>
              </div>

              {op.notes && <p className="team-ops__card-notes">{op.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedOp && (
        <div className="team-ops__detail-overlay" onClick={() => setSelectedOp(null)}>
          <div
            className="team-ops__detail"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes da operação"
          >
            <div className="team-ops__detail-header">
              <h2 className="team-ops__detail-title">{selectedOp.operationTypeLabel}</h2>
              <button
                type="button"
                className="to-modal__close"
                onClick={() => setSelectedOp(null)}
                aria-label="Fechar"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <div className="team-ops__detail-body">
              <dl className="team-ops__detail-dl">
                <div className="team-ops__detail-row">
                  <dt>Talhão</dt>
                  <dd>{selectedOp.fieldPlotName}</dd>
                </div>
                <div className="team-ops__detail-row">
                  <dt>Equipe</dt>
                  <dd>{selectedOp.teamName}</dd>
                </div>
                <div className="team-ops__detail-row">
                  <dt>Data</dt>
                  <dd>{formatDate(selectedOp.performedAt)}</dd>
                </div>
                <div className="team-ops__detail-row">
                  <dt>Horário</dt>
                  <dd>
                    {formatTime(selectedOp.timeStart)} — {formatTime(selectedOp.timeEnd)} (
                    {selectedOp.durationHours}h)
                  </dd>
                </div>
                {selectedOp.notes && (
                  <div className="team-ops__detail-row">
                    <dt>Observações</dt>
                    <dd>{selectedOp.notes}</dd>
                  </div>
                )}
                <div className="team-ops__detail-row">
                  <dt>Registrado por</dt>
                  <dd>{selectedOp.recorderName}</dd>
                </div>
              </dl>

              <h3 className="team-ops__detail-subtitle">Membros ({selectedOp.entryCount})</h3>
              <ul className="team-ops__detail-members">
                {selectedOp.entries.map((entry) => (
                  <li key={entry.id} className="team-ops__detail-member">
                    <span className="team-ops__detail-member-name">{entry.userName}</span>
                    <span className="team-ops__detail-member-email">{entry.userEmail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="team-ops__pagination" aria-label="Paginação de operações">
          <button
            type="button"
            className="team-ops__btn team-ops__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="team-ops__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="team-ops__btn team-ops__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      {/* Modal */}
      <TeamOperationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default TeamOperationsPage;
