import { AlertTriangle, AlertCircle } from 'lucide-react';
import './TCOFleetView.css';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TCOFleetRow {
  assetId: string;
  assetName: string;
  assetTag: string;
  assetType: string;
  acquisitionValue: number;
  accumulatedDepreciation: number;
  maintenanceCost: number;
  fuelCost: number;
  totalCost: number;
  repairRatio: number | null;
  alert: 'OK' | 'MONITOR' | 'REPLACE' | 'NO_DATA';
  costPerHour: number | null;
}

interface TCOFleetViewProps {
  data: TCOFleetRow[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatBRL(value: number): string {
  return currencyFmt.format(value);
}

function getAlertLabel(alert: TCOFleetRow['alert']): string {
  switch (alert) {
    case 'OK': return 'OK';
    case 'MONITOR': return 'Monitorar';
    case 'REPLACE': return 'Substituir';
    case 'NO_DATA': return 'Sem dados';
  }
}

function getAlertAriaLabel(alert: TCOFleetRow['alert'], assetName: string): string {
  switch (alert) {
    case 'OK': return `${assetName}: status OK`;
    case 'MONITOR': return `${assetName}: Alerta — Monitorar, custo de manutencao acima de 60% do valor de aquisicao`;
    case 'REPLACE': return `${assetName}: Alerta — Substituir, custo de manutencao critico`;
    case 'NO_DATA': return `${assetName}: Sem dados suficientes para calcular alerta`;
  }
}

// ─── Badge ──────────────────────────────────────────────────────────────────

function AlertBadge({ row }: { row: TCOFleetRow }) {
  const badgeClass = {
    OK: 'tco-fleet__badge--ok',
    MONITOR: 'tco-fleet__badge--monitor',
    REPLACE: 'tco-fleet__badge--replace',
    NO_DATA: 'tco-fleet__badge--no-data',
  }[row.alert];

  return (
    <span
      className={`tco-fleet__badge ${badgeClass}`}
      aria-label={getAlertAriaLabel(row.alert, row.assetName)}
    >
      {row.alert === 'MONITOR' && <AlertTriangle size={16} aria-hidden="true" />}
      {row.alert === 'REPLACE' && <AlertCircle size={16} aria-hidden="true" />}
      {getAlertLabel(row.alert)}
    </span>
  );
}

// ─── Group assets by type ──────────────────────────────────────────────────

function groupByType(rows: TCOFleetRow[]): Record<string, TCOFleetRow[]> {
  return rows.reduce<Record<string, TCOFleetRow[]>>((acc, row) => {
    const key = row.assetType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function TCOFleetView({ data }: TCOFleetViewProps) {
  const groups = groupByType(data);

  return (
    <div className="tco-fleet">
      {/* Desktop table */}
      <table className="tco-fleet__table">
        <caption className="sr-only">Custo total de propriedade da frota por ativo</caption>
        <thead>
          <tr>
            <th scope="col" className="tco-fleet__th">Ativo</th>
            <th scope="col" className="tco-fleet__th">Tipo</th>
            <th scope="col" className="tco-fleet__th">Aquisicao</th>
            <th scope="col" className="tco-fleet__th">Depr</th>
            <th scope="col" className="tco-fleet__th">Manutencao</th>
            <th scope="col" className="tco-fleet__th">Combustivel</th>
            <th scope="col" className="tco-fleet__th">TCO Total</th>
            <th scope="col" className="tco-fleet__th">Alerta</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.assetId}>
              <td className="tco-fleet__td">
                <div>{row.assetName}</div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>{row.assetTag}</div>
              </td>
              <td className="tco-fleet__td">{row.assetType}</td>
              <td className="tco-fleet__td tco-fleet__td--mono">{formatBRL(row.acquisitionValue)}</td>
              <td className="tco-fleet__td tco-fleet__td--mono">{formatBRL(row.accumulatedDepreciation)}</td>
              <td className="tco-fleet__td tco-fleet__td--mono">{formatBRL(row.maintenanceCost)}</td>
              <td className="tco-fleet__td tco-fleet__td--mono">{formatBRL(row.fuelCost)}</td>
              <td className="tco-fleet__td tco-fleet__td--mono">
                <strong>{formatBRL(row.totalCost)}</strong>
              </td>
              <td className="tco-fleet__td">
                <AlertBadge row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards grouped by type */}
      <div className="tco-fleet__cards">
        {Object.entries(groups).map(([type, rows]) => (
          <details key={type} className="tco-fleet__group" open>
            <summary>
              {type} ({rows.length})
            </summary>
            {rows.map((row) => (
              <div key={row.assetId} className="tco-fleet__card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-neutral-800)' }}>{row.assetName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>{row.assetTag}</div>
                  </div>
                  <AlertBadge row={row} />
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700 }}>
                  {formatBRL(row.totalCost)}
                </div>
                <div style={{ fontSize: 14, color: 'var(--color-neutral-500)' }}>TCO Total</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>Manutencao</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>{formatBRL(row.maintenanceCost)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>Combustivel</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>{formatBRL(row.fuelCost)}</div>
                  </div>
                </div>
              </div>
            ))}
          </details>
        ))}
      </div>
    </div>
  );
}
