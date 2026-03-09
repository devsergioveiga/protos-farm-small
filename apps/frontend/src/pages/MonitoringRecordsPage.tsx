import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  ClipboardList,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Bug,
  Shield,
} from 'lucide-react';
import { useMonitoringRecords } from '@/hooks/useMonitoringRecords';
import { api } from '@/services/api';
import PermissionGate from '@/components/auth/PermissionGate';
import MonitoringRecordModal from '@/components/monitoring-records/MonitoringRecordModal';
import type { MonitoringRecordItem } from '@/types/monitoring-record';
import { INFESTATION_LEVELS } from '@/types/monitoring-record';
import './MonitoringRecordsPage.css';

function infestationBadgeClass(level: string): string {
  switch (level) {
    case 'AUSENTE':
      return 'mrp__badge--ausente';
    case 'BAIXO':
      return 'mrp__badge--baixo';
    case 'MODERADO':
      return 'mrp__badge--moderado';
    case 'ALTO':
      return 'mrp__badge--alto';
    case 'CRITICO':
      return 'mrp__badge--critico';
    default:
      return '';
  }
}

function MonitoringRecordsPage() {
  const { farmId = '', fieldPlotId = '' } = useParams<{
    farmId: string;
    fieldPlotId: string;
  }>();

  const [page, setPage] = useState(1);
  const [filterLevel, setFilterLevel] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MonitoringRecordItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [plotName, setPlotName] = useState('');

  const { records, meta, isLoading, error, refetch } = useMonitoringRecords({
    farmId,
    fieldPlotId,
    page,
    infestationLevel: filterLevel || undefined,
  });

  useEffect(() => {
    async function fetchPlotName() {
      try {
        const data = await api.get<{ plots: Array<{ id: string; name: string }> }>(
          `/org/farms/${farmId}/plots`,
        );
        const plot = data.plots.find((p) => p.id === fieldPlotId);
        if (plot) setPlotName(plot.name);
      } catch {
        // ignore
      }
    }
    if (farmId && fieldPlotId) void fetchPlotName();
  }, [farmId, fieldPlotId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedRecord(null);
    setToast('Registro salvo com sucesso');
    void refetch();
  }, [refetch]);

  const handleEdit = useCallback((record: MonitoringRecordItem) => {
    setSelectedRecord(record);
    setShowModal(true);
  }, []);

  const handleNewRecord = useCallback(() => {
    setSelectedRecord(null);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (record: MonitoringRecordItem) => {
      setIsDeleting(record.id);
      try {
        await api.delete(`/org/farms/${farmId}/monitoring-records/${record.id}`);
        setToast('Registro removido');
        void refetch();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao remover registro';
        setToast(msg);
      } finally {
        setIsDeleting(null);
      }
    },
    [farmId, refetch],
  );

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <section className="mrp">
      {/* Breadcrumb */}
      <nav className="mrp__breadcrumb" aria-label="Navegação">
        <Link to={`/farms/${farmId}/plots/${fieldPlotId}/monitoring-points`} className="mrp__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar aos pontos
        </Link>
      </nav>

      {/* Header */}
      <div className="mrp__header">
        <div className="mrp__header-text">
          <h1 className="mrp__title">Registros de Monitoramento MIP</h1>
          <p className="mrp__subtitle">
            {plotName ? `Talhão: ${plotName}` : 'Registros de observações de pragas e doenças'}
          </p>
        </div>
        <div className="mrp__header-actions">
          <PermissionGate permission="farms:update">
            <button type="button" className="mrp__btn mrp__btn--primary" onClick={handleNewRecord}>
              <Plus size={20} aria-hidden="true" />
              Novo registro
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mrp__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Filters */}
      <div className="mrp__filters">
        <div className="mrp__filter-field">
          <label htmlFor="mrp-filter-level" className="mrp__filter-label">
            Nível de infestação
          </label>
          <select
            id="mrp-filter-level"
            className="mrp__filter-select"
            value={filterLevel}
            onChange={(e) => {
              setFilterLevel(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {INFESTATION_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mrp__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="mrp__table-wrapper">
          <table className="mrp__table">
            <thead>
              <tr>
                <th scope="col">Ponto</th>
                <th scope="col">Praga</th>
                <th scope="col">Nível</th>
                <th scope="col">Data</th>
                <th scope="col">Contagem</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j}>
                      <div className="mrp__skeleton" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && records.length === 0 && (
        <div className="mrp__empty">
          <ClipboardList size={48} aria-hidden="true" className="mrp__empty-icon" />
          <h2 className="mrp__empty-title">Nenhum registro de monitoramento</h2>
          <p className="mrp__empty-desc">
            Registre observações de pragas e doenças nos pontos de monitoramento deste talhão.
          </p>
          <PermissionGate permission="farms:update">
            <button type="button" className="mrp__btn mrp__btn--primary" onClick={handleNewRecord}>
              <Plus size={20} aria-hidden="true" />
              Registrar primeira observação
            </button>
          </PermissionGate>
        </div>
      )}

      {/* Table (desktop) */}
      {!isLoading && !error && records.length > 0 && (
        <>
          <div className="mrp__table-wrapper">
            <table className="mrp__table">
              <caption className="sr-only">Registros de monitoramento de pragas</caption>
              <thead>
                <tr>
                  <th scope="col">Ponto</th>
                  <th scope="col">Praga</th>
                  <th scope="col">Nível</th>
                  <th scope="col">Data</th>
                  <th scope="col">Contagem</th>
                  <th scope="col">Estádio</th>
                  <th scope="col">Dano %</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id}>
                    <td className="mrp__code">{rec.monitoringPointCode}</td>
                    <td>
                      <div className="mrp__pest-cell">
                        <Bug size={14} aria-hidden="true" className="mrp__pest-icon" />
                        <span>{rec.pestName}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`mrp__badge ${infestationBadgeClass(rec.infestationLevel)}`}>
                        {rec.infestationLevelLabel}
                      </span>
                    </td>
                    <td className="mrp__date">{formatDate(rec.observedAt)}</td>
                    <td className="mrp__count">
                      {rec.pestCount != null ? rec.pestCount : '—'}
                      {rec.sampleCount != null && (
                        <span className="mrp__sample-info"> / {rec.sampleCount} amostras</span>
                      )}
                    </td>
                    <td className="mrp__stage">{rec.growthStage ?? '—'}</td>
                    <td className="mrp__damage">
                      {rec.damagePercentage != null ? `${rec.damagePercentage}%` : '—'}
                    </td>
                    <td>
                      <div className="mrp__actions">
                        {rec.hasNaturalEnemies && (
                          <span
                            className="mrp__enemies-indicator"
                            title={rec.naturalEnemiesDesc ?? 'Inimigos naturais presentes'}
                            aria-label="Inimigos naturais presentes"
                          >
                            <Shield size={14} aria-hidden="true" />
                          </span>
                        )}
                        <PermissionGate permission="farms:update">
                          <button
                            type="button"
                            className="mrp__action-btn"
                            onClick={() => handleEdit(rec)}
                            aria-label={`Editar registro do ponto ${rec.monitoringPointCode}`}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="mrp__action-btn mrp__action-btn--delete"
                            onClick={() => handleDelete(rec)}
                            disabled={isDeleting === rec.id}
                            aria-label={`Excluir registro do ponto ${rec.monitoringPointCode}`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mrp__cards">
            {records.map((rec) => (
              <div key={rec.id} className="mrp__card">
                <div className="mrp__card-header">
                  <span className="mrp__card-code">{rec.monitoringPointCode}</span>
                  <span className={`mrp__badge ${infestationBadgeClass(rec.infestationLevel)}`}>
                    {rec.infestationLevelLabel}
                  </span>
                </div>
                <div className="mrp__card-pest">
                  <Bug size={14} aria-hidden="true" />
                  <span>{rec.pestName}</span>
                </div>
                <div className="mrp__card-details">
                  <span className="mrp__card-date">{formatDate(rec.observedAt)}</span>
                  {rec.pestCount != null && (
                    <span className="mrp__card-count">{rec.pestCount} pragas</span>
                  )}
                  {rec.growthStage && <span className="mrp__card-stage">{rec.growthStage}</span>}
                  {rec.damagePercentage != null && (
                    <span className="mrp__card-damage">{rec.damagePercentage}% dano</span>
                  )}
                </div>
                {rec.hasNaturalEnemies && (
                  <div className="mrp__card-enemies">
                    <Shield size={14} aria-hidden="true" />
                    <span>{rec.naturalEnemiesDesc ?? 'Inimigos naturais presentes'}</span>
                  </div>
                )}
                {rec.notes && <p className="mrp__card-notes">{rec.notes}</p>}
                <div className="mrp__card-actions">
                  <PermissionGate permission="farms:update">
                    <button
                      type="button"
                      className="mrp__action-btn"
                      onClick={() => handleEdit(rec)}
                      aria-label={`Editar registro do ponto ${rec.monitoringPointCode}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="mrp__action-btn mrp__action-btn--delete"
                      onClick={() => handleDelete(rec)}
                      disabled={isDeleting === rec.id}
                      aria-label={`Excluir registro do ponto ${rec.monitoringPointCode}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </PermissionGate>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="mrp__pagination" aria-label="Paginação">
              <button
                type="button"
                className="mrp__btn mrp__btn--ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span className="mrp__page-info">
                {page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="mrp__btn mrp__btn--ghost"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      <MonitoringRecordModal
        isOpen={showModal}
        farmId={farmId}
        fieldPlotId={fieldPlotId}
        record={selectedRecord}
        onClose={() => {
          setShowModal(false);
          setSelectedRecord(null);
        }}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default MonitoringRecordsPage;
