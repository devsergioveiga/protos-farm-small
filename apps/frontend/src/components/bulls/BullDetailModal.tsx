import { useState, useEffect, useCallback } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle,
  Plus,
  Pencil,
  TestTubeDiagonal,
  Calendar,
  Package,
} from 'lucide-react';
import { api } from '@/services/api';
import type { BullItem, SemenBatchItem } from '@/types/bull';
import SemenBatchModal from './SemenBatchModal';
import './BullDetailModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bullId: string | null;
  farmId: string;
  onSuccess: () => void;
}

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bull-detail__status--active',
  RESTING: 'bull-detail__status--resting',
  DISCARDED: 'bull-detail__status--discarded',
};

export default function BullDetailModal({ isOpen, onClose, bullId, farmId, onSuccess }: Props) {
  const [bull, setBull] = useState<BullItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Semen batch modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editBatch, setEditBatch] = useState<SemenBatchItem | null>(null);

  // Use doses inline
  const [useDosesBatchId, setUseDosesBatchId] = useState<string | null>(null);
  const [useDosesQty, setUseDosesQty] = useState(1);
  const [useDosesLoading, setUseDosesLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!bullId || !farmId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<BullItem>(`/org/farms/${farmId}/bulls/${bullId}`);
      setBull(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar touro');
    } finally {
      setIsLoading(false);
    }
  }, [bullId, farmId]);

  useEffect(() => {
    if (isOpen && bullId) {
      void fetchDetail();
      setSuccessMsg(null);
    }
  }, [isOpen, bullId, fetchDetail]);

  const showSuccessMsg = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }, []);

  const handleBatchSuccess = useCallback(() => {
    setShowBatchModal(false);
    setEditBatch(null);
    showSuccessMsg('Lote de sêmen salvo com sucesso');
    void fetchDetail();
    onSuccess();
  }, [fetchDetail, onSuccess, showSuccessMsg]);

  const handleUseDoses = useCallback(
    async (batchId: string) => {
      if (useDosesQty < 1) {
        setError('Informe ao menos 1 dose.');
        return;
      }
      setUseDosesLoading(true);
      setError(null);
      try {
        await api.post(`/org/farms/${farmId}/bulls/semen-batches/${batchId}/use`, {
          quantity: useDosesQty,
        });
        showSuccessMsg(`${useDosesQty} dose(s) utilizada(s) com sucesso`);
        setUseDosesBatchId(null);
        setUseDosesQty(1);
        void fetchDetail();
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao usar doses.');
      } finally {
        setUseDosesLoading(false);
      }
    },
    [farmId, useDosesQty, fetchDetail, onSuccess, showSuccessMsg],
  );

  if (!isOpen) return null;

  return (
    <div className="bull-detail__overlay" onClick={onClose}>
      <div
        className="bull-detail__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bull-detail-title"
      >
        {/* Header */}
        <header className="bull-detail__header">
          <h2 id="bull-detail-title">Detalhes do touro</h2>
          <button
            type="button"
            className="bull-detail__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="bull-detail__body">
          {/* Messages */}
          {successMsg && (
            <div className="bull-detail__success" role="status">
              <CheckCircle size={16} aria-hidden="true" />
              {successMsg}
            </div>
          )}
          {error && (
            <div className="bull-detail__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Loading */}
          {isLoading && <div className="bull-detail__loading">Carregando detalhes...</div>}

          {/* Bull info */}
          {bull && !isLoading && (
            <>
              <div className="bull-detail__info">
                <div className="bull-detail__info-header">
                  <div>
                    <h3 className="bull-detail__name">{bull.name}</h3>
                    <p className="bull-detail__breed">{bull.breedName}</p>
                  </div>
                  <span className={`bull-detail__status ${STATUS_COLORS[bull.status] || ''}`}>
                    {bull.statusLabel}
                  </span>
                </div>

                <div className="bull-detail__meta-grid">
                  {bull.registryNumber && (
                    <div className="bull-detail__meta-item">
                      <span className="bull-detail__meta-label">REGISTRO</span>
                      <span className="bull-detail__meta-value bull-detail__mono">
                        {bull.registryNumber}
                        {bull.registryAssociation ? ` (${bull.registryAssociation})` : ''}
                      </span>
                    </div>
                  )}
                  <div className="bull-detail__meta-item">
                    <span className="bull-detail__meta-label">TIPO</span>
                    <span className="bull-detail__meta-value">
                      {bull.isOwnAnimal ? 'Próprio' : 'Externo / Alugado'}
                    </span>
                  </div>
                  {!bull.isOwnAnimal && bull.ownerName && (
                    <div className="bull-detail__meta-item">
                      <span className="bull-detail__meta-label">PROPRIETÁRIO</span>
                      <span className="bull-detail__meta-value">{bull.ownerName}</span>
                    </div>
                  )}
                  <div className="bull-detail__meta-item">
                    <span className="bull-detail__meta-label">SÊMEN EM ESTOQUE</span>
                    <span className="bull-detail__meta-value bull-detail__mono">
                      {bull.semenStock} doses
                    </span>
                  </div>
                </div>

                {/* Genetic merit summary */}
                {(bull.ptaMilkKg != null || bull.ptaFatKg != null || bull.ptaProteinKg != null) && (
                  <div className="bull-detail__genetic">
                    <h4 className="bull-detail__genetic-title">Mérito genético</h4>
                    <div className="bull-detail__genetic-grid">
                      {bull.ptaMilkKg != null && (
                        <div className="bull-detail__genetic-item">
                          <span className="bull-detail__genetic-label">PTA LEITE</span>
                          <span className="bull-detail__genetic-value">{bull.ptaMilkKg} kg</span>
                        </div>
                      )}
                      {bull.ptaFatKg != null && (
                        <div className="bull-detail__genetic-item">
                          <span className="bull-detail__genetic-label">PTA GORDURA</span>
                          <span className="bull-detail__genetic-value">
                            {bull.ptaFatKg} kg
                            {bull.ptaFatPct != null ? ` (${bull.ptaFatPct}%)` : ''}
                          </span>
                        </div>
                      )}
                      {bull.ptaProteinKg != null && (
                        <div className="bull-detail__genetic-item">
                          <span className="bull-detail__genetic-label">PTA PROTEÍNA</span>
                          <span className="bull-detail__genetic-value">
                            {bull.ptaProteinKg} kg
                            {bull.ptaProteinPct != null ? ` (${bull.ptaProteinPct}%)` : ''}
                          </span>
                        </div>
                      )}
                      {bull.typeScore != null && (
                        <div className="bull-detail__genetic-item">
                          <span className="bull-detail__genetic-label">TIPO</span>
                          <span className="bull-detail__genetic-value">{bull.typeScore}</span>
                        </div>
                      )}
                      {bull.productiveLife != null && (
                        <div className="bull-detail__genetic-item">
                          <span className="bull-detail__genetic-label">VIDA PRODUTIVA</span>
                          <span className="bull-detail__genetic-value">{bull.productiveLife}</span>
                        </div>
                      )}
                      {bull.calvingEase != null && (
                        <div className="bull-detail__genetic-item">
                          <span className="bull-detail__genetic-label">PARTO</span>
                          <span className="bull-detail__genetic-value">{bull.calvingEase}</span>
                        </div>
                      )}
                      {bull.scc != null && (
                        <div className="bull-detail__genetic-item">
                          <span className="bull-detail__genetic-label">CCS</span>
                          <span className="bull-detail__genetic-value">{bull.scc}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {bull.notes && (
                  <div className="bull-detail__notes">
                    <span className="bull-detail__meta-label">OBSERVAÇÕES</span>
                    <p>{bull.notes}</p>
                  </div>
                )}
              </div>

              {/* Semen batches */}
              <div className="bull-detail__batches">
                <div className="bull-detail__batches-header">
                  <h4>Lotes de sêmen</h4>
                  <button
                    type="button"
                    className="bull-detail__btn-add-batch"
                    onClick={() => {
                      setEditBatch(null);
                      setShowBatchModal(true);
                    }}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Adicionar lote
                  </button>
                </div>

                {bull.semenBatches.length === 0 ? (
                  <div className="bull-detail__batches-empty">
                    <TestTubeDiagonal size={32} aria-hidden="true" />
                    <p>Nenhum lote de sêmen cadastrado</p>
                  </div>
                ) : (
                  <div className="bull-detail__batches-table-wrap">
                    <table className="bull-detail__batches-table">
                      <thead>
                        <tr>
                          <th scope="col">Lote</th>
                          <th scope="col">Tipo</th>
                          <th scope="col">Central</th>
                          <th scope="col">Entrada</th>
                          <th scope="col">Validade</th>
                          <th scope="col">Doses</th>
                          <th scope="col">Custo/dose</th>
                          <th scope="col">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bull.semenBatches.map((batch) => (
                          <tr key={batch.id}>
                            <td className="bull-detail__mono">{batch.batchNumber}</td>
                            <td>{batch.semenTypeLabel || batch.semenType || '—'}</td>
                            <td>{batch.centralName || '—'}</td>
                            <td>
                              <span className="bull-detail__cell-icon">
                                <Calendar size={14} aria-hidden="true" />
                                {formatDate(batch.entryDate)}
                              </span>
                            </td>
                            <td>{batch.expiryDate ? formatDate(batch.expiryDate) : '—'}</td>
                            <td className="bull-detail__mono">
                              <span className="bull-detail__cell-icon">
                                <Package size={14} aria-hidden="true" />
                                {batch.currentDoses}/{batch.initialDoses}
                              </span>
                            </td>
                            <td className="bull-detail__mono">
                              {formatCurrency(batch.costPerDose)}
                            </td>
                            <td>
                              <div className="bull-detail__batch-actions">
                                {useDosesBatchId === batch.id ? (
                                  <div className="bull-detail__use-doses-inline">
                                    <input
                                      type="number"
                                      min="1"
                                      max={batch.currentDoses}
                                      value={useDosesQty}
                                      onChange={(e) =>
                                        setUseDosesQty(Math.max(1, Number(e.target.value)))
                                      }
                                      aria-label="Quantidade de doses a usar"
                                      className="bull-detail__use-doses-input"
                                    />
                                    <button
                                      type="button"
                                      className="bull-detail__batch-btn bull-detail__batch-btn--confirm"
                                      onClick={() => void handleUseDoses(batch.id)}
                                      disabled={useDosesLoading}
                                      aria-label="Confirmar uso de doses"
                                    >
                                      <CheckCircle size={16} aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      className="bull-detail__batch-btn"
                                      onClick={() => setUseDosesBatchId(null)}
                                      aria-label="Cancelar"
                                    >
                                      <X size={16} aria-hidden="true" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="bull-detail__batch-btn"
                                      onClick={() => {
                                        setUseDosesBatchId(batch.id);
                                        setUseDosesQty(1);
                                      }}
                                      aria-label={`Usar doses do lote ${batch.batchNumber}`}
                                      disabled={batch.currentDoses <= 0}
                                      title="Usar doses"
                                    >
                                      <TestTubeDiagonal size={16} aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      className="bull-detail__batch-btn"
                                      onClick={() => {
                                        setEditBatch(batch);
                                        setShowBatchModal(true);
                                      }}
                                      aria-label={`Editar lote ${batch.batchNumber}`}
                                      title="Editar"
                                    >
                                      <Pencil size={16} aria-hidden="true" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Semen batch sub-modal */}
        {bullId && (
          <SemenBatchModal
            isOpen={showBatchModal}
            onClose={() => {
              setShowBatchModal(false);
              setEditBatch(null);
            }}
            batch={editBatch}
            farmId={farmId}
            bullId={bullId}
            onSuccess={handleBatchSuccess}
          />
        )}
      </div>
    </div>
  );
}
