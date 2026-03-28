import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, AlertCircle, Plus, Trash2, Upload } from 'lucide-react';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useAssets } from '@/hooks/useAssets';
import type {
  WorkOrder,
  WorkOrderType,
  WorkOrderPart,
} from '@/types/maintenance';
import './WorkOrderModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface WorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  workOrder?: WorkOrder;
  assetId?: string; // pre-fill from AssetMaintenanceTab
}

// ─── Field helpers ──────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="wo-modal__field-error" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </span>
  );
}

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: string;
}) {
  return (
    <label htmlFor={htmlFor} className="wo-modal__label">
      {children}
      {required && (
        <span className="wo-modal__required" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  );
}

// ─── Part row for inline table ──────────────────────────────────────────

interface PartRow {
  id: string; // temp id for UI
  productId: string;
  productName: string;
  quantity: string;
  unitCost: string;
}

function newPartRow(): PartRow {
  return {
    id: Math.random().toString(36).slice(2),
    productId: '',
    productName: '',
    quantity: '',
    unitCost: '',
  };
}

// ─── Form data ──────────────────────────────────────────────────────────

interface FormData {
  assetId: string;
  type: WorkOrderType;
  title: string;
  description: string;
  assignedTo: string;
  laborHours: string;
  laborCostPerHour: string;
  externalCost: string;
  externalSupplier: string;
  costCenterId: string;
}

interface FormErrors {
  assetId?: string;
  title?: string;
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function WorkOrderModal({
  isOpen,
  onClose,
  onSuccess,
  workOrder,
  assetId: prefillAssetId,
}: WorkOrderModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);
  const { createWorkOrder, updateWorkOrder } = useWorkOrders();
  const { assets, fetchAssets } = useAssets();

  const [formData, setFormData] = useState<FormData>({
    assetId: prefillAssetId ?? '',
    type: 'CORRETIVA',
    title: '',
    description: '',
    assignedTo: '',
    laborHours: '',
    laborCostPerHour: '',
    externalCost: '',
    externalSupplier: '',
    costCenterId: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Parts state
  const [parts, setParts] = useState<PartRow[]>([]);

  // Photo state (max 5)
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>(workOrder?.photoUrls ?? []);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load assets
  useEffect(() => {
    if (isOpen) {
      void fetchAssets({ limit: 200 });
    }
  }, [isOpen, fetchAssets]);

  // Populate form when editing
  useEffect(() => {
    if (workOrder) {
      setFormData({
        assetId: workOrder.assetId,
        type: workOrder.type as WorkOrderType,
        title: workOrder.title,
        description: workOrder.description ?? '',
        assignedTo: workOrder.assignedTo ?? '',
        laborHours: workOrder.laborHours ? String(workOrder.laborHours) : '',
        laborCostPerHour: workOrder.laborCostPerHour ? String(workOrder.laborCostPerHour) : '',
        externalCost: workOrder.externalCost ? String(workOrder.externalCost) : '',
        externalSupplier: '',
        costCenterId: workOrder.costCenterId ?? '',
      });
      // Map existing parts to PartRows
      setParts(
        workOrder.parts.map((p: WorkOrderPart) => ({
          id: p.id,
          productId: p.productId,
          productName: p.product?.name ?? '',
          quantity: String(p.quantity),
          unitCost: String(p.unitCost),
        })),
      );
      setPhotoUrls(workOrder.photoUrls ?? []);
    } else {
      setFormData({
        assetId: prefillAssetId ?? '',
        type: 'CORRETIVA',
        title: '',
        description: '',
        assignedTo: '',
        laborHours: '',
        laborCostPerHour: '',
        externalCost: '',
        externalSupplier: '',
        costCenterId: '',
      });
      setParts([]);
      setPhotoUrls([]);
    }
    setPhotoFiles([]);
    setErrors({});
    setSubmitError(null);
  }, [workOrder, prefillAssetId, isOpen]);

  // Focus first field on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstFocusRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape closes
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function setField(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'assetId' || field === 'title') {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // ─── Parts management ─────────────────────────────────────────────────

  function addPart() {
    setParts((prev) => [...prev, newPartRow()]);
  }

  function updatePart(id: string, field: keyof PartRow, value: string) {
    setParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  }

  function removePart(id: string) {
    setParts((prev) => prev.filter((p) => p.id !== id));
  }

  // ─── Cost summary ─────────────────────────────────────────────────────

  const totalCost = useMemo(() => {
    const partsCost = parts.reduce((sum, p) => {
      const qty = Number(p.quantity) || 0;
      const cost = Number(p.unitCost) || 0;
      return sum + qty * cost;
    }, 0);
    const laborH = Number(formData.laborHours) || 0;
    const laborRate = Number(formData.laborCostPerHour) || 0;
    const laborCost = laborH * laborRate;
    const extCost = Number(formData.externalCost) || 0;
    return partsCost + laborCost + extCost;
  }, [parts, formData.laborHours, formData.laborCostPerHour, formData.externalCost]);

  // ─── Photo upload ─────────────────────────────────────────────────────

  const totalPhotos = photoFiles.length + photoUrls.length;

  function handleFileSelect(files: FileList | null) {
    if (!files) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const newFiles: File[] = [];
    let hasInvalidType = false;
    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type)) {
        hasInvalidType = true;
        continue;
      }
      if (totalPhotos + newFiles.length >= 5) break;
      newFiles.push(file);
    }
    if (hasInvalidType) {
      setSubmitError('Apenas imagens JPG, PNG ou WEBP sao aceitas.');
    }
    setPhotoFiles((prev) => [...prev, ...newFiles].slice(0, 5 - photoUrls.length));
  }

  function removeNewPhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExistingPhoto(index: number) {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Validation ───────────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!formData.assetId) newErrors.assetId = 'Selecione um ativo.';
    if (!formData.title.trim()) newErrors.title = 'Titulo e obrigatorio.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ─── Submit ───────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const input = {
        assetId: formData.assetId,
        type: formData.type,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        assignedTo: formData.assignedTo.trim() || undefined,
        costCenterId: formData.costCenterId || undefined,
        photoUrls: photoUrls,
      };

      if (workOrder) {
        await updateWorkOrder(workOrder.id, {
          title: input.title,
          description: input.description,
          assignedTo: input.assignedTo,
        });
        onSuccess('OS atualizada.');
      } else {
        const created = await createWorkOrder(input);
        const assetName = assets.find((a) => a.id === formData.assetId)?.name ?? 'Ativo';
        onSuccess(`OS aberta. ${assetName} em manutencao.`);
        return created;
      }
    } catch {
      setSubmitError('Nao foi possivel salvar. Verifique sua conexao e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="wo-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={workOrder ? 'Editar OS' : 'Abrir OS'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="wo-modal__dialog" ref={modalRef}>
        {/* Header */}
        <header className="wo-modal__header">
          <h2 className="wo-modal__title">{workOrder ? 'Editar OS' : 'Abrir OS'}</h2>
          <button
            type="button"
            className="wo-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="wo-modal__body">
            {submitError && (
              <div className="wo-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Ativo vinculado */}
            <div className="wo-modal__field">
              <Label htmlFor="wo-asset" required>
                Ativo vinculado
              </Label>
              <select
                id="wo-asset"
                className={`wo-modal__select ${errors.assetId ? 'wo-modal__select--error' : ''}`}
                value={formData.assetId}
                onChange={(e) => setField('assetId', e.target.value)}
                onBlur={() => {
                  if (!formData.assetId)
                    setErrors((prev) => ({ ...prev, assetId: 'Selecione um ativo.' }));
                }}
                aria-required="true"
              >
                <option value="">Selecione um ativo...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.assetTag})
                  </option>
                ))}
              </select>
              {errors.assetId && <FieldError message={errors.assetId} />}
            </div>

            {/* Tipo */}
            <fieldset className="wo-modal__fieldset">
              <legend className="wo-modal__legend">
                Tipo <span className="wo-modal__required" aria-hidden="true">*</span>
              </legend>
              <div className="wo-modal__radio-group">
                {(['CORRETIVA', 'PREVENTIVA', 'SOLICITACAO'] as WorkOrderType[]).map((type) => {
                  const label =
                    type === 'CORRETIVA' ? 'Corretiva' : type === 'PREVENTIVA' ? 'Preventiva' : 'Solicitacao';
                  return (
                    <label key={type} className="wo-modal__radio-label">
                      <input
                        type="radio"
                        name="wo-type"
                        value={type}
                        checked={formData.type === type}
                        onChange={() => setField('type', type)}
                        className="wo-modal__radio"
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Titulo */}
            <div className="wo-modal__field">
              <Label htmlFor="wo-title" required>
                Titulo
              </Label>
              <input
                ref={firstFocusRef}
                id="wo-title"
                type="text"
                className={`wo-modal__input ${errors.title ? 'wo-modal__input--error' : ''}`}
                value={formData.title}
                onChange={(e) => setField('title', e.target.value)}
                onBlur={() => {
                  if (!formData.title.trim())
                    setErrors((prev) => ({ ...prev, title: 'Titulo e obrigatorio.' }));
                }}
                aria-required="true"
                placeholder="Ex: Troca de filtros de ar"
              />
              {errors.title && <FieldError message={errors.title} />}
            </div>

            {/* Descricao */}
            <div className="wo-modal__field">
              <label htmlFor="wo-description" className="wo-modal__label">
                Descricao
              </label>
              <textarea
                id="wo-description"
                className="wo-modal__textarea"
                value={formData.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={3}
                placeholder="Detalhes sobre o problema ou servico necessario"
              />
            </div>

            {/* Responsavel */}
            <div className="wo-modal__field">
              <label htmlFor="wo-assigned" className="wo-modal__label">
                Responsavel
              </label>
              <input
                id="wo-assigned"
                type="text"
                className="wo-modal__input"
                value={formData.assignedTo}
                onChange={(e) => setField('assignedTo', e.target.value)}
                placeholder="Nome do mecanico ou tecnico responsavel"
              />
            </div>

            {/* Pecas consumidas */}
            <section className="wo-modal__section" aria-label="Pecas consumidas">
              <h3 className="wo-modal__section-title">Pecas consumidas</h3>
              {parts.length > 0 && (
                <div className="wo-modal__parts-table-wrapper">
                  <table className="wo-modal__parts-table">
                    <caption className="sr-only">Pecas consumidas na OS</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="wo-modal__parts-th">Produto</th>
                        <th scope="col" className="wo-modal__parts-th wo-modal__parts-th--num">Qtd</th>
                        <th scope="col" className="wo-modal__parts-th wo-modal__parts-th--num">Custo unit. (R$)</th>
                        <th scope="col" className="wo-modal__parts-th wo-modal__parts-th--num">Total</th>
                        <th scope="col" className="wo-modal__parts-th wo-modal__parts-th--action" aria-label="Remover"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((part) => {
                        const partTotal = (Number(part.quantity) || 0) * (Number(part.unitCost) || 0);
                        return (
                          <tr key={part.id} className="wo-modal__parts-tr">
                            <td className="wo-modal__parts-td">
                              <input
                                type="text"
                                className="wo-modal__parts-input"
                                value={part.productName}
                                onChange={(e) => updatePart(part.id, 'productName', e.target.value)}
                                placeholder="Nome do produto"
                                aria-label="Produto"
                              />
                            </td>
                            <td className="wo-modal__parts-td wo-modal__parts-td--num">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="wo-modal__parts-input wo-modal__parts-input--num"
                                value={part.quantity}
                                onChange={(e) => updatePart(part.id, 'quantity', e.target.value)}
                                aria-label="Quantidade"
                              />
                            </td>
                            <td className="wo-modal__parts-td wo-modal__parts-td--num">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="wo-modal__parts-input wo-modal__parts-input--num"
                                value={part.unitCost}
                                onChange={(e) => updatePart(part.id, 'unitCost', e.target.value)}
                                aria-label="Custo unitario"
                              />
                            </td>
                            <td className="wo-modal__parts-td wo-modal__parts-td--num wo-modal__parts-td--mono">
                              {partTotal.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="wo-modal__parts-td wo-modal__parts-td--action">
                              <button
                                type="button"
                                className="wo-modal__parts-remove"
                                onClick={() => removePart(part.id)}
                                aria-label={`Remover peca ${part.productName || ''}`}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <button
                type="button"
                className="wo-modal__add-part-btn"
                onClick={addPart}
              >
                <Plus size={16} aria-hidden="true" />
                Adicionar peca
              </button>
            </section>

            {/* Mao de obra */}
            <section className="wo-modal__section" aria-label="Mao de obra">
              <h3 className="wo-modal__section-title">Mao de obra</h3>
              <div className="wo-modal__grid-2">
                <div className="wo-modal__field">
                  <label htmlFor="wo-labor-hours" className="wo-modal__label">
                    Horas trabalhadas
                  </label>
                  <input
                    id="wo-labor-hours"
                    type="number"
                    min="0"
                    step="0.5"
                    className="wo-modal__input"
                    value={formData.laborHours}
                    onChange={(e) => setField('laborHours', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="wo-modal__field">
                  <label htmlFor="wo-labor-rate" className="wo-modal__label">
                    Custo/hora (R$)
                  </label>
                  <input
                    id="wo-labor-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    className="wo-modal__input"
                    value={formData.laborCostPerHour}
                    onChange={(e) => setField('laborCostPerHour', e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
            </section>

            {/* Custo externo */}
            <section className="wo-modal__section" aria-label="Custo externo">
              <h3 className="wo-modal__section-title">Custo externo</h3>
              <div className="wo-modal__grid-2">
                <div className="wo-modal__field">
                  <label htmlFor="wo-ext-cost" className="wo-modal__label">
                    Valor (R$)
                  </label>
                  <input
                    id="wo-ext-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    className="wo-modal__input"
                    value={formData.externalCost}
                    onChange={(e) => setField('externalCost', e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="wo-modal__field">
                  <label htmlFor="wo-ext-supplier" className="wo-modal__label">
                    Fornecedor externo
                  </label>
                  <input
                    id="wo-ext-supplier"
                    type="text"
                    className="wo-modal__input"
                    value={formData.externalSupplier}
                    onChange={(e) => setField('externalSupplier', e.target.value)}
                    placeholder="Nome da oficina ou fornecedor"
                  />
                </div>
              </div>
            </section>

            {/* Fotos */}
            <section className="wo-modal__section" aria-label="Fotos">
              <h3 className="wo-modal__section-title">
                Fotos <span className="wo-modal__photo-counter">{totalPhotos}/5</span>
              </h3>

              {/* Existing photo thumbnails */}
              {(photoUrls.length > 0 || photoFiles.length > 0) && (
                <div className="wo-modal__photo-grid">
                  {photoUrls.map((url, i) => (
                    <div key={url} className="wo-modal__photo-thumb">
                      <img src={url} alt={`Foto ${i + 1}`} className="wo-modal__photo-img" />
                      <button
                        type="button"
                        className="wo-modal__photo-remove"
                        onClick={() => removeExistingPhoto(i)}
                        aria-label={`Remover foto ${i + 1}`}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {photoFiles.map((file, i) => {
                    const objUrl = URL.createObjectURL(file);
                    return (
                      <div key={file.name + i} className="wo-modal__photo-thumb">
                        <img src={objUrl} alt={`Nova foto ${i + 1}`} className="wo-modal__photo-img" />
                        <button
                          type="button"
                          className="wo-modal__photo-remove"
                          onClick={() => removeNewPhoto(i)}
                          aria-label={`Remover foto ${photoUrls.length + i + 1}`}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Upload zone */}
              {totalPhotos < 5 && (
                <div
                  className={`wo-modal__photo-zone ${dragOver ? 'wo-modal__photo-zone--drag-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFileSelect(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Adicionar fotos — arraste ou clique para selecionar"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Upload size={24} aria-hidden="true" className="wo-modal__photo-zone-icon" />
                  <span className="wo-modal__photo-zone-text">
                    Arraste ou clique para adicionar fotos
                  </span>
                  <span className="wo-modal__photo-zone-hint">JPG, PNG, WEBP — max 5 fotos</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>
              )}
            </section>

            {/* Centro de custo */}
            <div className="wo-modal__field">
              <label htmlFor="wo-cost-center" className="wo-modal__label">
                Centro de custo
              </label>
              <input
                id="wo-cost-center"
                type="text"
                className="wo-modal__input"
                value={formData.costCenterId}
                onChange={(e) => setField('costCenterId', e.target.value)}
                placeholder="ID do centro de custo (opcional — herda do ativo)"
              />
            </div>

            {/* Cost summary */}
            <div className="wo-modal__cost-summary">
              <span className="wo-modal__cost-label">Total estimado:</span>
              <span className="wo-modal__cost-value">
                {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          {/* Footer */}
          <footer className="wo-modal__footer">
            <button
              type="button"
              className="wo-modal__btn wo-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="wo-modal__btn wo-modal__btn--primary"
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
