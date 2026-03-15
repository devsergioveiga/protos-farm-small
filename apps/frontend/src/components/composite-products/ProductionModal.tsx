import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { CompositeProductDetail, CompositeIngredientItem } from '@/types/composite-product';
import './ProductionModal.css';

interface IngredientUsage {
  productId: string;
  productName: string;
  unit: string | null;
  quantityUsed: string;
  recipeQty: number;
  sourceBatchNumber: string;
}

interface Props {
  isOpen: boolean;
  compositeProductId: string;
  compositeProductName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default function ProductionModal({
  isOpen,
  compositeProductId,
  compositeProductName,
  onClose,
  onSuccess,
}: Props) {
  const [productionDate, setProductionDate] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantityProduced, setQuantityProduced] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [notes, setNotes] = useState('');
  const [ingredientUsages, setIngredientUsages] = useState<IngredientUsage[]>([]);
  const [compositeDetail, setCompositeDetail] = useState<CompositeProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecipe = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const detail = await api.get<CompositeProductDetail>(
        `/org/products/${compositeProductId}/composite`,
      );
      setCompositeDetail(detail);

      // Pre-fill ingredient usages from recipe
      setIngredientUsages(
        detail.ingredients.map((ing: CompositeIngredientItem) => ({
          productId: ing.ingredientProductId,
          productName: ing.ingredientProductName,
          unit: ing.ingredientMeasurementUnit,
          quantityUsed: String(ing.quantityPerBatch),
          recipeQty: ing.quantityPerBatch,
          sourceBatchNumber: '',
        })),
      );
    } catch {
      setError('Não foi possível carregar a receita do produto composto.');
    } finally {
      setIsLoading(false);
    }
  }, [compositeProductId]);

  useEffect(() => {
    if (isOpen) {
      setProductionDate(new Date().toISOString().slice(0, 10));
      setBatchNumber('');
      setQuantityProduced('');
      setResponsibleName('');
      setNotes('');
      void loadRecipe();
    }
  }, [isOpen, loadRecipe]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleIngredientChange = useCallback(
    (idx: number, field: 'quantityUsed' | 'sourceBatchNumber', value: string) => {
      setIngredientUsages((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
      );
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    const payload = {
      compositeProductId,
      productionDate,
      batchNumber: batchNumber.trim() || null,
      quantityProduced: Number(quantityProduced),
      responsibleName: responsibleName.trim(),
      notes: notes.trim() || null,
      ingredients: ingredientUsages.map((item) => ({
        productId: item.productId,
        quantityUsed: Number(item.quantityUsed),
        sourceBatchNumber: item.sourceBatchNumber.trim() || null,
      })),
    };

    try {
      await api.post('/org/composite-productions', payload);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar produção.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  }, [
    compositeProductId,
    productionDate,
    batchNumber,
    quantityProduced,
    responsibleName,
    notes,
    ingredientUsages,
    onSuccess,
  ]);

  if (!isOpen) return null;

  const canSave =
    productionDate &&
    Number(quantityProduced) > 0 &&
    responsibleName.trim() &&
    ingredientUsages.every((item) => Number(item.quantityUsed) > 0) &&
    !isSaving;

  return (
    <div className="cp-modal__overlay" onClick={onClose}>
      <div
        className="cp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Registrar produção de ${compositeProductName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cp-modal__header">
          <div>
            <h2>Registrar produção</h2>
            <p className="cp-modal__subtitle">
              {compositeProductName}
              {compositeDetail
                ? ` — lote de ${compositeDetail.batchSize} ${compositeDetail.batchUnit}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            className="cp-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="cp-modal__body">
          {error && (
            <div className="cp-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {isLoading && (
            <div className="cp-modal__skeleton">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="cp-modal__skeleton-row" />
              ))}
            </div>
          )}

          {!isLoading && (
            <>
              <div className="cp-modal__row">
                <div className="cp-modal__field">
                  <label htmlFor="cp-prod-date">
                    Data da produção <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="cp-prod-date"
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    aria-required="true"
                  />
                </div>
                <div className="cp-modal__field">
                  <label htmlFor="cp-batch-number">Número do lote</label>
                  <input
                    id="cp-batch-number"
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="Ex: LOTE-2026-001"
                  />
                </div>
              </div>

              <div className="cp-modal__row">
                <div className="cp-modal__field">
                  <label htmlFor="cp-qty-produced">
                    Quantidade produzida {compositeDetail ? `(${compositeDetail.batchUnit})` : ''}{' '}
                    <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="cp-qty-produced"
                    type="number"
                    step="any"
                    min="0.01"
                    value={quantityProduced}
                    onChange={(e) => setQuantityProduced(e.target.value)}
                    placeholder={compositeDetail ? String(compositeDetail.batchSize) : ''}
                    aria-required="true"
                  />
                </div>
                <div className="cp-modal__field">
                  <label htmlFor="cp-responsible">
                    Responsável <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="cp-responsible"
                    type="text"
                    value={responsibleName}
                    onChange={(e) => setResponsibleName(e.target.value)}
                    placeholder="Nome do responsável"
                    aria-required="true"
                  />
                </div>
              </div>

              {ingredientUsages.length > 0 && (
                <>
                  <h3 className="cp-modal__section-title">Ingredientes utilizados</h3>
                  <table className="cp-modal__ingredient-table">
                    <thead>
                      <tr>
                        <th scope="col">Ingrediente</th>
                        <th scope="col">Receita</th>
                        <th scope="col">Qtd utilizada</th>
                        <th scope="col">Lote origem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientUsages.map((item, idx) => (
                        <tr key={item.productId}>
                          <td data-label="Ingrediente">
                            <span className="cp-modal__ingredient-name">{item.productName}</span>
                            {item.unit && (
                              <span className="cp-modal__ingredient-unit"> ({item.unit})</span>
                            )}
                          </td>
                          <td data-label="Receita" className="cp-modal__mono">
                            {item.recipeQty}
                          </td>
                          <td data-label="Qtd utilizada">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={item.quantityUsed}
                              onChange={(e) =>
                                handleIngredientChange(idx, 'quantityUsed', e.target.value)
                              }
                              aria-label={`Quantidade utilizada de ${item.productName}`}
                            />
                          </td>
                          <td data-label="Lote origem">
                            <input
                              type="text"
                              value={item.sourceBatchNumber}
                              onChange={(e) =>
                                handleIngredientChange(idx, 'sourceBatchNumber', e.target.value)
                              }
                              placeholder="Opcional"
                              aria-label={`Lote de origem de ${item.productName}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {compositeDetail && (
                    <p className="cp-modal__subtitle" style={{ margin: 0 }}>
                      Custo estimado da receita:{' '}
                      {formatCurrency(compositeDetail.estimatedCostCents)}
                    </p>
                  )}
                </>
              )}

              <div className="cp-modal__field">
                <label htmlFor="cp-notes">Observações</label>
                <input
                  id="cp-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações opcionais"
                />
              </div>
            </>
          )}
        </div>

        <footer className="cp-modal__footer">
          <button type="button" className="cp-modal__btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="cp-modal__btn--primary"
            disabled={!canSave}
            onClick={handleSave}
          >
            {isSaving ? 'Registrando...' : 'Registrar produção'}
          </button>
        </footer>
      </div>
    </div>
  );
}
