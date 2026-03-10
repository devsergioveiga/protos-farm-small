import { useState, useEffect, useCallback } from 'react';
import { BarChart3, AlertCircle, Calendar } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import './CostByPlotTab.css';

interface PlotLaborCostItem {
  fieldPlotId: string;
  fieldPlotName: string;
  operationCount: number;
  totalHours: number;
  totalLaborCost: number;
  entries: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CostByPlotTab() {
  const { selectedFarmId } = useFarmContext();
  const [data, setData] = useState<PlotLaborCostItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    if (!selectedFarmId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      const qs = query.toString();
      const path = `/org/farms/${selectedFarmId}/team-operations/cost-by-plot${qs ? `?${qs}` : ''}`;
      const result = await api.get<PlotLaborCostItem[]>(path);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar custos');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const grandTotal = data.reduce((sum, d) => sum + d.totalLaborCost, 0);

  return (
    <div className="cost-plot">
      <div className="cost-plot__filters">
        <div className="cost-plot__field">
          <label htmlFor="cost-from" className="cost-plot__label">
            <Calendar size={14} aria-hidden="true" />
            De
          </label>
          <input
            id="cost-from"
            type="date"
            className="cost-plot__input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="cost-plot__field">
          <label htmlFor="cost-to" className="cost-plot__label">
            <Calendar size={14} aria-hidden="true" />
            Até
          </label>
          <input
            id="cost-to"
            type="date"
            className="cost-plot__input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="cost-plot__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="cost-plot__skeleton-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="cost-plot__skeleton" />
          ))}
        </div>
      )}

      {data.length === 0 && !isLoading && !error && (
        <div className="cost-plot__empty">
          <BarChart3 size={48} aria-hidden="true" />
          <h3 className="cost-plot__empty-title">Sem dados de custo</h3>
          <p className="cost-plot__empty-desc">
            Cadastre o custo/hora dos colaboradores e registre operações para ver os custos por
            talhão.
          </p>
        </div>
      )}

      {data.length > 0 && !isLoading && (
        <>
          <div className="cost-plot__total">
            <span className="cost-plot__total-label">Custo total de MO</span>
            <span className="cost-plot__total-value">{formatCurrency(grandTotal)}</span>
          </div>

          <div
            className="cost-plot__list"
            role="table"
            aria-label="Custo de mão de obra por talhão"
          >
            <div className="cost-plot__row cost-plot__row--header" role="row">
              <span role="columnheader">Talhão</span>
              <span role="columnheader">Operações</span>
              <span role="columnheader">Horas</span>
              <span role="columnheader">Apontamentos</span>
              <span role="columnheader">Custo MO</span>
            </div>
            {data.map((item) => (
              <div key={item.fieldPlotId} className="cost-plot__row" role="row">
                <span className="cost-plot__plot-name" role="cell">
                  {item.fieldPlotName}
                </span>
                <span className="cost-plot__cell" role="cell">
                  {item.operationCount}
                </span>
                <span className="cost-plot__cell cost-plot__cell--mono" role="cell">
                  {item.totalHours}h
                </span>
                <span className="cost-plot__cell" role="cell">
                  {item.entries}
                </span>
                <span className="cost-plot__cell cost-plot__cell--cost" role="cell">
                  {formatCurrency(item.totalLaborCost)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default CostByPlotTab;
