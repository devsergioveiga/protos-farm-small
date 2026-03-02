import { useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useFarmMap } from '@/hooks/useFarmMap';
import FarmMap from '@/components/map/FarmMap';
import BaseMapSelector, { type BaseMapType } from '@/components/map/BaseMapSelector';
import LayerControlPanel, { type LayerConfig } from '@/components/map/LayerControlPanel';
import './FarmMapPage.css';

const DEFAULT_LAYERS: LayerConfig[] = [
  { id: 'perimeter', label: 'Perímetro', enabled: true },
  { id: 'registrations', label: 'Matrículas', enabled: true },
  { id: 'plots', label: 'Talhões', enabled: false, disabled: true, futureLabel: 'Em breve' },
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
  const { data, isLoading, error } = useFarmMap(farmId);
  const [baseMap, setBaseMap] = useState<BaseMapType>('satellite');
  const [layers, setLayers] = useState<LayerConfig[]>(DEFAULT_LAYERS);

  const handleToggleLayer = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId && !l.disabled ? { ...l, enabled: !l.enabled } : l)),
    );
  }, []);

  const showFarmBoundary = layers.find((l) => l.id === 'perimeter')?.enabled ?? true;
  const showRegistrations = layers.find((l) => l.id === 'registrations')?.enabled ?? true;

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
      </header>

      <div className="farm-map-page__map-wrapper">
        <FarmMap
          data={data}
          baseMap={baseMap}
          showFarmBoundary={showFarmBoundary}
          showRegistrations={showRegistrations}
        />
        <BaseMapSelector selected={baseMap} onChange={setBaseMap} />
        <LayerControlPanel layers={layers} onToggle={handleToggleLayer} />
      </div>
    </div>
  );
}

export default FarmMapPage;
