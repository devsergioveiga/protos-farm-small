import { ArrowUp, ArrowDown, Minus, Pencil, Trash2 } from 'lucide-react';
import type { SoilAnalysisItem } from '@/types/farm';
import './PlotSoilTable.css';

interface PlotSoilTableProps {
  analyses: SoilAnalysisItem[];
  onEdit?: (analysis: SoilAnalysisItem) => void;
  onDelete?: (analysis: SoilAnalysisItem) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatVal(val: number | null): string {
  if (val == null) return '—';
  return val.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

interface DeltaProps {
  current: number | null;
  previous: number | null;
}

function Delta({ current, previous }: DeltaProps) {
  if (current == null || previous == null) return null;

  const diff = current - previous;
  if (Math.abs(diff) < 0.01) {
    return <Minus size={12} aria-hidden="true" className="soil-delta soil-delta--neutral" />;
  }
  if (diff > 0) {
    return <ArrowUp size={12} aria-hidden="true" className="soil-delta soil-delta--up" />;
  }
  return <ArrowDown size={12} aria-hidden="true" className="soil-delta soil-delta--down" />;
}

const PARAMS: Array<{ key: keyof SoilAnalysisItem; label: string; unit: string }> = [
  { key: 'phH2o', label: 'pH', unit: '' },
  { key: 'organicMatterPct', label: 'MO', unit: '%' },
  { key: 'phosphorusMgDm3', label: 'P', unit: 'mg/dm\u00b3' },
  { key: 'potassiumMgDm3', label: 'K', unit: 'mg/dm\u00b3' },
  { key: 'calciumCmolcDm3', label: 'Ca', unit: 'cmolc/dm\u00b3' },
  { key: 'magnesiumCmolcDm3', label: 'Mg', unit: 'cmolc/dm\u00b3' },
  { key: 'aluminumCmolcDm3', label: 'Al', unit: 'cmolc/dm\u00b3' },
  { key: 'ctcCmolcDm3', label: 'CTC', unit: 'cmolc/dm\u00b3' },
  { key: 'baseSaturationPct', label: 'V%', unit: '%' },
  { key: 'clayContentPct', label: 'Argila', unit: '%' },
];

function PlotSoilTable({ analyses, onEdit, onDelete }: PlotSoilTableProps) {
  const hasActions = !!onEdit || !!onDelete;

  if (analyses.length === 0) {
    return (
      <div className="soil-table__empty">
        <p className="soil-table__empty-text">Nenhuma análise de solo registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="soil-table__wrapper">
      {/* Desktop: table */}
      <table className="soil-table" aria-label="Análises de solo">
        <caption className="sr-only">Histórico de análises de solo do talhão</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            {PARAMS.map((p) => (
              <th key={p.key} scope="col" title={p.unit ? `${p.label} (${p.unit})` : p.label}>
                {p.label}
              </th>
            ))}
            {hasActions && (
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {analyses.map((analysis, idx) => {
            const prev = idx < analyses.length - 1 ? analyses[idx + 1] : null;
            return (
              <tr key={analysis.id}>
                <td className="soil-table__date">{formatDate(analysis.analysisDate)}</td>
                {PARAMS.map((p) => (
                  <td key={p.key} className="soil-table__value">
                    <span>{formatVal(analysis[p.key] as number | null)}</span>
                    {prev && (
                      <Delta
                        current={analysis[p.key] as number | null}
                        previous={prev[p.key] as number | null}
                      />
                    )}
                  </td>
                ))}
                {hasActions && (
                  <td className="soil-table__actions">
                    {onEdit && (
                      <button
                        type="button"
                        className="soil-table__action-btn"
                        onClick={() => onEdit(analysis)}
                        aria-label={`Editar análise de ${formatDate(analysis.analysisDate)}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className="soil-table__action-btn soil-table__action-btn--danger"
                        onClick={() => onDelete(analysis)}
                        aria-label={`Excluir análise de ${formatDate(analysis.analysisDate)}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile: cards */}
      <div className="soil-cards" aria-label="Análises de solo">
        {analyses.map((analysis, idx) => {
          const prev = idx < analyses.length - 1 ? analyses[idx + 1] : null;
          return (
            <div key={analysis.id} className="soil-card">
              <div className="soil-card__header">
                <span className="soil-card__date">{formatDate(analysis.analysisDate)}</span>
                <div className="soil-card__header-right">
                  {analysis.labName && <span className="soil-card__lab">{analysis.labName}</span>}
                  {hasActions && (
                    <div className="soil-card__actions">
                      {onEdit && (
                        <button
                          type="button"
                          className="soil-table__action-btn"
                          onClick={() => onEdit(analysis)}
                          aria-label={`Editar análise de ${formatDate(analysis.analysisDate)}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="soil-table__action-btn soil-table__action-btn--danger"
                          onClick={() => onDelete(analysis)}
                          aria-label={`Excluir análise de ${formatDate(analysis.analysisDate)}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <dl className="soil-card__params">
                {PARAMS.map((p) => {
                  const val = analysis[p.key] as number | null;
                  if (val == null) return null;
                  return (
                    <div key={p.key} className="soil-card__param">
                      <dt>{p.label}</dt>
                      <dd>
                        <span className="soil-card__val">{formatVal(val)}</span>
                        {p.unit && <span className="soil-card__unit">{p.unit}</span>}
                        {prev && <Delta current={val} previous={prev[p.key] as number | null} />}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlotSoilTable;
