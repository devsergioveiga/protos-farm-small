import {
  ShoppingCart,
  TrendingDown,
  Calculator,
  Wrench,
  Fuel,
  Shield,
  DollarSign,
} from 'lucide-react';
import { useAssetOperationalCost } from '@/hooks/useAssetOperationalCost';
import './AssetCostTab.css';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── AssetCostTab ─────────────────────────────────────────────────────

interface AssetCostTabProps {
  assetId: string;
}

export default function AssetCostTab({ assetId }: AssetCostTabProps) {
  const { data, loading, error } = useAssetOperationalCost(assetId);

  if (loading) {
    return (
      <div className="cost-tab" role="status" aria-label="Carregando custo operacional">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="cost-tab__skeleton" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="cost-tab">
        <p className="cost-tab__error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cost-tab">
        <div className="cost-tab__empty">
          <DollarSign size={48} aria-hidden="true" className="cost-tab__empty-icon" />
          <p className="cost-tab__empty-text">Nenhum dado de custo disponível.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cost-tab">
      {/* Section 1: Composição do Custo */}
      <section aria-labelledby="cost-breakdown-title">
        <h3 id="cost-breakdown-title" className="cost-tab__section-title">
          Composição do Custo
        </h3>
        <dl className="cost-tab__dl">
          <div className="cost-tab__row">
            <dt className="cost-tab__row-label">
              <ShoppingCart size={20} aria-hidden="true" />
              Valor de Aquisição
            </dt>
            <dd className="cost-tab__row-value">{formatBRL(data.acquisitionValue)}</dd>
          </div>

          <div className="cost-tab__row">
            <dt className="cost-tab__row-label">
              <TrendingDown size={20} aria-hidden="true" />
              Depreciação Acumulada
            </dt>
            <dd className="cost-tab__row-value cost-tab__row-value--negative">
              -{formatBRL(data.accumulatedDepreciation)}
            </dd>
          </div>

          <div className="cost-tab__row">
            <dt className="cost-tab__row-label">
              <Calculator size={20} aria-hidden="true" />
              Valor Contábil Líquido
            </dt>
            <dd className="cost-tab__row-value cost-tab__row-value--bold">
              {formatBRL(data.netBookValue)}
            </dd>
          </div>

          <div className="cost-tab__row">
            <dt className="cost-tab__row-label">
              <Wrench size={20} aria-hidden="true" />
              Manutenção
            </dt>
            <dd className="cost-tab__row-value">{formatBRL(data.maintenanceCost)}</dd>
          </div>

          <div className="cost-tab__row">
            <dt className="cost-tab__row-label">
              <Fuel size={20} aria-hidden="true" />
              Combustível
              <span className="cost-tab__row-annotation">({data.fuelRecordCount} registros)</span>
            </dt>
            <dd className="cost-tab__row-value">{formatBRL(data.fuelCost)}</dd>
          </div>

          <div className="cost-tab__row">
            <dt className="cost-tab__row-label">
              <Shield size={20} aria-hidden="true" />
              Seguro
            </dt>
            <dd className="cost-tab__row-value">
              N/D
              <span className="cost-tab__row-note">Custo de seguro não disponível</span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Section 2: Indicadores */}
      <section aria-labelledby="cost-metrics-title">
        <h3 id="cost-metrics-title" className="cost-tab__section-title">
          Indicadores
        </h3>
        <div className="cost-tab__cards">
          <div className="cost-tab__card">
            <div className="cost-tab__card-value">{formatBRL(data.totalLifetimeCost)}</div>
            <div className="cost-tab__card-label">Custo Total de Vida</div>
          </div>

          <div className="cost-tab__card">
            <div className="cost-tab__card-value">{formatBRL(data.totalOperationalCost)}</div>
            <div className="cost-tab__card-label">Custo Operacional</div>
            <div className="cost-tab__card-subtitle">manutenção + combustível</div>
          </div>

          <div className="cost-tab__card">
            <div className="cost-tab__card-value">
              {data.costPerHour !== null ? formatBRL(data.costPerHour) : 'N/D'}
            </div>
            <div className="cost-tab__card-label">Custo/Hora</div>
            <div className="cost-tab__card-subtitle">
              {data.costPerHour !== null
                ? `(${data.currentHourmeter?.toLocaleString('pt-BR')} horas)`
                : 'Sem leitura de horímetro'}
            </div>
          </div>
        </div>
      </section>

      {/* Notes */}
      {data.notes.length > 0 && (
        <div className="cost-tab__note">
          {data.notes.map((note, i) => (
            <p key={i}>{note}</p>
          ))}
        </div>
      )}
    </div>
  );
}
