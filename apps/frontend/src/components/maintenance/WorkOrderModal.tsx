import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useAssets } from '@/hooks/useAssets';
import { useProducts } from '@/hooks/useProducts';
import type { WorkOrder, WorkOrderType } from '@/types/maintenance';
import type { AddWorkOrderPartInput } from '@/types/maintenance';
import './WorkOrderModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface WorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workOrder?: WorkOrder;
  prefilledAssetId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<WorkOrderType, string> = {
  PREVENTIVA: 'Preventiva',
  CORRETIVA: 'Corretiva',
  SOLICITACAO: 'Solicitacao',
};

interface PartRow {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
}

function formatBRL(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="wo-modal__field-error" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────

export default function WorkOrderModal({
  isOpen,
  onClose,
  onSuccess,
  workOrder,
  prefilledAssetId,
}: WorkOrderModalProps) {
  const { createWorkOrder, updateWorkOrder } = useWorkOrders();
  const { assets, fetchAssets } = useAssets();
  const { products } = useProducts({ limit: 500 });

  const [assetId, setAssetId] = useState('');
  const [type, setType] = useState<WorkOrderType>('PREVENTIVA');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [laborHours, setLaborHours] = useState('');
  const [laborCostPerHour, setLaborCostPerHour] = useState('');
  const [externalCost, setExternalCost] = useState('');
  const [externalSupplier, setExternalSupplier] = useState('');
  const [parts, setParts] = useState<PartRow[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isOpen) {
      void fetchAssets({ limit: 200 });
    }
  }, [isOpen, fetchAssets]);

  useEffect(() => {
    if (!isOpen) return;
    if (workOrder) {
      setAssetId(workOrder.assetId);
      setType(workOrder.type);
      setTitle(workOrder.title);
      setDescription(workOrder.description ?? '');
      setAssignedTo(workOrder.assignedTo ?? '');
      setLaborHours('');
      setLaborCostPerHour('');
      setExternalCost(workOrder.externalCost !== null ? String(workOrder.externalCost) : '');
      setExternalSupplier('');
      setParts(
        workOrder.parts.map((p) => ({
          key: p.id,
          productId: p.productId,
          quantity: String(p.quantity),
          unitCost: String(p.unitCost),
        })),
      );
    } else {
      setAssetId(prefilledAssetId ?? '');
      setType('PREVENTIVA');
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setLaborHours('');
      setLaborCostPerHour('');
      setExternalCost('');
      setExternalSupplier('');
      setParts([]);
    }
    setErrors({});
    setSubmitError(null);
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [isOpen, workOrder, prefilledAssetId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Computed total
  const partsTotal = parts.reduce((acc, p) => {
    const qty = parseFloat(p.quantity) || 0;
    const uc = parseFloat(p.unitCost) || 0;
    return acc + qty * uc;
  }, 0);
  const laborTotal = (parseFloat(laborHours) || 0) * (parseFloat(laborCostPerHour) || 0);
  const extTotal = parseFloat(externalCost) || 0;
  const grandTotal = partsTotal + laborTotal + extTotal;

  function addPartRow() {
    setParts((prev) => [
      ...prev,
      { key: `new-${Date.now()}`, productId: '', quantity: '1', unitCost: '' },
    ]);
  }

  function updatePart(key: string, field: keyof PartRow, value: string) {
    setParts((prev) => prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  }

  function removePart(key: string) {
    setParts((prev) => prev.filter((p) => p.key !== key));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!assetId) next.assetId = 'Selecione um ativo.';
    if (!title.trim()) next.title = 'Titulo e obrigatorio.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const input = {
        assetId,
        type,
        title: title.trim(),
        description: description.trim() || null,
        assignedTo: assignedTo.trim() || null,
        totalLaborCost: laborTotal > 0 ? laborTotal : null,
        externalCost: extTotal > 0 ? extTotal : null,
      };
      if (workOrder) {
        await updateWorkOrder(workOrder.id, input, onSuccess);
      } else {
        await createWorkOrder(input, () => onSuccess());
      }
    } catch {
      setSubmitError('Nao foi possivel salvar. Verifique sua conexao e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const validParts = parts.filter((p) => p.productId && p.quantity && p.unitCost);

  return (
    <div
      className="wo-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wo-modal-title"
    >
      <div className="wo-modal">
        {/* Header */}
        <header className="wo-modal__header">
          <h2 className="wo-modal__title" id="wo-modal-title">
            {workOrder ? `OS #${workOrder.sequentialNumber}` : 'Abrir Ordem de Servico'}
          </h2>
          <button
            type="button"
            className="wo-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="wo-modal__body">
            {/* Ativo */}
            <div className="wo-modal__field">
              <label htmlFor="wo-asset" className="wo-modal__label">
                Ativo vinculado{' '}
                <span className="wo-modal__required" aria-hidden="true">*</span>
              </label>
              <select
                ref={firstFieldRef}
                id="wo-asset"
                className={`wo-modal__select${errors.assetId ? ' wo-modal__input--error' : ''}`}
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                aria-required="true"
              >
                <option value="">Selecione um ativo</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.assetTag})
                  </option>
                ))}
              </select>
              <FieldError message={errors.assetId} />
            </div>

            {/* Tipo */}
            <div className="wo-modal__field">
              <span className="wo-modal__label" id="wo-type-label">Tipo</span>
              <div
                className="wo-modal__type-group"
                role="radiogroup"
                aria-labelledby="wo-type-label"
              >
                {(Object.keys(TYPE_LABELS) as WorkOrderType[]).map((t) => (
                  <label
                    key={t}
                    className={`wo-modal__type-card${type === t ? ' wo-modal__type-card--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="wo-type"
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                    />
                    {TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>

            {/* Titulo */}
            <div className="wo-modal__field">
              <label htmlFor="wo-title" className="wo-modal__label">
                Titulo{' '}
                <span className="wo-modal__required" aria-hidden="true">*</span>
              </label>
              <input
                id="wo-title"
                type="text"
                className={`wo-modal__input${errors.title ? ' wo-modal__input--error' : ''}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-required="true"
              />
              <FieldError message={errors.title} />
            </div>

            {/* Descricao */}
            <div className="wo-modal__field">
              <label htmlFor="wo-desc" className="wo-modal__label">Descricao</label>
              <textarea
                id="wo-desc"
                className="wo-modal__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Responsavel */}
            <div className="wo-modal__field">
              <label htmlFor="wo-assigned" className="wo-modal__label">Responsavel</label>
              <input
                id="wo-assigned"
                type="text"
                className="wo-modal__input"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              />
            </div>

            {/* Pecas consumidas */}
            <section aria-labelledby="parts-section-title">
              <p className="wo-modal__section-title" id="parts-section-title">Pecas consumidas</p>
              {parts.length === 0 ? (
                <p className="wo-modal__parts-empty">Nenhuma peca adicionada.</p>
              ) : (
                <table className="wo-modal__parts-table">
                  <caption className="sr-only">Pecas consumidas na ordem de servico</caption>
                  <thead>
                    <tr>
                      <th scope="col">Produto</th>
                      <th scope="col">Qtd</th>
                      <th scope="col">Custo unit.</th>
                      <th scope="col" className="col-total">Total</th>
                      <th scope="col"><span className="sr-only">Remover</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((part) => {
                      const lineTotal =
                        (parseFloat(part.quantity) || 0) * (parseFloat(part.unitCost) || 0);
                      return (
                        <tr key={part.key}>
                          <td>
                            <select
                              className="wo-modal__part-input"
                              value={part.productId}
                              onChange={(e) => updatePart(part.key, 'productId', e.target.value)}
                              aria-label="Selecionar produto"
                            >
                              <option value="">Selecionar produto</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              className="wo-modal__part-input"
                              value={part.quantity}
                              onChange={(e) => updatePart(part.key, 'quantity', e.target.value)}
                              aria-label="Quantidade"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="wo-modal__part-input"
                              value={part.unitCost}
                              onChange={(e) => updatePart(part.key, 'unitCost', e.target.value)}
                              aria-label="Custo unitario"
                            />
                          </td>
                          <td className="col-total">{formatBRL(lineTotal)}</td>
                          <td>
                            <button
                              type="button"
                              className="wo-modal__remove-btn"
                              onClick={() => removePart(part.key)}
                              aria-label="Remover peca"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <button
                type="button"
                className="wo-modal__add-part-btn"
                onClick={addPartRow}
              >
                <Plus size={16} aria-hidden="true" />
                Adicionar peca
              </button>
            </section>

            {/* Mao de obra */}
            <section aria-labelledby="labor-section-title">
              <p className="wo-modal__section-title" id="labor-section-title">Mao de obra</p>
              <div className="wo-modal__row">
                <div className="wo-modal__field">
                  <label htmlFor="wo-labor-hours" className="wo-modal__label">Horas trabalhadas</label>
                  <input
                    id="wo-labor-hours"
                    type="number"
                    min="0"
                    step="0.5"
                    className="wo-modal__input"
                    value={laborHours}
                    onChange={(e) => setLaborHours(e.target.value)}
                  />
                </div>
                <div className="wo-modal__field">
                  <label htmlFor="wo-labor-rate" className="wo-modal__label">Custo por hora (R$)</label>
                  <input
                    id="wo-labor-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    className="wo-modal__input"
                    value={laborCostPerHour}
                    onChange={(e) => setLaborCostPerHour(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Custo externo */}
            <section aria-labelledby="ext-section-title">
              <p className="wo-modal__section-title" id="ext-section-title">Custo externo</p>
              <div className="wo-modal__row">
                <div className="wo-modal__field">
                  <label htmlFor="wo-ext-cost" className="wo-modal__label">Valor (R$)</label>
                  <input
                    id="wo-ext-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    className="wo-modal__input"
                    value={externalCost}
                    onChange={(e) => setExternalCost(e.target.value)}
                  />
                </div>
                <div className="wo-modal__field">
                  <label htmlFor="wo-ext-supplier" className="wo-modal__label">Fornecedor</label>
                  <input
                    id="wo-ext-supplier"
                    type="text"
                    className="wo-modal__input"
                    value={externalSupplier}
                    onChange={(e) => setExternalSupplier(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Cost summary */}
            <div className="wo-modal__cost-summary" aria-live="polite">
              <span>Total estimado:</span>
              <span className="wo-modal__cost-summary-value">{formatBRL(grandTotal)}</span>
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="wo-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="wo-modal__footer">
            <button
              type="button"
              className="wo-modal__btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="wo-modal__btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar OS'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// Re-export input type for consumers
export type { AddWorkOrderPartInput };
