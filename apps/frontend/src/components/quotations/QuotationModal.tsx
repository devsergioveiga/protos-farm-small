import { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle, Star, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { createQuotation } from '@/hooks/useQuotations';
import type { PurchaseRequest } from '@/types/purchase-request';
import type { CreateQuotationInput } from '@/types/quotation';
import './QuotationModal.css';

interface Supplier {
  id: string;
  name: string;
  tradeName: string | null;
  status: string;
  rating: number | null;
  averageRating: number | null;
  ratingCount: number | null;
}

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function getRatingBadge(
  averageRating: number | null | undefined,
  ratingCount: number | null | undefined,
) {
  if (averageRating == null || averageRating >= 3) return null;
  const isCritical = averageRating < 2;
  const tooltipText = `Nota media: ${averageRating.toFixed(1)} (${ratingCount ?? 0} avaliacoes)`;
  return (
    <span
      className={`qm-rating-badge qm-rating-badge--${isCritical ? 'critical' : 'low'}`}
      title={tooltipText}
    >
      {isCritical ? (
        <AlertCircle size={12} aria-hidden="true" />
      ) : (
        <AlertTriangle size={12} aria-hidden="true" />
      )}
      {isCritical ? 'Avaliacao critica' : 'Avaliacao baixa'}
    </span>
  );
}

function QuotationForm({ onClose, onSuccess }: Omit<QuotationModalProps, 'isOpen'>) {
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suggestedSupplierIds, setSuggestedSupplierIds] = useState<string[]>([]);
  const [isLoadingRCs, setIsLoadingRCs] = useState(true);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRcId, setSelectedRcId] = useState('');
  const [selectedRc, setSelectedRc] = useState<PurchaseRequest | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [responseDeadline, setResponseDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const firstInputRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Load approved purchase requests
  useEffect(() => {
    async function loadRCs() {
      setIsLoadingRCs(true);
      try {
        const result = await api.get<{ data: PurchaseRequest[] }>(
          '/org/purchase-requests?status=APROVADA&limit=100',
        );
        setPurchaseRequests(result.data);
      } catch {
        setPurchaseRequests([]);
      } finally {
        setIsLoadingRCs(false);
      }
    }
    void loadRCs();
  }, []);

  // Load suppliers when RC is selected
  useEffect(() => {
    if (!selectedRcId) {
      setSuppliers([]);
      setSelectedRc(null);
      setSelectedSupplierIds(new Set());
      return;
    }

    const rc = purchaseRequests.find((r) => r.id === selectedRcId);
    setSelectedRc(rc ?? null);

    async function loadSuppliers() {
      setIsLoadingSuppliers(true);
      try {
        const result = await api.get<{ data: Supplier[] }>(
          '/org/suppliers?status=ACTIVE&limit=100',
        );
        setSuppliers(result.data);

        // Try to load top 3 suggestions
        if (rc) {
          try {
            const top3 = await api.get<{ data: Supplier[] }>(
              `/org/suppliers/top3?category=${rc.requestType}`,
            );
            setSuggestedSupplierIds(top3.data.map((s) => s.id));
          } catch {
            setSuggestedSupplierIds([]);
          }
        }
      } catch {
        setSuppliers([]);
      } finally {
        setIsLoadingSuppliers(false);
      }
    }

    void loadSuppliers();
  }, [selectedRcId, purchaseRequests]);

  function toggleSupplier(supplierId: string) {
    setSelectedSupplierIds((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
    // Clear validation error for suppliers
    setValidationErrors((prev) => ({ ...prev, suppliers: '' }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!selectedRcId) errors.rc = 'Selecione uma requisicao de compra';
    if (selectedSupplierIds.size === 0) errors.suppliers = 'Selecione pelo menos um fornecedor';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const input: CreateQuotationInput = {
        purchaseRequestId: selectedRcId,
        supplierIds: Array.from(selectedSupplierIds),
        responseDeadline: responseDeadline || undefined,
        notes: notes || undefined,
      };
      await createQuotation(input);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar cotacao');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    onClose();
  }

  const activeSuppliers = suppliers.filter((s) => s.status === 'ACTIVE' || s.status === 'active');
  const inactiveSuppliers = suppliers.filter(
    (s) => s.status !== 'ACTIVE' && s.status !== 'active' && s.status !== 'BLOCKED',
  );

  const suggestedSuppliers = suppliers.filter((s) => suggestedSupplierIds.includes(s.id));

  return (
    <div
      className="qm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="qm-modal">
        {/* Header */}
        <div className="qm-modal__header">
          <h2 id="qm-title" className="qm-modal__title">
            Nova Cotacao
          </h2>
          <button
            type="button"
            className="qm-modal__close"
            onClick={handleClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <form id="qm-form" className="qm-modal__body" onSubmit={(e) => void handleSubmit(e)}>
          {error && (
            <div className="qm-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* RC Selection */}
          <div className="qm-field">
            <label htmlFor="qm-rc" className="qm-field__label">
              Requisicao de Compra <span aria-hidden="true">*</span>
            </label>
            {isLoadingRCs ? (
              <div className="qm-loading-inline">
                <Loader2 size={16} className="qm-spin" aria-hidden="true" />
                Carregando requisicoes...
              </div>
            ) : (
              <select
                id="qm-rc"
                ref={firstInputRef}
                className={`qm-select ${validationErrors.rc ? 'qm-select--error' : ''}`}
                value={selectedRcId}
                onChange={(e) => {
                  setSelectedRcId(e.target.value);
                  setValidationErrors((prev) => ({ ...prev, rc: '' }));
                }}
                aria-required="true"
                aria-describedby={validationErrors.rc ? 'qm-rc-error' : undefined}
              >
                <option value="">Selecione uma RC aprovada...</option>
                {purchaseRequests.map((rc) => (
                  <option key={rc.id} value={rc.id}>
                    {rc.sequentialNumber} — {rc.requestType} ({rc.items.length} itens)
                  </option>
                ))}
              </select>
            )}
            {validationErrors.rc && (
              <span id="qm-rc-error" className="qm-field__error" role="alert">
                <AlertCircle size={12} aria-hidden="true" />
                {validationErrors.rc}
              </span>
            )}
          </div>

          {/* RC Items preview */}
          {selectedRc && (
            <div className="qm-rc-preview">
              <p className="qm-rc-preview__label">Itens da RC:</p>
              <ul className="qm-rc-preview__list">
                {selectedRc.items.map((item, i) => (
                  <li key={item.id ?? i} className="qm-rc-preview__item">
                    <span className="qm-rc-preview__name">{item.productName}</span>
                    <span className="qm-rc-preview__qty">
                      {item.quantity} {item.unitName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Supplier Selection */}
          {selectedRcId && (
            <div className="qm-field">
              <label className="qm-field__label">
                Fornecedores <span aria-hidden="true">*</span>
              </label>
              {isLoadingSuppliers ? (
                <div className="qm-loading-inline">
                  <Loader2 size={16} className="qm-spin" aria-hidden="true" />
                  Carregando fornecedores...
                </div>
              ) : (
                <>
                  {/* Suggested suppliers */}
                  {suggestedSuppliers.length > 0 && (
                    <div className="qm-supplier-section">
                      <p className="qm-supplier-section__label">
                        <Star size={12} aria-hidden="true" />
                        Sugeridos para esta categoria
                      </p>
                      {suggestedSuppliers.map((supplier) => (
                        <label
                          key={supplier.id}
                          className="qm-supplier-item qm-supplier-item--suggested"
                        >
                          <input
                            type="checkbox"
                            className="qm-checkbox"
                            checked={selectedSupplierIds.has(supplier.id)}
                            onChange={() => toggleSupplier(supplier.id)}
                          />
                          <span className="qm-supplier-item__name">
                            {supplier.name}
                            {supplier.tradeName && (
                              <span className="qm-supplier-item__trade">
                                {' '}
                                ({supplier.tradeName})
                              </span>
                            )}
                          </span>
                          {getRatingBadge(
                            supplier.averageRating ?? supplier.rating,
                            supplier.ratingCount,
                          )}
                          {supplier.rating != null && (
                            <span
                              className="qm-supplier-item__rating"
                              aria-label={`Nota ${supplier.rating}`}
                            >
                              {'★'.repeat(Math.min(Math.round(supplier.rating), 5))}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}

                  {/* All active suppliers */}
                  <div className="qm-supplier-section">
                    {suggestedSuppliers.length > 0 && (
                      <p className="qm-supplier-section__label">Todos os fornecedores</p>
                    )}
                    {activeSuppliers.length === 0 && suggestedSuppliers.length === 0 ? (
                      <p className="qm-no-suppliers">Nenhum fornecedor ativo encontrado.</p>
                    ) : (
                      activeSuppliers
                        .filter((s) => !suggestedSupplierIds.includes(s.id))
                        .map((supplier) => (
                          <label key={supplier.id} className="qm-supplier-item">
                            <input
                              type="checkbox"
                              className="qm-checkbox"
                              checked={selectedSupplierIds.has(supplier.id)}
                              onChange={() => toggleSupplier(supplier.id)}
                            />
                            <span className="qm-supplier-item__name">
                              {supplier.name}
                              {supplier.tradeName && (
                                <span className="qm-supplier-item__trade">
                                  {' '}
                                  ({supplier.tradeName})
                                </span>
                              )}
                            </span>
                            {getRatingBadge(
                              supplier.averageRating ?? supplier.rating,
                              supplier.ratingCount,
                            )}
                            {supplier.rating != null && (
                              <span
                                className="qm-supplier-item__rating"
                                aria-label={`Nota ${supplier.rating}`}
                              >
                                {'★'.repeat(Math.min(Math.round(supplier.rating), 5))}
                              </span>
                            )}
                          </label>
                        ))
                    )}

                    {/* Inactive suppliers */}
                    {inactiveSuppliers.map((supplier) => (
                      <label
                        key={supplier.id}
                        className="qm-supplier-item qm-supplier-item--inactive"
                      >
                        <input
                          type="checkbox"
                          className="qm-checkbox"
                          checked={selectedSupplierIds.has(supplier.id)}
                          onChange={() => toggleSupplier(supplier.id)}
                        />
                        <span className="qm-supplier-item__name">
                          {supplier.name}
                          <span className="qm-supplier-item__inactive-tag">
                            <AlertTriangle size={12} aria-hidden="true" />
                            Inativo
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              {validationErrors.suppliers && (
                <span className="qm-field__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" />
                  {validationErrors.suppliers}
                </span>
              )}
              {selectedSupplierIds.size > 0 && (
                <p className="qm-supplier-count">
                  {selectedSupplierIds.size} fornecedor{selectedSupplierIds.size !== 1 ? 'es' : ''}{' '}
                  selecionado{selectedSupplierIds.size !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Response Deadline */}
          <div className="qm-field">
            <label htmlFor="qm-deadline" className="qm-field__label">
              Prazo de Resposta
            </label>
            <input
              id="qm-deadline"
              type="date"
              className="qm-input"
              value={responseDeadline}
              onChange={(e) => setResponseDeadline(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>

          {/* Notes */}
          <div className="qm-field">
            <label htmlFor="qm-notes" className="qm-field__label">
              Observacoes
            </label>
            <textarea
              id="qm-notes"
              className="qm-textarea"
              rows={3}
              placeholder="Instrucoes adicionais para os fornecedores..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="qm-modal__footer">
          <button
            type="button"
            className="qm-btn qm-btn--secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="qm-form"
            className="qm-btn qm-btn--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="qm-spin" aria-hidden="true" />
                Criando...
              </>
            ) : (
              'Criar Cotacao'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuotationModal({ isOpen, onClose, onSuccess }: QuotationModalProps) {
  if (!isOpen) return null;
  return <QuotationForm key={String(isOpen)} onClose={onClose} onSuccess={onSuccess} />;
}
