import { useState, useCallback, lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Upload,
  Combine,
  FileText,
  MapPin,
  Clock,
  Users,
  Plus,
} from 'lucide-react';
import turfArea from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';
import { useFarmMap } from '@/hooks/useFarmMap';
import { useRegistrations } from '@/hooks/useRegistrations';
import { api } from '@/services/api';
import FarmMap from '@/components/map/FarmMap';
import BaseMapSelector, { type BaseMapType } from '@/components/map/BaseMapSelector';
import LayerControlPanel, { type LayerConfig } from '@/components/map/LayerControlPanel';
import CropLegend from '@/components/map/CropLegend';
import PlotDetailsPanel from '@/components/map/PlotDetailsPanel';
import PlotSummaryBar from '@/components/map/PlotSummaryBar';
import type {
  FieldPlot,
  FarmRegistration,
  CreateRegistrationPayload,
  UpdatePlotBoundaryResult,
} from '@/types/farm';
import './FarmMapPage.css';

const PlotHistoryPanel = lazy(() => import('@/components/map/PlotHistoryPanel'));
const BulkImportModal = lazy(() => import('@/components/bulk-import/BulkImportModal'));
const PlotGeometryEditor = lazy(() => import('@/components/map/PlotGeometryEditor'));
const ConfirmBoundaryEdit = lazy(() => import('@/components/map/ConfirmBoundaryEdit'));
const PlotSubdivideEditor = lazy(() => import('@/components/map/PlotSubdivideEditor'));
const PlotMergeEditor = lazy(() => import('@/components/map/PlotMergeEditor'));
const BoundaryUploadModal = lazy(() => import('@/components/boundary/BoundaryUploadModal'));
const BoundaryVersionsPanel = lazy(() => import('@/components/boundary/BoundaryVersionsPanel'));
const RegistrationsPanel = lazy(() => import('@/components/registrations/RegistrationsPanel'));
const RegistrationFormModal = lazy(
  () => import('@/components/registrations/RegistrationFormModal'),
);
const FarmProducersPanel = lazy(() => import('@/components/farm-producers/FarmProducersPanel'));
const CreatePlotModal = lazy(() => import('@/components/map/CreatePlotModal'));
const EditPlotModal = lazy(() => import('@/components/map/EditPlotModal'));

interface BoundaryVersionsTarget {
  registrationId?: string;
  entityLabel: string;
}

interface EditingPlotState {
  plot: FieldPlot;
  boundary: GeoJSON.Polygon;
}

interface PendingSaveState {
  geojson: GeoJSON.Polygon;
  previousAreaHa: number;
  newAreaHa: number;
}

const DEFAULT_LAYERS: LayerConfig[] = [
  { id: 'perimeter', label: 'Perímetro', enabled: true },
  { id: 'registrations', label: 'Matrículas', enabled: true },
  { id: 'plots', label: 'Talhões', enabled: true },
  { id: 'pastures', label: 'Pastos', enabled: false, disabled: true, futureLabel: 'Em breve' },
  {
    id: 'structures',
    label: 'Sedes/Estruturas',
    enabled: false,
    disabled: true,
    futureLabel: 'Em breve',
  },
  {
    id: 'environmental',
    label: 'APP/Reserva Legal',
    enabled: false,
    disabled: true,
    futureLabel: 'Em breve',
  },
];

function FarmMapPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { data, isLoading, error, refetch } = useFarmMap(farmId);
  const handleRegistrationMutationSuccess = useCallback(() => {
    void refetch();
  }, [refetch]);
  const {
    areaDivergence,
    isSubmitting: isRegSubmitting,
    submitError: regSubmitError,
    addRegistration,
    updateRegistration,
    deleteRegistration,
    clearError: clearRegError,
  } = useRegistrations(farmId, handleRegistrationMutationSuccess);
  const [baseMap, setBaseMap] = useState<BaseMapType>('satellite');
  const [layers, setLayers] = useState<LayerConfig[]>(DEFAULT_LAYERS);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isCreatePlotOpen, setIsCreatePlotOpen] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<FieldPlot | null>(null);
  const [cropFilter, setCropFilter] = useState<Set<string>>(new Set());
  const [editingPlot, setEditingPlot] = useState<EditingPlotState | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSaveState | null>(null);
  const [subdividingPlot, setSubdividingPlot] = useState<EditingPlotState | null>(null);
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [historyPlot, setHistoryPlot] = useState<FieldPlot | null>(null);
  const [editingPlotAttributes, setEditingPlotAttributes] = useState<FieldPlot | null>(null);
  const [isBoundaryUploadOpen, setIsBoundaryUploadOpen] = useState(false);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [showProducers, setShowProducers] = useState(false);
  const [isRegFormOpen, setIsRegFormOpen] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<FarmRegistration | undefined>(
    undefined,
  );
  const [uploadingBoundaryReg, setUploadingBoundaryReg] = useState<FarmRegistration | null>(null);
  const [boundaryVersionsTarget, setBoundaryVersionsTarget] =
    useState<BoundaryVersionsTarget | null>(null);
  const [versionOverlay, setVersionOverlay] = useState<GeoJSON.Polygon | null>(null);

  const handleOpenRegForm = useCallback(
    (reg?: FarmRegistration) => {
      setEditingRegistration(reg);
      clearRegError();
      setIsRegFormOpen(true);
    },
    [clearRegError],
  );

  const handleCloseRegForm = useCallback(() => {
    setIsRegFormOpen(false);
    setEditingRegistration(undefined);
  }, []);

  const handleRegFormSubmit = useCallback(
    async (payload: CreateRegistrationPayload) => {
      if (editingRegistration) {
        await updateRegistration(editingRegistration.id, payload);
      } else {
        await addRegistration(payload);
      }
    },
    [editingRegistration, addRegistration, updateRegistration],
  );

  const handleUploadRegBoundary = useCallback((reg: FarmRegistration) => {
    setUploadingBoundaryReg(reg);
  }, []);

  const handleDeleteRegistration = useCallback(
    (reg: FarmRegistration) => {
      void deleteRegistration(reg.id);
    },
    [deleteRegistration],
  );

  const handleOpenFarmBoundaryHistory = useCallback(() => {
    setBoundaryVersionsTarget({ entityLabel: 'da fazenda' });
    setVersionOverlay(null);
    setShowRegistrations(false);
    setSelectedPlot(null);
    setHistoryPlot(null);
  }, []);

  const handleOpenRegBoundaryHistory = useCallback((reg: FarmRegistration) => {
    setBoundaryVersionsTarget({
      registrationId: reg.id,
      entityLabel: `da matrícula ${reg.number}`,
    });
    setVersionOverlay(null);
    setShowRegistrations(false);
    setSelectedPlot(null);
    setHistoryPlot(null);
  }, []);

  const handleCloseBoundaryVersions = useCallback(() => {
    setBoundaryVersionsTarget(null);
    setVersionOverlay(null);
  }, []);

  const handleToggleLayer = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId && !l.disabled ? { ...l, enabled: !l.enabled } : l)),
    );
  }, []);

  const handleImportComplete = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handlePlotClick = useCallback((plot: FieldPlot) => {
    setSelectedPlot(plot);
  }, []);

  const handleToggleCrop = useCallback((cropKey: string) => {
    setCropFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cropKey)) {
        next.delete(cropKey);
      } else {
        next.add(cropKey);
      }
      return next;
    });
  }, []);

  const handleViewHistory = useCallback((plot: FieldPlot) => {
    setHistoryPlot(plot);
    setSelectedPlot(null);
  }, []);

  const handleEditAttributes = useCallback((plot: FieldPlot) => {
    setEditingPlotAttributes(plot);
    setSelectedPlot(null);
  }, []);

  const handleEditGeometry = useCallback(
    (plot: FieldPlot) => {
      if (!data) return;
      const pb = data.plotBoundaries.find((p) => p.plotId === plot.id);
      if (!pb?.boundary.boundaryGeoJSON) return;
      setEditingPlot({ plot, boundary: pb.boundary.boundaryGeoJSON });
      setSelectedPlot(null);
    },
    [data],
  );

  const handleSubdivide = useCallback(
    (plot: FieldPlot) => {
      if (!data) return;
      const pb = data.plotBoundaries.find((p) => p.plotId === plot.id);
      if (!pb?.boundary.boundaryGeoJSON) return;
      setSubdividingPlot({ plot, boundary: pb.boundary.boundaryGeoJSON });
      setSelectedPlot(null);
    },
    [data],
  );

  const handleSubdivideComplete = useCallback(() => {
    setSubdividingPlot(null);
    void refetch();
  }, [refetch]);

  const handleMergeComplete = useCallback(() => {
    setIsMergeMode(false);
    void refetch();
  }, [refetch]);

  const handleEditorSave = useCallback((geojson: GeoJSON.Polygon, previousAreaHa: number) => {
    const feature = turfPolygon(geojson.coordinates);
    const newAreaHa = turfArea(feature) / 10000;
    setPendingSave({ geojson, previousAreaHa, newAreaHa });
  }, []);

  const handleConfirmSave = useCallback(async () => {
    if (!pendingSave || !editingPlot || !farmId) return;
    try {
      await api.patch<UpdatePlotBoundaryResult>(
        `/org/farms/${farmId}/plots/${editingPlot.plot.id}/boundary`,
        { geojson: pendingSave.geojson },
      );
      setPendingSave(null);
      setEditingPlot(null);
      void refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar';
      alert(message);
    }
  }, [pendingSave, editingPlot, farmId, refetch]);

  const handleCancelSave = useCallback(() => {
    setPendingSave(null);
  }, []);

  const handleCancelEditor = useCallback(() => {
    setEditingPlot(null);
  }, []);

  const showFarmBoundary = layers.find((l) => l.id === 'perimeter')?.enabled ?? true;
  const showRegistrationLayer = layers.find((l) => l.id === 'registrations')?.enabled ?? true;
  const showPlots = layers.find((l) => l.id === 'plots')?.enabled ?? true;

  if (isLoading) {
    return (
      <div className="farm-map-page" aria-busy="true">
        <div className="farm-map-page__skeleton-header">
          <div className="skeleton-line" style={{ width: 48, height: 48, borderRadius: 8 }} />
          <div className="skeleton-line" style={{ width: 200, height: 24 }} />
        </div>
        <div className="farm-map-page__skeleton-map" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="farm-map-page">
        <div className="farm-map-page__error">
          <AlertCircle size={48} aria-hidden="true" className="farm-map-page__error-icon" />
          <h1 className="farm-map-page__error-title">Não foi possível carregar o mapa</h1>
          <p className="farm-map-page__error-text">
            {error ?? 'Fazenda não encontrada. Verifique se o endereço está correto.'}
          </p>
          <Link to="/farms" className="farm-map-page__error-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar para fazendas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="farm-map-page">
      <header className="farm-map-page__header">
        <Link to="/farms" className="farm-map-page__back" aria-label="Voltar para fazendas">
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>

        <div className="farm-map-page__title-area">
          <nav className="farm-map-page__breadcrumb" aria-label="Breadcrumb">
            <Link to="/dashboard">Início</Link>
            <span aria-hidden="true">/</span>
            <Link to="/farms">Fazendas</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{data.farm.name}</span>
          </nav>
          <h1 className="farm-map-page__title">{data.farm.name}</h1>
        </div>

        <button
          type="button"
          className="farm-map-page__header-btn"
          onClick={() => setIsBoundaryUploadOpen(true)}
          aria-label="Perímetro"
        >
          <MapPin size={20} aria-hidden="true" />
          <span className="farm-map-page__header-btn-label">Perímetro</span>
        </button>

        <button
          type="button"
          className="farm-map-page__header-btn"
          onClick={handleOpenFarmBoundaryHistory}
          aria-label="Histórico de perímetro"
        >
          <Clock size={20} aria-hidden="true" />
          <span className="farm-map-page__header-btn-label">Histórico</span>
        </button>

        <button
          type="button"
          className="farm-map-page__header-btn"
          onClick={() => setShowRegistrations(true)}
          aria-label="Matrículas"
        >
          <FileText size={20} aria-hidden="true" />
          <span className="farm-map-page__header-btn-label">Matrículas</span>
        </button>

        <button
          type="button"
          className="farm-map-page__header-btn"
          onClick={() => setShowProducers(true)}
          aria-label="Produtores"
        >
          <Users size={20} aria-hidden="true" />
          <span className="farm-map-page__header-btn-label">Produtores</span>
        </button>

        <button
          type="button"
          className="farm-map-page__header-btn"
          onClick={() => setIsCreatePlotOpen(true)}
          aria-label="Novo talhão"
        >
          <Plus size={20} aria-hidden="true" />
          <span className="farm-map-page__header-btn-label">Novo talhão</span>
        </button>

        <button
          type="button"
          className="farm-map-page__header-btn"
          onClick={() => setIsMergeMode(true)}
          aria-label="Mesclar talhões"
        >
          <Combine size={20} aria-hidden="true" />
          <span className="farm-map-page__header-btn-label">Mesclar talhões</span>
        </button>

        <button
          type="button"
          className="farm-map-page__header-btn"
          onClick={() => setIsBulkImportOpen(true)}
          aria-label="Importar talhões"
        >
          <Upload size={20} aria-hidden="true" />
          <span className="farm-map-page__header-btn-label">Importar talhões</span>
        </button>
      </header>

      <div className="farm-map-page__map-wrapper">
        <FarmMap
          data={data}
          baseMap={baseMap}
          showFarmBoundary={showFarmBoundary}
          showRegistrations={showRegistrationLayer}
          showPlots={showPlots}
          onPlotClick={handlePlotClick}
          cropFilter={cropFilter}
          versionOverlay={versionOverlay}
        />
        <BaseMapSelector selected={baseMap} onChange={setBaseMap} />
        <LayerControlPanel layers={layers} onToggle={handleToggleLayer} />

        {showPlots && data.plotBoundaries.length > 0 && (
          <CropLegend
            plotBoundaries={data.plotBoundaries}
            cropFilter={cropFilter}
            onToggleCrop={handleToggleCrop}
          />
        )}

        {showPlots && data.plotBoundaries.length > 0 && (
          <PlotSummaryBar
            plotBoundaries={data.plotBoundaries}
            farmTotalAreaHa={Number(data.farm.totalAreaHa)}
          />
        )}

        <PlotDetailsPanel
          plot={selectedPlot}
          onClose={() => setSelectedPlot(null)}
          onEditAttributes={handleEditAttributes}
          onEditGeometry={handleEditGeometry}
          onSubdivide={handleSubdivide}
          onViewHistory={handleViewHistory}
        />

        {historyPlot && farmId && (
          <Suspense fallback={null}>
            <PlotHistoryPanel
              plot={historyPlot}
              farmId={farmId}
              onClose={() => setHistoryPlot(null)}
            />
          </Suspense>
        )}

        {editingPlot && (
          <Suspense fallback={null}>
            <PlotGeometryEditor
              plot={editingPlot.plot}
              plotBoundary={editingPlot.boundary}
              farmBoundary={data.farmBoundary.boundaryGeoJSON}
              otherPlots={data.plotBoundaries.filter((pb) => pb.plotId !== editingPlot.plot.id)}
              onSave={handleEditorSave}
              onCancel={handleCancelEditor}
            />
          </Suspense>
        )}

        {pendingSave && (
          <Suspense fallback={null}>
            <ConfirmBoundaryEdit
              previousAreaHa={pendingSave.previousAreaHa}
              newAreaHa={pendingSave.newAreaHa}
              onConfirm={() => void handleConfirmSave()}
              onCancel={handleCancelSave}
            />
          </Suspense>
        )}

        {subdividingPlot && farmId && (
          <Suspense fallback={null}>
            <PlotSubdivideEditor
              plot={subdividingPlot.plot}
              plotBoundary={subdividingPlot.boundary}
              farmBoundary={data.farmBoundary.boundaryGeoJSON}
              otherPlots={data.plotBoundaries.filter((pb) => pb.plotId !== subdividingPlot.plot.id)}
              farmId={farmId}
              onComplete={handleSubdivideComplete}
              onCancel={() => setSubdividingPlot(null)}
            />
          </Suspense>
        )}

        {isMergeMode && farmId && (
          <Suspense fallback={null}>
            <PlotMergeEditor
              plotBoundaries={data.plotBoundaries}
              farmBoundary={data.farmBoundary.boundaryGeoJSON}
              farmId={farmId}
              onComplete={handleMergeComplete}
              onCancel={() => setIsMergeMode(false)}
            />
          </Suspense>
        )}

        {showRegistrations && (
          <Suspense fallback={null}>
            <RegistrationsPanel
              registrations={data.farm.registrations}
              farmTotalAreaHa={Number(data.farm.totalAreaHa)}
              areaDivergence={areaDivergence}
              isLoading={false}
              onAdd={() => handleOpenRegForm()}
              onEdit={(reg) => handleOpenRegForm(reg)}
              onDelete={handleDeleteRegistration}
              onUploadBoundary={handleUploadRegBoundary}
              onViewBoundaryHistory={handleOpenRegBoundaryHistory}
              onClose={() => setShowRegistrations(false)}
            />
          </Suspense>
        )}

        {showProducers && farmId && (
          <Suspense fallback={null}>
            <FarmProducersPanel farmId={farmId} onClose={() => setShowProducers(false)} />
          </Suspense>
        )}

        {boundaryVersionsTarget && farmId && (
          <Suspense fallback={null}>
            <BoundaryVersionsPanel
              farmId={farmId}
              registrationId={boundaryVersionsTarget.registrationId}
              entityLabel={boundaryVersionsTarget.entityLabel}
              onClose={handleCloseBoundaryVersions}
              onPreviewVersion={setVersionOverlay}
            />
          </Suspense>
        )}
      </div>

      {isCreatePlotOpen && farmId && (
        <Suspense fallback={null}>
          <CreatePlotModal
            isOpen={isCreatePlotOpen}
            farmId={farmId}
            registrations={data.farm.registrations}
            onClose={() => setIsCreatePlotOpen(false)}
            onSuccess={handleImportComplete}
          />
        </Suspense>
      )}

      {editingPlotAttributes && farmId && (
        <Suspense fallback={null}>
          <EditPlotModal
            plot={editingPlotAttributes}
            farmId={farmId}
            registrations={data.farm.registrations}
            onClose={() => setEditingPlotAttributes(null)}
            onSuccess={() => {
              setEditingPlotAttributes(null);
              void refetch();
            }}
          />
        </Suspense>
      )}

      {isBulkImportOpen && farmId && (
        <Suspense fallback={null}>
          <BulkImportModal
            isOpen={isBulkImportOpen}
            farmId={farmId}
            farmBoundary={data.farmBoundary.boundaryGeoJSON}
            onClose={() => setIsBulkImportOpen(false)}
            onImportComplete={handleImportComplete}
          />
        </Suspense>
      )}

      {isBoundaryUploadOpen && farmId && (
        <Suspense fallback={null}>
          <BoundaryUploadModal
            isOpen={isBoundaryUploadOpen}
            farmId={farmId}
            farmTotalAreaHa={Number(data.farm.totalAreaHa)}
            existingBoundary={data.farmBoundary.boundaryGeoJSON}
            onClose={() => setIsBoundaryUploadOpen(false)}
            onUploadComplete={handleImportComplete}
          />
        </Suspense>
      )}

      {uploadingBoundaryReg && farmId && (
        <Suspense fallback={null}>
          <BoundaryUploadModal
            isOpen={!!uploadingBoundaryReg}
            farmId={farmId}
            farmTotalAreaHa={Number(data.farm.totalAreaHa)}
            registrationId={uploadingBoundaryReg.id}
            referenceAreaHa={uploadingBoundaryReg.areaHa}
            entityLabel={`da matrícula ${uploadingBoundaryReg.number}`}
            existingBoundary={
              data.registrationBoundaries.find(
                (rb) => rb.registrationId === uploadingBoundaryReg.id,
              )?.boundary.boundaryGeoJSON ?? null
            }
            onClose={() => setUploadingBoundaryReg(null)}
            onUploadComplete={handleImportComplete}
          />
        </Suspense>
      )}

      {isRegFormOpen && (
        <Suspense fallback={null}>
          <RegistrationFormModal
            isOpen={isRegFormOpen}
            onClose={handleCloseRegForm}
            onSubmit={handleRegFormSubmit}
            registration={editingRegistration}
            isSubmitting={isRegSubmitting}
            submitError={regSubmitError}
          />
        </Suspense>
      )}
    </div>
  );
}

export default FarmMapPage;
