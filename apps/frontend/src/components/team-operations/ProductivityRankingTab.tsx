import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, AlertCircle, Calendar, Trophy, Clock, Settings } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { TEAM_OPERATION_TYPES } from '@/types/team-operation';
import ProductivityTargetsModal from './ProductivityTargetsModal';
import ProductivityHistoryModal from './ProductivityHistoryModal';
import './ProductivityRankingTab.css';

type ProductivityStatus = 'above' | 'on_target' | 'below' | null;

interface ProductivityRankingEntry {
  userId: string;
  userName: string;
  userEmail: string;
  totalProductivity: number;
  productivityUnit: string;
  totalHoursWorked: number;
  productivityPerHour: number;
  operationCount: number;
  rank: number;
  targetValue: number | null;
  targetPercentage: number | null;
  status: ProductivityStatus;
}

const STATUS_LABELS: Record<string, string> = {
  above: 'Acima da meta',
  on_target: 'Na meta',
  below: 'Abaixo da meta',
};

function ProductivityRankingTab() {
  const { selectedFarmId } = useFarmContext();
  const [data, setData] = useState<ProductivityRankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [operationType, setOperationType] = useState('');
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [historyUser, setHistoryUser] = useState<{ id: string; name: string } | null>(null);

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
      const path = `/org/farms/${selectedFarmId}/team-operations/productivity-ranking${qs ? `?${qs}` : ''}`;
      const result = await api.get<ProductivityRankingEntry[]>(path);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar ranking');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, dateFrom, dateTo, operationType]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="prod-rank">
      <div className="prod-rank__toolbar">
        <button
          type="button"
          className="prod-rank__config-btn"
          onClick={() => setShowTargetsModal(true)}
        >
          <Settings size={16} aria-hidden="true" />
          Configurar metas
        </button>
      </div>

      <div className="prod-rank__filters">
        <div className="prod-rank__field">
          <label htmlFor="rank-type" className="prod-rank__label">
            Tipo de operação
          </label>
          <select
            id="rank-type"
            className="prod-rank__select"
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
        <div className="prod-rank__field">
          <label htmlFor="rank-from" className="prod-rank__label">
            <Calendar size={14} aria-hidden="true" />
            De
          </label>
          <input
            id="rank-from"
            type="date"
            className="prod-rank__input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="prod-rank__field">
          <label htmlFor="rank-to" className="prod-rank__label">
            <Calendar size={14} aria-hidden="true" />
            Até
          </label>
          <input
            id="rank-to"
            type="date"
            className="prod-rank__input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="prod-rank__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="prod-rank__skeleton-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="prod-rank__skeleton" />
          ))}
        </div>
      )}

      {data.length === 0 && !isLoading && !error && (
        <div className="prod-rank__empty">
          <TrendingUp size={48} aria-hidden="true" />
          <h3 className="prod-rank__empty-title">Sem dados de produtividade</h3>
          <p className="prod-rank__empty-desc">
            Registre a produtividade individual nas operações para ver o ranking da equipe.
          </p>
        </div>
      )}

      {data.length > 0 && !isLoading && (
        <div className="prod-rank__list" role="table" aria-label="Ranking de produtividade">
          <div className="prod-rank__row prod-rank__row--header" role="row">
            <span role="columnheader" className="prod-rank__col-rank">
              #
            </span>
            <span role="columnheader" className="prod-rank__col-name">
              Colaborador
            </span>
            <span role="columnheader">Produção total</span>
            <span role="columnheader">Prod./hora</span>
            <span role="columnheader">
              <Clock size={14} aria-hidden="true" /> Horas
            </span>
            <span role="columnheader">STATUS</span>
          </div>
          {data.map((entry) => (
            <div
              key={`${entry.userId}-${entry.productivityUnit}`}
              className="prod-rank__row"
              role="row"
            >
              <span className="prod-rank__col-rank" role="cell">
                {entry.rank <= 3 ? (
                  <span className={`prod-rank__medal prod-rank__medal--${entry.rank}`}>
                    <Trophy size={16} aria-hidden="true" />
                    {entry.rank}
                  </span>
                ) : (
                  entry.rank
                )}
              </span>
              <span className="prod-rank__col-name" role="cell">
                <button
                  type="button"
                  className="prod-rank__user-btn"
                  onClick={() => setHistoryUser({ id: entry.userId, name: entry.userName })}
                  title="Ver histórico de produtividade"
                >
                  <span className="prod-rank__user-name">{entry.userName}</span>
                  <span className="prod-rank__user-email">{entry.userEmail}</span>
                </button>
              </span>
              <span className="prod-rank__cell prod-rank__cell--mono" role="cell">
                {entry.totalProductivity.toLocaleString('pt-BR')} {entry.productivityUnit}
              </span>
              <span className="prod-rank__cell prod-rank__cell--mono" role="cell">
                {entry.productivityPerHour.toLocaleString('pt-BR')}/h
              </span>
              <span className="prod-rank__cell prod-rank__cell--mono" role="cell">
                {entry.totalHoursWorked}h
              </span>
              <span className="prod-rank__cell" role="cell">
                {entry.status ? (
                  <span className={`prod-rank__status prod-rank__status--${entry.status}`}>
                    <span className="prod-rank__status-dot" aria-hidden="true" />
                    {STATUS_LABELS[entry.status]}
                    {entry.targetPercentage != null && (
                      <span className="prod-rank__status-pct">
                        {entry.targetPercentage.toLocaleString('pt-BR')}%
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="prod-rank__status-none">Sem meta</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <ProductivityTargetsModal
        isOpen={showTargetsModal}
        onClose={() => setShowTargetsModal(false)}
      />

      {historyUser && (
        <ProductivityHistoryModal
          isOpen={true}
          onClose={() => setHistoryUser(null)}
          userId={historyUser.id}
          userName={historyUser.name}
        />
      )}
    </div>
  );
}

export default ProductivityRankingTab;
