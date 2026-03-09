import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Crosshair,
  Grid3x3,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  ClipboardList,
} from 'lucide-react';
import { useMonitoringPoints } from '@/hooks/useMonitoringPoints';
import { api } from '@/services/api';
import PermissionGate from '@/components/auth/PermissionGate';
import MonitoringPointModal from '@/components/monitoring-points/MonitoringPointModal';
import type { MonitoringPointItem, GenerateGridResponse } from '@/types/monitoring-point';
import './MonitoringPointsPage.css';

function MonitoringPointsPage() {
  const { farmId = '', fieldPlotId = '' } = useParams<{
    farmId: string;
    fieldPlotId: string;
  }>();

  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<MonitoringPointItem | null>(null);
  const [showGridForm, setShowGridForm] = useState(false);
  const [gridSpacing, setGridSpacing] = useState('50');
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [plotName, setPlotName] = useState('');

  const { points, meta, isLoading, error, refetch } = useMonitoringPoints({
    farmId,
    fieldPlotId,
    page,
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
    setSelectedPoint(null);
    setToast('Ponto salvo com sucesso');
    void refetch();
  }, [refetch]);

  const handleEdit = useCallback((point: MonitoringPointItem) => {
    setSelectedPoint(point);
    setShowModal(true);
  }, []);

  const handleNewPoint = useCallback(() => {
    setSelectedPoint(null);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (point: MonitoringPointItem) => {
      setIsDeleting(point.id);
      try {
        await api.delete(`/org/farms/${farmId}/monitoring-points/${point.id}`);
        setToast(`Ponto ${point.code} removido`);
        void refetch();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao remover ponto';
        setToast(msg);
      } finally {
        setIsDeleting(null);
      }
    },
    [farmId, refetch],
  );

  const handleGenerateGrid = useCallback(async () => {
    const spacing = parseInt(gridSpacing, 10);
    if (isNaN(spacing) || spacing < 5 || spacing > 500) return;

    setIsGenerating(true);
    try {
      const result = await api.post<GenerateGridResponse>(
        `/org/farms/${farmId}/monitoring-points/generate-grid`,
        { fieldPlotId, spacingMeters: spacing },
      );
      setShowGridForm(false);
      setToast(`${result.total} pontos gerados em grade`);
      setPage(1);
      void refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar grade';
      setToast(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [farmId, fieldPlotId, gridSpacing, refetch]);

  return (
    <section className="mp-page">
      {/* Breadcrumb */}
      <nav className="mp-page__breadcrumb" aria-label="Navegação">
        <Link to={`/farms/${farmId}/map`} className="mp-page__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar ao mapa
        </Link>
      </nav>

      {/* Header */}
      <div className="mp-page__header">
        <div className="mp-page__header-text">
          <h1 className="mp-page__title">Pontos de Monitoramento MIP</h1>
          <p className="mp-page__subtitle">
            {plotName ? `Talhão: ${plotName}` : 'Configurar pontos de amostragem'}
          </p>
        </div>
        <div className="mp-page__header-actions">
          <Link
            to={`/farms/${farmId}/plots/${fieldPlotId}/monitoring-records`}
            className="mp-page__btn mp-page__btn--secondary"
          >
            <ClipboardList size={20} aria-hidden="true" />
            Registros MIP
          </Link>
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="mp-page__btn mp-page__btn--secondary"
              onClick={() => setShowGridForm(!showGridForm)}
            >
              <Grid3x3 size={20} aria-hidden="true" />
              Gerar grade
            </button>
            <button
              type="button"
              className="mp-page__btn mp-page__btn--primary"
              onClick={handleNewPoint}
            >
              <Plus size={20} aria-hidden="true" />
              Novo ponto
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mp-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Grid generation form */}
      {showGridForm && (
        <div className="mp-page__grid-form">
          <p className="mp-page__grid-desc">
            Gera pontos de monitoramento em grade regular dentro do perímetro do talhão. Os pontos
            existentes serão substituídos.
          </p>
          <div className="mp-page__grid-row">
            <div className="mp-page__grid-field">
              <label htmlFor="grid-spacing" className="mp-page__grid-label">
                Espaçamento (metros)
              </label>
              <input
                id="grid-spacing"
                type="number"
                min={5}
                max={500}
                className="mp-page__grid-input"
                value={gridSpacing}
                onChange={(e) => setGridSpacing(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="mp-page__btn mp-page__btn--primary"
              disabled={isGenerating}
              onClick={handleGenerateGrid}
            >
              {isGenerating ? 'Gerando...' : 'Gerar pontos'}
            </button>
            <button
              type="button"
              className="mp-page__btn mp-page__btn--ghost"
              onClick={() => setShowGridForm(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mp-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="mp-page__table-wrapper">
          <table className="mp-page__table">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Latitude</th>
                <th scope="col">Longitude</th>
                <th scope="col">Observações</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td>
                    <div className="mp-page__skeleton" />
                  </td>
                  <td>
                    <div className="mp-page__skeleton" />
                  </td>
                  <td>
                    <div className="mp-page__skeleton" />
                  </td>
                  <td>
                    <div className="mp-page__skeleton mp-page__skeleton--wide" />
                  </td>
                  <td>
                    <div className="mp-page__skeleton mp-page__skeleton--short" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && points.length === 0 && (
        <div className="mp-page__empty">
          <Crosshair size={48} aria-hidden="true" className="mp-page__empty-icon" />
          <h2 className="mp-page__empty-title">Nenhum ponto de monitoramento</h2>
          <p className="mp-page__empty-desc">
            Configure pontos de amostragem para registrar monitoramentos MIP neste talhão.
          </p>
          <PermissionGate permission="farms:update">
            <div className="mp-page__empty-actions">
              <button
                type="button"
                className="mp-page__btn mp-page__btn--secondary"
                onClick={() => setShowGridForm(true)}
              >
                <Grid3x3 size={20} aria-hidden="true" />
                Gerar grade automática
              </button>
              <button
                type="button"
                className="mp-page__btn mp-page__btn--primary"
                onClick={handleNewPoint}
              >
                <Plus size={20} aria-hidden="true" />
                Adicionar ponto manualmente
              </button>
            </div>
          </PermissionGate>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && points.length > 0 && (
        <>
          <div className="mp-page__table-wrapper">
            <table className="mp-page__table">
              <caption className="sr-only">Pontos de monitoramento do talhão</caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Latitude</th>
                  <th scope="col">Longitude</th>
                  <th scope="col">Observações</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.id}>
                    <td className="mp-page__code">{point.code}</td>
                    <td className="mp-page__coord">{point.latitude.toFixed(7)}</td>
                    <td className="mp-page__coord">{point.longitude.toFixed(7)}</td>
                    <td className="mp-page__notes-cell">{point.notes ?? '—'}</td>
                    <td>
                      <div className="mp-page__actions">
                        <PermissionGate permission="farms:update">
                          <button
                            type="button"
                            className="mp-page__action-btn"
                            onClick={() => handleEdit(point)}
                            aria-label={`Editar ponto ${point.code}`}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="mp-page__action-btn mp-page__action-btn--delete"
                            onClick={() => handleDelete(point)}
                            disabled={isDeleting === point.id}
                            aria-label={`Excluir ponto ${point.code}`}
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

          {/* Mobile cards (hidden on desktop) */}
          <div className="mp-page__cards">
            {points.map((point) => (
              <div key={point.id} className="mp-page__card">
                <div className="mp-page__card-header">
                  <span className="mp-page__card-code">{point.code}</span>
                  <PermissionGate permission="farms:update">
                    <div className="mp-page__card-actions">
                      <button
                        type="button"
                        className="mp-page__action-btn"
                        onClick={() => handleEdit(point)}
                        aria-label={`Editar ponto ${point.code}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="mp-page__action-btn mp-page__action-btn--delete"
                        onClick={() => handleDelete(point)}
                        disabled={isDeleting === point.id}
                        aria-label={`Excluir ponto ${point.code}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </PermissionGate>
                </div>
                <div className="mp-page__card-coords">
                  <span className="mp-page__coord">{point.latitude.toFixed(7)}</span>
                  <span className="mp-page__coord">{point.longitude.toFixed(7)}</span>
                </div>
                {point.notes && <p className="mp-page__card-notes">{point.notes}</p>}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="mp-page__pagination" aria-label="Paginação">
              <button
                type="button"
                className="mp-page__btn mp-page__btn--ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span className="mp-page__page-info">
                {page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="mp-page__btn mp-page__btn--ghost"
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

      <MonitoringPointModal
        isOpen={showModal}
        farmId={farmId}
        fieldPlotId={fieldPlotId}
        point={selectedPoint}
        onClose={() => {
          setShowModal(false);
          setSelectedPoint(null);
        }}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default MonitoringPointsPage;
