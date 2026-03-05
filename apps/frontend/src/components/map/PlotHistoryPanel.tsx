import { useState, lazy, Suspense, useCallback } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { usePlotHistory } from '@/hooks/usePlotHistory';
import RotationBadge from './RotationBadge';
import PlotSeasonTimeline from './PlotSeasonTimeline';
import PlotSoilTable from './PlotSoilTable';
import PlotHistoryExport from './PlotHistoryExport';
import PlotBoundaryVersionsList from './PlotBoundaryVersionsList';
import type { FieldPlot, CropSeasonItem, SoilAnalysisItem } from '@/types/farm';
import './PlotHistoryPanel.css';

const AddCropSeasonModal = lazy(() => import('./AddCropSeasonModal'));
const EditCropSeasonModal = lazy(() => import('./EditCropSeasonModal'));
const AddSoilAnalysisModal = lazy(() => import('./AddSoilAnalysisModal'));
const EditSoilAnalysisModal = lazy(() => import('./EditSoilAnalysisModal'));

interface PlotHistoryPanelProps {
  plot: FieldPlot;
  farmId: string;
  onClose: () => void;
}

type Tab = 'seasons' | 'soil' | 'boundary' | 'export';

function PlotHistoryPanel({ plot, farmId, onClose }: PlotHistoryPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('seasons');
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [showAddSoilAnalysis, setShowAddSoilAnalysis] = useState(false);
  const [editingSeason, setEditingSeason] = useState<CropSeasonItem | null>(null);
  const [deletingSeason, setDeletingSeason] = useState<CropSeasonItem | null>(null);
  const [editingAnalysis, setEditingAnalysis] = useState<SoilAnalysisItem | null>(null);
  const [deletingAnalysis, setDeletingAnalysis] = useState<SoilAnalysisItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = usePlotHistory(farmId, plot.id);

  const handleDeleteSeason = useCallback(async () => {
    if (!deletingSeason) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/org/farms/${farmId}/plots/${plot.id}/crop-seasons/${deletingSeason.id}`);
      setDeletingSeason(null);
      void refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível excluir a safra. Tente novamente.';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [deletingSeason, farmId, plot.id, refetch]);

  const handleDeleteAnalysis = useCallback(async () => {
    if (!deletingAnalysis) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(
        `/org/farms/${farmId}/plots/${plot.id}/soil-analyses/${deletingAnalysis.id}`,
      );
      setDeletingAnalysis(null);
      void refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível excluir a análise. Tente novamente.';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [deletingAnalysis, farmId, plot.id, refetch]);

  function formatAnalysisDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  return (
    <div className="plot-history" role="region" aria-label="Histórico do talhão">
      <div className="plot-history__header">
        <div className="plot-history__header-left">
          <h2 className="plot-history__title">{plot.name}</h2>
          {data?.rotation && <RotationBadge rotation={data.rotation} />}
        </div>
        <button
          type="button"
          className="plot-history__close"
          onClick={onClose}
          aria-label="Fechar histórico"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="plot-history__tabs" role="tablist" aria-label="Seções do histórico">
        <button
          type="button"
          role="tab"
          className={`plot-history__tab ${activeTab === 'seasons' ? 'plot-history__tab--active' : ''}`}
          onClick={() => setActiveTab('seasons')}
          aria-selected={activeTab === 'seasons'}
          aria-controls="panel-seasons"
          id="tab-seasons"
        >
          Safras
        </button>
        <button
          type="button"
          role="tab"
          className={`plot-history__tab ${activeTab === 'soil' ? 'plot-history__tab--active' : ''}`}
          onClick={() => setActiveTab('soil')}
          aria-selected={activeTab === 'soil'}
          aria-controls="panel-soil"
          id="tab-soil"
        >
          Solo
        </button>
        <button
          type="button"
          role="tab"
          className={`plot-history__tab ${activeTab === 'boundary' ? 'plot-history__tab--active' : ''}`}
          onClick={() => setActiveTab('boundary')}
          aria-selected={activeTab === 'boundary'}
          aria-controls="panel-boundary"
          id="tab-boundary"
        >
          Perímetro
        </button>
        <button
          type="button"
          role="tab"
          className={`plot-history__tab ${activeTab === 'export' ? 'plot-history__tab--active' : ''}`}
          onClick={() => setActiveTab('export')}
          aria-selected={activeTab === 'export'}
          aria-controls="panel-export"
          id="tab-export"
        >
          Exportar
        </button>
      </div>

      <div className="plot-history__content">
        {isLoading && (
          <div className="plot-history__loading" aria-busy="true">
            <div className="skeleton-line" style={{ width: '80%', height: 16 }} />
            <div className="skeleton-line" style={{ width: '60%', height: 16 }} />
            <div className="skeleton-line" style={{ width: '70%', height: 16 }} />
          </div>
        )}

        {error && (
          <div className="plot-history__error" role="alert">
            <p>Não foi possível carregar o histórico. Tente novamente.</p>
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            <div
              role="tabpanel"
              id="panel-seasons"
              aria-labelledby="tab-seasons"
              hidden={activeTab !== 'seasons'}
            >
              <div className="plot-history__panel-header">
                <button
                  type="button"
                  className="plot-history__add-btn"
                  onClick={() => setShowAddSeason(true)}
                  aria-label="Nova safra"
                >
                  <Plus size={16} aria-hidden="true" />
                  Nova safra
                </button>
              </div>

              {deletingSeason && (
                <div className="plot-history__confirm-delete" role="alert">
                  <p className="plot-history__confirm-delete-text">
                    Excluir safra {deletingSeason.crop} {deletingSeason.seasonYear}?
                  </p>
                  {deleteError && (
                    <div className="plot-history__confirm-delete-error">
                      <AlertCircle size={16} aria-hidden="true" />
                      {deleteError}
                    </div>
                  )}
                  <div className="plot-history__confirm-delete-actions">
                    <button
                      type="button"
                      className="plot-history__confirm-btn"
                      onClick={() => {
                        setDeletingSeason(null);
                        setDeleteError(null);
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="plot-history__confirm-btn plot-history__confirm-btn--danger"
                      onClick={() => void handleDeleteSeason()}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              )}

              <PlotSeasonTimeline
                seasons={data.seasons}
                onEdit={setEditingSeason}
                onDelete={setDeletingSeason}
              />
            </div>

            <div
              role="tabpanel"
              id="panel-soil"
              aria-labelledby="tab-soil"
              hidden={activeTab !== 'soil'}
            >
              <div className="plot-history__panel-header">
                <button
                  type="button"
                  className="plot-history__add-btn"
                  onClick={() => setShowAddSoilAnalysis(true)}
                  aria-label="Nova análise de solo"
                >
                  <Plus size={16} aria-hidden="true" />
                  Nova análise
                </button>
              </div>

              {deletingAnalysis && (
                <div className="plot-history__confirm-delete" role="alert">
                  <p className="plot-history__confirm-delete-text">
                    Excluir análise de {formatAnalysisDate(deletingAnalysis.analysisDate)}?
                  </p>
                  {deleteError && (
                    <div className="plot-history__confirm-delete-error">
                      <AlertCircle size={16} aria-hidden="true" />
                      {deleteError}
                    </div>
                  )}
                  <div className="plot-history__confirm-delete-actions">
                    <button
                      type="button"
                      className="plot-history__confirm-btn"
                      onClick={() => {
                        setDeletingAnalysis(null);
                        setDeleteError(null);
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="plot-history__confirm-btn plot-history__confirm-btn--danger"
                      onClick={() => void handleDeleteAnalysis()}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              )}

              <PlotSoilTable
                analyses={data.analyses}
                onEdit={setEditingAnalysis}
                onDelete={setDeletingAnalysis}
              />
            </div>

            <div
              role="tabpanel"
              id="panel-boundary"
              aria-labelledby="tab-boundary"
              hidden={activeTab !== 'boundary'}
            >
              <PlotBoundaryVersionsList farmId={farmId} plotId={plot.id} />
            </div>

            <div
              role="tabpanel"
              id="panel-export"
              aria-labelledby="tab-export"
              hidden={activeTab !== 'export'}
            >
              <PlotHistoryExport farmId={farmId} plotId={plot.id} />
            </div>
          </>
        )}
      </div>
      {showAddSeason && (
        <Suspense fallback={null}>
          <AddCropSeasonModal
            isOpen={showAddSeason}
            farmId={farmId}
            plotId={plot.id}
            onClose={() => setShowAddSeason(false)}
            onSuccess={() => void refetch()}
          />
        </Suspense>
      )}
      {editingSeason && (
        <Suspense fallback={null}>
          <EditCropSeasonModal
            isOpen={!!editingSeason}
            season={editingSeason}
            farmId={farmId}
            plotId={plot.id}
            onClose={() => setEditingSeason(null)}
            onSuccess={() => void refetch()}
          />
        </Suspense>
      )}
      {showAddSoilAnalysis && (
        <Suspense fallback={null}>
          <AddSoilAnalysisModal
            isOpen={showAddSoilAnalysis}
            farmId={farmId}
            plotId={plot.id}
            onClose={() => setShowAddSoilAnalysis(false)}
            onSuccess={() => void refetch()}
          />
        </Suspense>
      )}
      {editingAnalysis && (
        <Suspense fallback={null}>
          <EditSoilAnalysisModal
            isOpen={!!editingAnalysis}
            analysis={editingAnalysis}
            farmId={farmId}
            plotId={plot.id}
            onClose={() => setEditingAnalysis(null)}
            onSuccess={() => void refetch()}
          />
        </Suspense>
      )}
    </div>
  );
}

export default PlotHistoryPanel;
