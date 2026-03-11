import { useState, useEffect, useCallback } from 'react';
import { DollarSign, AlertCircle, Calendar } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { TEAM_OPERATION_TYPES } from '@/types/team-operation';
import './BonificationTab.css';

interface BonificationEntry {
  userId: string;
  userName: string;
  userEmail: string;
  operationType: string;
  operationTypeLabel: string;
  totalProductivity: number;
  productivityUnit: string;
  ratePerUnit: number;
  bonificationValue: number;
  operationCount: number;
}

interface BonificationSummary {
  entries: BonificationEntry[];
  totalBonification: number;
  period: { dateFrom: string | null; dateTo: string | null };
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function BonificationTab() {
  const { selectedFarmId } = useFarmContext();
  const [data, setData] = useState<BonificationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [operationType, setOperationType] = useState('');

  const fetchData = useCallback(async () => {
    if (!selectedFarmId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      if (operationType) query.set('operationType', operationType);
      const qs = query.toString();
      const path = `/org/farms/${selectedFarmId}/team-operations/bonification${qs ? `?${qs}` : ''}`;
      const result = await api.get<BonificationSummary>(path);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao calcular bonificação');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, dateFrom, dateTo, operationType]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="bonif">
      <div className="bonif__filters">
        <div className="bonif__field">
          <label htmlFor="bonif-type" className="bonif__label">
            Tipo de operação
          </label>
          <select
            id="bonif-type"
            className="bonif__select"
            value={operationType}
            onChange={(e) => setOperationType(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            {TEAM_OPERATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="bonif__field">
          <label htmlFor="bonif-from" className="bonif__label">
            <Calendar size={14} aria-hidden="true" />
            De
          </label>
          <input
            id="bonif-from"
            type="date"
            className="bonif__input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="bonif__field">
          <label htmlFor="bonif-to" className="bonif__label">
            <Calendar size={14} aria-hidden="true" />
            Até
          </label>
          <input
            id="bonif-to"
            type="date"
            className="bonif__input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bonif__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="bonif__skeleton-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bonif__skeleton" />
          ))}
        </div>
      )}

      {data && data.entries.length === 0 && !isLoading && !error && (
        <div className="bonif__empty">
          <DollarSign size={48} aria-hidden="true" />
          <h3 className="bonif__empty-title">Sem bonificações no período</h3>
          <p className="bonif__empty-desc">
            Configure metas com valor de bonificação (R$/unidade) na aba Produtividade e registre
            produtividade individual nas operações.
          </p>
        </div>
      )}

      {data && data.entries.length > 0 && !isLoading && (
        <>
          <div className="bonif__total">
            <span className="bonif__total-label">Total de bonificações</span>
            <span className="bonif__total-value">{formatCurrency(data.totalBonification)}</span>
          </div>

          <div className="bonif__list" role="table" aria-label="Bonificações por colaborador">
            <div className="bonif__row bonif__row--header" role="row">
              <span role="columnheader" className="bonif__col-name">
                Colaborador
              </span>
              <span role="columnheader">Atividade</span>
              <span role="columnheader">Produção</span>
              <span role="columnheader">Valor/un.</span>
              <span role="columnheader">Bonificação</span>
            </div>
            {data.entries.map((entry) => (
              <div
                key={`${entry.userId}-${entry.operationType}-${entry.productivityUnit}`}
                className="bonif__row"
                role="row"
              >
                <span className="bonif__col-name" role="cell">
                  <span className="bonif__user-name">{entry.userName}</span>
                  <span className="bonif__user-email">{entry.userEmail}</span>
                </span>
                <span className="bonif__cell" role="cell">
                  {entry.operationTypeLabel}
                </span>
                <span className="bonif__cell bonif__cell--mono" role="cell">
                  {entry.totalProductivity.toLocaleString('pt-BR')} {entry.productivityUnit}
                </span>
                <span className="bonif__cell bonif__cell--mono" role="cell">
                  R$ {entry.ratePerUnit.toLocaleString('pt-BR')}/{entry.productivityUnit}
                </span>
                <span className="bonif__cell bonif__cell--value" role="cell">
                  {formatCurrency(entry.bonificationValue)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default BonificationTab;
