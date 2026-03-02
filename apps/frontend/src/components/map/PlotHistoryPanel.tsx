import { useState } from 'react';
import { X } from 'lucide-react';
import { usePlotHistory } from '@/hooks/usePlotHistory';
import RotationBadge from './RotationBadge';
import PlotSeasonTimeline from './PlotSeasonTimeline';
import PlotSoilTable from './PlotSoilTable';
import PlotHistoryExport from './PlotHistoryExport';
import type { FieldPlot } from '@/types/farm';
import './PlotHistoryPanel.css';

interface PlotHistoryPanelProps {
  plot: FieldPlot;
  farmId: string;
  onClose: () => void;
}

type Tab = 'seasons' | 'soil' | 'export';

function PlotHistoryPanel({ plot, farmId, onClose }: PlotHistoryPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('seasons');
  const { data, isLoading, error } = usePlotHistory(farmId, plot.id);

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
              <PlotSeasonTimeline seasons={data.seasons} />
            </div>

            <div
              role="tabpanel"
              id="panel-soil"
              aria-labelledby="tab-soil"
              hidden={activeTab !== 'soil'}
            >
              <PlotSoilTable analyses={data.analyses} />
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
    </div>
  );
}

export default PlotHistoryPanel;
