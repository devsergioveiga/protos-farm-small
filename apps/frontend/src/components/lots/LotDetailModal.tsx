import { useState, useEffect, useCallback } from 'react';
import { X, BarChart3, Users, Clock, AlertTriangle } from 'lucide-react';
import { useLotDashboard } from '@/hooks/useLotDashboard';
import { useLotHistory } from '@/hooks/useLotHistory';
import { CATEGORY_LABELS } from '@/types/animal';
import { LOCATION_TYPE_LABELS } from '@/types/lot';
import type { LotListItem, LotLocationType } from '@/types/lot';
import ManageAnimalsModal from './ManageAnimalsModal';
import './LotDetailModal.css';

interface LotDetailModalProps {
  isOpen: boolean;
  farmId: string;
  lot: LotListItem | null;
  onClose: () => void;
  onUpdate: () => void;
}

// Wrapper: unmounts content when closed, so useState resets naturally
function LotDetailModal({ isOpen, farmId, lot, onClose, onUpdate }: LotDetailModalProps) {
  if (!isOpen || !lot) return null;

  return <LotDetailModalContent farmId={farmId} lot={lot} onClose={onClose} onUpdate={onUpdate} />;
}

type TabId = 'dashboard' | 'animals' | 'history';

interface LotDetailModalContentProps {
  farmId: string;
  lot: LotListItem;
  onClose: () => void;
  onUpdate: () => void;
}

function LotDetailModalContent({ farmId, lot, onClose, onUpdate }: LotDetailModalContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [showManageAnimals, setShowManageAnimals] = useState(false);

  const { dashboard, isLoading: dashLoading } = useLotDashboard({
    farmId,
    lotId: lot.id,
  });

  const { history, isLoading: histLoading } = useLotHistory({
    farmId: activeTab === 'history' ? farmId : null,
    lotId: activeTab === 'history' ? lot.id : null,
  });

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleManageSuccess = useCallback(() => {
    setShowManageAnimals(false);
    onUpdate();
  }, [onUpdate]);

  return (
    <>
      <div className="lot-detail-overlay" onClick={onClose}>
        <div
          className="lot-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes do lote ${lot.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="lot-detail-modal__header">
            <div>
              <h2 className="lot-detail-modal__title">{lot.name}</h2>
              <p className="lot-detail-modal__subtitle">
                {CATEGORY_LABELS[lot.predominantCategory]} &middot; {lot.currentLocation} (
                {LOCATION_TYPE_LABELS[lot.locationType as LotLocationType]})
              </p>
            </div>
            <button
              type="button"
              className="lot-detail-modal__close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Tabs */}
          <div className="lot-detail-modal__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'dashboard'}
              className={`lot-detail-modal__tab ${activeTab === 'dashboard' ? 'lot-detail-modal__tab--active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart3 size={16} aria-hidden="true" />
              Dashboard
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'animals'}
              className={`lot-detail-modal__tab ${activeTab === 'animals' ? 'lot-detail-modal__tab--active' : ''}`}
              onClick={() => setActiveTab('animals')}
            >
              <Users size={16} aria-hidden="true" />
              Animais
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              className={`lot-detail-modal__tab ${activeTab === 'history' ? 'lot-detail-modal__tab--active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <Clock size={16} aria-hidden="true" />
              Histórico
            </button>
          </div>

          {/* Body */}
          <div className="lot-detail-modal__body">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="lot-detail-modal__dashboard">
                {dashLoading ? (
                  <div className="lot-detail-modal__skeleton" />
                ) : dashboard ? (
                  <div className="lot-detail-modal__stats">
                    <div className="lot-detail-modal__stat">
                      <span className="lot-detail-modal__stat-value">{dashboard.animalCount}</span>
                      <span className="lot-detail-modal__stat-label">Animais</span>
                    </div>
                    <div className="lot-detail-modal__stat">
                      <span className="lot-detail-modal__stat-value">
                        {dashboard.avgWeightKg ? `${dashboard.avgWeightKg} kg` : 'N/D'}
                      </span>
                      <span className="lot-detail-modal__stat-label">Peso médio</span>
                    </div>
                    <div className="lot-detail-modal__stat">
                      <span className="lot-detail-modal__stat-value">
                        {dashboard.avgDaysInLot ? `${dashboard.avgDaysInLot} dias` : 'N/D'}
                      </span>
                      <span className="lot-detail-modal__stat-label">Média no lote</span>
                    </div>
                    <div className="lot-detail-modal__stat">
                      <span className="lot-detail-modal__stat-value">N/D</span>
                      <span className="lot-detail-modal__stat-label">Produção L/dia</span>
                    </div>
                    {dashboard.maxCapacity && (
                      <div className="lot-detail-modal__capacity-section">
                        <div className="lot-detail-modal__capacity-header">
                          <span>
                            Capacidade: {dashboard.animalCount}/{dashboard.maxCapacity}
                            {dashboard.capacityPercent !== null &&
                              ` (${dashboard.capacityPercent}%)`}
                          </span>
                          {dashboard.isOverCapacity && (
                            <span className="lot-detail-modal__over-badge">
                              <AlertTriangle size={14} aria-hidden="true" />
                              Excedida
                            </span>
                          )}
                        </div>
                        <div className="lot-detail-modal__capacity-track">
                          <div
                            className={`lot-detail-modal__capacity-bar ${
                              dashboard.isOverCapacity
                                ? 'lot-detail-modal__capacity-bar--over'
                                : (dashboard.capacityPercent ?? 0) >= 80
                                  ? 'lot-detail-modal__capacity-bar--warning'
                                  : 'lot-detail-modal__capacity-bar--ok'
                            }`}
                            style={{ width: `${Math.min(dashboard.capacityPercent ?? 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Animals Tab */}
            {activeTab === 'animals' && (
              <div className="lot-detail-modal__animals">
                <div className="lot-detail-modal__animals-header">
                  <p className="lot-detail-modal__animals-count">
                    {lot._count.animals} {lot._count.animals === 1 ? 'animal' : 'animais'} neste
                    lote
                  </p>
                  <button
                    type="button"
                    className="lot-detail-modal__btn lot-detail-modal__btn--primary"
                    onClick={() => setShowManageAnimals(true)}
                  >
                    Mover animais
                  </button>
                </div>
                <p className="lot-detail-modal__animals-hint">
                  Use o botão acima para adicionar ou remover animais deste lote.
                </p>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="lot-detail-modal__history">
                {histLoading ? (
                  <div className="lot-detail-modal__skeleton" />
                ) : history.length === 0 ? (
                  <p className="lot-detail-modal__history-empty">
                    Nenhuma movimentação registrada ainda.
                  </p>
                ) : (
                  <table className="lot-detail-modal__history-table">
                    <thead>
                      <tr>
                        <th scope="col">Mês</th>
                        <th scope="col">Total</th>
                        <th scope="col">Composição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((entry) => (
                        <tr key={entry.date}>
                          <td>{entry.date}</td>
                          <td>{entry.animalCount}</td>
                          <td>
                            {Object.entries(entry.categories)
                              .filter(([, count]) => count > 0)
                              .map(
                                ([cat, count]) =>
                                  `${CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}: ${count}`,
                              )
                              .join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ManageAnimalsModal
        isOpen={showManageAnimals}
        farmId={farmId}
        lotId={lot.id}
        lotName={lot.name}
        onClose={() => setShowManageAnimals(false)}
        onSuccess={handleManageSuccess}
      />
    </>
  );
}

export default LotDetailModal;
