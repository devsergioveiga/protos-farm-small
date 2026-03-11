import { useState, useEffect, useCallback } from 'react';
import { History, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import './ProductivityHistoryModal.css';

interface ProductivityHistoryEntry {
  period: string;
  totalProductivity: number;
  productivityUnit: string;
  totalHoursWorked: number;
  productivityPerHour: number;
  operationCount: number;
}

interface ProductivityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

function formatPeriod(period: string): string {
  if (period.length === 7) {
    const [year, month] = period.split('-');
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    return `${months[Number(month) - 1]} ${year}`;
  }
  return new Date(period).toLocaleDateString('pt-BR');
}

function ProductivityHistoryModal({
  isOpen,
  onClose,
  userId,
  userName,
}: ProductivityHistoryModalProps) {
  const { selectedFarmId } = useFarmContext();
  const [data, setData] = useState<ProductivityHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedFarmId || !userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const path = `/org/farms/${selectedFarmId}/team-operations/productivity-history/${userId}?groupBy=month`;
      const result = await api.get<ProductivityHistoryEntry[]>(path);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, userId]);

  useEffect(() => {
    if (isOpen) void fetchData();
  }, [isOpen, fetchData]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="ph-modal__overlay" onClick={onClose}>
      <div
        className="ph-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Histórico de produtividade de ${userName}`}
      >
        <div className="ph-modal__header">
          <h2 className="ph-modal__title">
            <History size={20} aria-hidden="true" />
            Histórico — {userName}
          </h2>
          <button type="button" className="ph-modal__close" onClick={onClose} aria-label="Fechar">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div className="ph-modal__body">
          {error && (
            <div className="ph-modal__error" role="alert" aria-live="polite">
              <AlertCircle size={16} aria-hidden="true" /> {error}
            </div>
          )}

          {isLoading && (
            <div className="ph-modal__skeleton-list">
              {[1, 2, 3].map((i) => (
                <div key={i} className="ph-modal__skeleton" />
              ))}
            </div>
          )}

          {data.length === 0 && !isLoading && !error && (
            <div className="ph-modal__empty">
              <History size={48} aria-hidden="true" />
              <p className="ph-modal__empty-text">
                Sem dados de produtividade para este colaborador.
              </p>
            </div>
          )}

          {data.length > 0 && !isLoading && (
            <div className="ph-modal__timeline">
              {data.map((entry, idx) => {
                const prev = idx > 0 ? data[idx - 1] : null;
                const trend = prev
                  ? entry.productivityPerHour > prev.productivityPerHour
                    ? 'up'
                    : entry.productivityPerHour < prev.productivityPerHour
                      ? 'down'
                      : 'stable'
                  : null;

                return (
                  <div
                    key={`${entry.period}-${entry.productivityUnit}`}
                    className="ph-modal__entry"
                  >
                    <span className="ph-modal__period">{formatPeriod(entry.period)}</span>
                    <div className="ph-modal__metrics">
                      <span className="ph-modal__metric">
                        {entry.totalProductivity.toLocaleString('pt-BR')} {entry.productivityUnit}
                      </span>
                      <span className="ph-modal__metric ph-modal__metric--secondary">
                        {entry.productivityPerHour.toLocaleString('pt-BR')}/h
                      </span>
                      <span className="ph-modal__metric ph-modal__metric--secondary">
                        {entry.totalHoursWorked}h · {entry.operationCount} ops
                      </span>
                    </div>
                    {trend && (
                      <span className={`ph-modal__trend ph-modal__trend--${trend}`}>
                        {trend === 'up' && <TrendingUp size={16} aria-hidden="true" />}
                        {trend === 'down' && <TrendingDown size={16} aria-hidden="true" />}
                        {trend === 'stable' && <Minus size={16} aria-hidden="true" />}
                        <span className="sr-only">
                          {trend === 'up' ? 'Crescimento' : trend === 'down' ? 'Queda' : 'Estável'}
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductivityHistoryModal;
