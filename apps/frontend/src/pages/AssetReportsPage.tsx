import { useState } from 'react';
import {
  BarChart3,
  Layers,
  FileText,
  AlertCircle,
  AlertTriangle,
  Link as LinkIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAssetReports } from '@/hooks/useAssetReports';
import { useDepreciationProjection } from '@/hooks/useDepreciationProjection';
import { useTCOFleet } from '@/hooks/useTCOFleet';
import CostCenterWizardModal from '@/components/cost-centers/CostCenterWizardModal';
import DepreciationProjectionChart from '@/components/assets/DepreciationProjectionChart';
import TCOFleetView from '@/components/assets/TCOFleetView';
import './AssetReportsPage.css';

// ─── Helpers ───────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatBRL(value: number): string {
  return currencyFmt.format(value);
}

// ─── Skeleton components ───────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div
      className="asset-reports__kpi-grid"
      role="status"
      aria-label="Carregando indicadores"
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="asset-reports__skeleton-card" />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div role="status" aria-label="Carregando tabela">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="asset-reports__skeleton-row" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="asset-reports__skeleton-chart"
      role="status"
      aria-label="Carregando grafico"
    />
  );
}

// ─── Tab: Inventario ──────────────────────────────────────────────────────

type HorizonMonths = 12 | 36 | 60;

function InventarioTab() {
  const { data, isLoading, error, exportReport } = useAssetReports();

  if (error) {
    return (
      <div className="asset-reports__error" role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        {' '}
        Nao foi possivel carregar o relatorio. Verifique sua conexao e tente novamente.
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <>
        <KpiSkeleton />
        <TableSkeleton />
      </>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="asset-reports__empty">
        <BarChart3 size={48} aria-hidden="true" className="asset-reports__empty-icon" />
        <h2 className="asset-reports__empty-title">Nenhum ativo cadastrado ainda</h2>
        <p className="asset-reports__empty-desc">
          Cadastre ativos para ver os relatorios patrimoniais.
        </p>
        <Link to="/assets" className="asset-reports__empty-cta">
          Ir para Ativos
        </Link>
      </div>
    );
  }

  const { totals, rows } = data;

  return (
    <>
      {/* KPI cards */}
      <div className="asset-reports__kpi-grid" aria-label="Indicadores de inventario">
        <div className="asset-reports__kpi-card">
          <span className="asset-reports__kpi-label">Valor Bruto Total</span>
          <span className="asset-reports__kpi-value">
            {formatBRL(totals.grossValue)}
          </span>
        </div>
        <div className="asset-reports__kpi-card">
          <span className="asset-reports__kpi-label">Depreciacao Acumulada</span>
          <span className="asset-reports__kpi-value asset-reports__kpi-value--loss">
            {formatBRL(totals.accumulatedDepreciation)}
          </span>
        </div>
        <div className="asset-reports__kpi-card">
          <span className="asset-reports__kpi-label">Valor Liquido</span>
          <span className="asset-reports__kpi-value asset-reports__kpi-value--gain">
            {formatBRL(totals.netBookValue)}
          </span>
        </div>
        <div className="asset-reports__kpi-card">
          <span className="asset-reports__kpi-label">Qtd Ativos</span>
          <span className="asset-reports__kpi-value">{totals.count}</span>
        </div>
      </div>

      {/* Export toolbar */}
      <div className="asset-reports__export-bar">
        <button
          type="button"
          className="asset-reports__export-btn"
          onClick={() => void exportReport('pdf')}
          aria-label="Exportar como PDF"
        >
          <FileText size={16} aria-hidden="true" />
          PDF
        </button>
        <button
          type="button"
          className="asset-reports__export-btn"
          onClick={() => void exportReport('xlsx')}
          aria-label="Exportar como Excel"
        >
          <LinkIcon size={16} aria-hidden="true" />
          Excel
        </button>
        <button
          type="button"
          className="asset-reports__export-btn"
          onClick={() => void exportReport('csv')}
          aria-label="Exportar como CSV"
        >
          <FileText size={16} aria-hidden="true" />
          CSV
        </button>
      </div>

      {/* Classification table */}
      <div className="asset-reports__table-wrapper">
        <table className="asset-reports__table">
          <caption className="sr-only">Inventario patrimonial por classificacao</caption>
          <thead>
            <tr>
              <th scope="col">Classificacao</th>
              <th scope="col">Qtd</th>
              <th scope="col">Valor Bruto</th>
              <th scope="col">Depr. Acumulada</th>
              <th scope="col">Valor Liquido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.classification}>
                <td>{row.classification}</td>
                <td>{row.count}</td>
                <td className="--mono">{formatBRL(row.grossValue)}</td>
                <td className="--mono">{formatBRL(row.accumulatedDepreciation)}</td>
                <td className="--mono">{formatBRL(row.netBookValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards (visible only on small screens via CSS) */}
        <div className="asset-reports__mobile-cards" aria-hidden="true">
          {rows.map((row) => (
            <div key={`m-${row.classification}`} className="asset-reports__mobile-card">
              <strong>{row.classification}</strong>
              <div>Qtd: {row.count}</div>
              <div>Valor Bruto: <span className="asset-reports__mono">{formatBRL(row.grossValue)}</span></div>
              <div>Depr: <span className="asset-reports__mono">{formatBRL(row.accumulatedDepreciation)}</span></div>
              <div>Liquido: <span className="asset-reports__mono">{formatBRL(row.netBookValue)}</span></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Tab: Depreciacao ─────────────────────────────────────────────────────

function DepreciacaoTab() {
  const [horizonMonths, setHorizonMonths] = useState<HorizonMonths>(12);
  const { data, isLoading, error } = useDepreciationProjection({ horizonMonths });

  if (error) {
    return (
      <div className="asset-reports__error" role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        {' '}
        Nao foi possivel carregar o relatorio. Verifique sua conexao e tente novamente.
      </div>
    );
  }

  const horizonOptions: HorizonMonths[] = [12, 36, 60];

  return (
    <>
      {/* Horizon selector */}
      <div className="asset-reports__horizon-selector" role="group" aria-label="Horizonte de projecao">
        {horizonOptions.map((h) => (
          <button
            key={h}
            type="button"
            className={`asset-reports__horizon-btn${horizonMonths === h ? ' asset-reports__horizon-btn--active' : ''}`}
            aria-pressed={horizonMonths === h}
            onClick={() => setHorizonMonths(h)}
          >
            {h} meses
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && !data && <ChartSkeleton />}

      {/* Estimated assets banner */}
      {data && data.assetsEstimated > 0 && (
        <div className="asset-reports__info-banner" role="note">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            Projecao estimada — ativos com metodo por horas/producao usam taxa linear como base.
          </span>
        </div>
      )}

      {/* Chart or empty */}
      {data && data.rows.length === 0 ? (
        <div className="asset-reports__empty">
          <BarChart3 size={48} aria-hidden="true" className="asset-reports__empty-icon" />
          <h2 className="asset-reports__empty-title">Sem dados de depreciacao</h2>
          <p className="asset-reports__empty-desc">
            Configure a depreciacao dos ativos para ver as projecoes.
          </p>
          <Link to="/depreciation" className="asset-reports__empty-cta">
            Ir para Depreciacao
          </Link>
        </div>
      ) : data ? (
        <DepreciationProjectionChart data={data.rows} />
      ) : null}
    </>
  );
}

// ─── Tab: TCO e Frota ─────────────────────────────────────────────────────

function TCOFleetTab() {
  const { data, isLoading, error } = useTCOFleet();

  if (error) {
    return (
      <div className="asset-reports__error" role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        {' '}
        Nao foi possivel carregar o relatorio. Verifique sua conexao e tente novamente.
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <>
        <div className="asset-reports__kpi-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="asset-reports__skeleton-card" />
          ))}
        </div>
        <TableSkeleton />
      </>
    );
  }

  if (!data || data.assets.length === 0) {
    return (
      <div className="asset-reports__empty">
        <BarChart3 size={48} aria-hidden="true" className="asset-reports__empty-icon" />
        <h2 className="asset-reports__empty-title">Sem dados de custo operacional</h2>
        <p className="asset-reports__empty-desc">
          Registre manutencoes e abastecimentos para calcular o TCO.
        </p>
        <Link to="/work-orders" className="asset-reports__empty-cta">
          Ver Ordens de Servico
        </Link>
      </div>
    );
  }

  const { summary, assets } = data;
  const costPerHourFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

  return (
    <>
      {/* Summary cards */}
      <div className="asset-reports__kpi-grid asset-reports__kpi-grid--3col">
        <div className="asset-reports__kpi-card">
          <span className="asset-reports__kpi-label">Custo Medio/Hora da Frota</span>
          <span className="asset-reports__kpi-value">
            {costPerHourFmt.format(summary.avgCostPerHour)}/h
          </span>
        </div>
        <div className="asset-reports__kpi-card">
          <span className="asset-reports__kpi-label">Custo Total de Manutencao</span>
          <span className="asset-reports__kpi-value">
            {formatBRL(summary.totalMaintenanceCost)}
          </span>
        </div>
        <div className="asset-reports__kpi-card">
          <span className="asset-reports__kpi-label">Custo Total de Combustivel</span>
          <span className="asset-reports__kpi-value">
            {formatBRL(summary.totalFuelCost)}
          </span>
        </div>
      </div>

      {/* Fleet view */}
      <TCOFleetView data={assets} />
    </>
  );
}

// ─── AssetReportsPage ─────────────────────────────────────────────────────

type Tab = 'inventory' | 'depreciation' | 'tco';

export default function AssetReportsPage() {
  const [tab, setTab] = useState<Tab>('inventory');
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <main className="asset-reports" id="main-content">
        {/* Breadcrumb */}
        <nav className="asset-reports__breadcrumb" aria-label="Caminho de navegacao">
          <span>Inicio</span>
          <span aria-hidden="true">&gt;</span>
          <span>Patrimonio</span>
          <span aria-hidden="true">&gt;</span>
          <span aria-current="page">Relatorios</span>
        </nav>

        {/* Header */}
        <header className="asset-reports__header">
          <div className="asset-reports__header-left">
            <BarChart3 size={24} aria-hidden="true" className="asset-reports__header-icon" />
            <h1 className="asset-reports__title">Relatorios Patrimoniais</h1>
          </div>
          <div className="asset-reports__actions">
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="asset-reports__btn-wizard"
            >
              <Layers size={20} aria-hidden="true" />
              Criar Centro de Custo
            </button>
          </div>
        </header>

        {/* Tabs */}
        <nav role="tablist" className="asset-reports__tabs" aria-label="Abas de relatorios">
          <button
            role="tab"
            type="button"
            aria-selected={tab === 'inventory'}
            className={`asset-reports__tab${tab === 'inventory' ? ' asset-reports__tab--active' : ''}`}
            onClick={() => setTab('inventory')}
            id="tab-inventory"
            aria-controls="panel-inventory"
          >
            Inventario
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={tab === 'depreciation'}
            className={`asset-reports__tab${tab === 'depreciation' ? ' asset-reports__tab--active' : ''}`}
            onClick={() => setTab('depreciation')}
            id="tab-depreciation"
            aria-controls="panel-depreciation"
          >
            Depreciacao
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={tab === 'tco'}
            className={`asset-reports__tab${tab === 'tco' ? ' asset-reports__tab--active' : ''}`}
            onClick={() => setTab('tco')}
            id="tab-tco"
            aria-controls="panel-tco"
          >
            TCO e Frota
          </button>
        </nav>

        {/* Tab panels */}
        <section
          role="tabpanel"
          id="panel-inventory"
          aria-labelledby="tab-inventory"
          className="asset-reports__panel"
          style={{ display: tab === 'inventory' ? 'block' : 'none' }}
        >
          <InventarioTab />
        </section>

        <section
          role="tabpanel"
          id="panel-depreciation"
          aria-labelledby="tab-depreciation"
          className="asset-reports__panel"
          style={{ display: tab === 'depreciation' ? 'block' : 'none' }}
        >
          <DepreciacaoTab />
        </section>

        <section
          role="tabpanel"
          id="panel-tco"
          aria-labelledby="tab-tco"
          className="asset-reports__panel"
          style={{ display: tab === 'tco' ? 'block' : 'none' }}
        >
          <TCOFleetTab />
        </section>
      </main>

      {/* Wizard modal */}
      <CostCenterWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => setWizardOpen(false)}
      />
    </>
  );
}
