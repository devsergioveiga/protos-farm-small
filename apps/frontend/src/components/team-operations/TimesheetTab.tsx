import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertCircle, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import './TimesheetTab.css';

interface TimesheetOperation {
  operationId: string;
  operationType: string;
  operationTypeLabel: string;
  fieldPlotName: string;
  timeStart: string;
  timeEnd: string;
  hoursWorked: number;
}

interface TimesheetEntry {
  date: string;
  userId: string;
  userName: string;
  userEmail: string;
  hourlyRate: number | null;
  operationCount: number;
  totalHours: number;
  totalLaborCost: number | null;
  operations: TimesheetOperation[];
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function TimesheetTab() {
  const { selectedFarmId } = useFarmContext();
  const [data, setData] = useState<TimesheetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!selectedFarmId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      const qs = query.toString();
      const path = `/org/farms/${selectedFarmId}/team-operations/timesheet${qs ? `?${qs}` : ''}`;
      const result = await api.get<TimesheetEntry[]>(path);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar espelho de ponto');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const toggleRow = useCallback((key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const grandTotalHours = data.reduce((sum, d) => sum + d.totalHours, 0);
  const costsAvailable = data.filter((d) => d.totalLaborCost != null);
  const grandTotalCost = costsAvailable.reduce((sum, d) => sum + (d.totalLaborCost ?? 0), 0);

  return (
    <div className="timesheet">
      <div className="timesheet__filters">
        <div className="timesheet__field">
          <label htmlFor="ts-from" className="timesheet__label">
            <Calendar size={14} aria-hidden="true" />
            De
          </label>
          <input
            id="ts-from"
            type="date"
            className="timesheet__input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="timesheet__field">
          <label htmlFor="ts-to" className="timesheet__label">
            <Calendar size={14} aria-hidden="true" />
            Até
          </label>
          <input
            id="ts-to"
            type="date"
            className="timesheet__input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="timesheet__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="timesheet__skeleton-list">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="timesheet__skeleton" />
          ))}
        </div>
      )}

      {data.length === 0 && !isLoading && !error && (
        <div className="timesheet__empty">
          <Clock size={48} aria-hidden="true" />
          <h3 className="timesheet__empty-title">Sem registros de ponto</h3>
          <p className="timesheet__empty-desc">
            Registre operações em bloco para gerar o espelho de ponto dos colaboradores.
          </p>
        </div>
      )}

      {data.length > 0 && !isLoading && (
        <>
          <div className="timesheet__totals">
            <div className="timesheet__total-item">
              <span className="timesheet__total-label">Total de horas</span>
              <span className="timesheet__total-value">
                {Math.round(grandTotalHours * 100) / 100}h
              </span>
            </div>
            {costsAvailable.length > 0 && (
              <div className="timesheet__total-item">
                <span className="timesheet__total-label">Custo total MO</span>
                <span className="timesheet__total-value timesheet__total-value--cost">
                  {formatCurrency(grandTotalCost)}
                </span>
              </div>
            )}
          </div>

          <div className="timesheet__list">
            {data.map((entry) => {
              const rowKey = `${entry.date}|${entry.userId}`;
              const isExpanded = expandedRows.has(rowKey);
              return (
                <div key={rowKey} className="timesheet__entry">
                  <button
                    type="button"
                    className="timesheet__entry-header"
                    onClick={() => toggleRow(rowKey)}
                    aria-expanded={isExpanded}
                    aria-label={`${entry.userName}, ${formatDate(entry.date)}, ${entry.totalHours}h`}
                  >
                    <span className="timesheet__entry-date">{formatDate(entry.date)}</span>
                    <span className="timesheet__entry-name">{entry.userName}</span>
                    <span className="timesheet__entry-hours">{entry.totalHours}h</span>
                    <span className="timesheet__entry-ops">
                      {entry.operationCount} {entry.operationCount === 1 ? 'op' : 'ops'}
                    </span>
                    {entry.totalLaborCost != null && (
                      <span className="timesheet__entry-cost">
                        {formatCurrency(entry.totalLaborCost)}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={16} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={16} aria-hidden="true" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="timesheet__entry-detail">
                      {entry.hourlyRate != null && (
                        <p className="timesheet__rate-info">
                          Custo/hora: {formatCurrency(entry.hourlyRate)}
                        </p>
                      )}
                      <ul className="timesheet__ops-list">
                        {entry.operations.map((op) => (
                          <li key={op.operationId} className="timesheet__op-item">
                            <span className="timesheet__op-type">{op.operationTypeLabel}</span>
                            <span className="timesheet__op-plot">{op.fieldPlotName}</span>
                            <span className="timesheet__op-time">
                              {formatTime(op.timeStart)} — {formatTime(op.timeEnd)}
                            </span>
                            <span className="timesheet__op-hours">{op.hoursWorked}h</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default TimesheetTab;
