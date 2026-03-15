import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { CompositeProductDetail } from '@/types/composite-product';
import { COMPOSITE_TYPES } from '@/types/composite-product';
import './CompositeSetupModal.css';

interface OrgProduct {
  id: string;
  name: string;
  measurementUnitAbbreviation: string | null;
}

interface IngredientRow {
  key: string;
  ingredientProductId: string;
  quantityPerBatch: string;
  sortOrder: number;
  notes: string;
}

interface Props {
  isOpen: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
}

let rowKeyCounter = 0;
function nextRowKey(): string {
  return `ing-${++rowKeyCounter}`;
}

export default function CompositeSetupModal({
  isOpen,
  productId,
  productName,
  onClose,
  onSuccess,
}: Props) {
  const [compositeType, setCompositeType] = useState('');
  const [batchSize, setBatchSize] = useState('');
  const [batchUnit, setBatchUnit] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [orgProducts, setOrgProducts] = useState<OrgProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [productsRes, compositeRes] = await Promise.allSettled([
        api.get<{ data: OrgProduct[] }>('/org/products?limit=500&nature=PRODUCT&status=ACTIVE'),
        api.get<CompositeProductDetail>(`/org/products/${productId}/composite`),
      ]);

      if (productsRes.status === 'fulfilled') {
        setOrgProducts(productsRes.value.data.filter((p) => p.id !== productId));
      }

      if (compositeRes.status === 'fulfilled') {
        const detail = compositeRes.value;
        setCompositeType(detail.compositeType);
        setBatchSize(String(detail.batchSize));
        setBatchUnit(detail.batchUnit);
        setIngredients(
          detail.ingredients.map((ing) => ({
            key: nextRowKey(),
            ingredientProductId: ing.ingredientProductId,
            quantityPerBatch: String(ing.quantityPerBatch),
            sortOrder: ing.sortOrder,
            notes: ing.notes ?? '',
          })),
        );
      } else {
        // No composite data yet
        setCompositeType('');
        setBatchSize('');
        setBatchUnit('');
        setIngredients([]);
      }
    } catch {
      setError('Não foi possível carregar os dados.');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen, loadData]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleAddIngredient = useCallback(() => {
    setIngredients((prev) => [
      ...prev,
      {
        key: nextRowKey(),
        ingredientProductId: '',
        quantityPerBatch: '',
        sortOrder: prev.length + 1,
        notes: '',
      },
    ]);
  }, []);

  const handleRemoveIngredient = useCallback((key: string) => {
    setIngredients((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const handleIngredientChange = useCallback(
    (key: string, field: keyof IngredientRow, value: string) => {
      setIngredients((prev) =>
        prev.map((r) => {
          if (r.key !== key) return r;
          if (field === 'sortOrder') return { ...r, [field]: Number(value) || 0 };
          return { ...r, [field]: value };
        }),
      );
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    const payload = {
      isComposite: true,
      compositeType,
      batchSize: Number(batchSize),
      batchUnit: batchUnit.trim(),
      ingredients: ingredients.map((r, idx) => ({
        ingredientProductId: r.ingredientProductId,
        quantityPerBatch: Number(r.quantityPerBatch),
        sortOrder: r.sortOrder || idx + 1,
        notes: r.notes.trim() || null,
      })),
    };

    try {
      await api.put(`/org/products/${productId}/composite`, payload);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar composição.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  }, [productId, compositeType, batchSize, batchUnit, ingredients, onSuccess]);

  if (!isOpen) return null;

  const canSave =
    compositeType &&
    Number(batchSize) > 0 &&
    batchUnit.trim() &&
    ingredients.length > 0 &&
    ingredients.every((r) => r.ingredientProductId && Number(r.quantityPerBatch) > 0) &&
    !isSaving;

  return (
    <div className="cs-modal__overlay" onClick={onClose}>
      <div
        className="cs-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar composição de ${productName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cs-modal__header">
          <div>
            <h2>Configurar composição</h2>
            <p className="cs-modal__subtitle">{productName}</p>
          </div>
          <button
            type="button"
            className="cs-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="cs-modal__body">
          {error && (
            <div className="cs-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {isLoading && (
            <div className="cs-modal__skeleton">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="cs-modal__skeleton-row" />
              ))}
            </div>
          )}

          {!isLoading && (
            <>
              <div className="cs-modal__field">
                <label htmlFor="cs-composite-type">
                  Tipo de composição <span aria-hidden="true">*</span>
                </label>
                <select
                  id="cs-composite-type"
                  value={compositeType}
                  onChange={(e) => setCompositeType(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione...</option>
                  {COMPOSITE_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cs-modal__row">
                <div className="cs-modal__field">
                  <label htmlFor="cs-batch-size">
                    Tamanho do lote <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="cs-batch-size"
                    type="number"
                    step="any"
                    min="0.01"
                    value={batchSize}
                    onChange={(e) => setBatchSize(e.target.value)}
                    placeholder="Ex: 100"
                    aria-required="true"
                  />
                </div>
                <div className="cs-modal__field">
                  <label htmlFor="cs-batch-unit">
                    Unidade do lote <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="cs-batch-unit"
                    type="text"
                    value={batchUnit}
                    onChange={(e) => setBatchUnit(e.target.value)}
                    placeholder="Ex: kg, L"
                    aria-required="true"
                  />
                </div>
              </div>

              <h3 className="cs-modal__section-title">Ingredientes</h3>

              <div className="cs-modal__ingredient-list">
                {ingredients.map((row) => (
                  <div key={row.key} className="cs-modal__ingredient-item">
                    <div className="cs-modal__field">
                      <label htmlFor={`cs-ing-product-${row.key}`}>
                        Produto <span aria-hidden="true">*</span>
                      </label>
                      <select
                        id={`cs-ing-product-${row.key}`}
                        value={row.ingredientProductId}
                        onChange={(e) =>
                          handleIngredientChange(row.key, 'ingredientProductId', e.target.value)
                        }
                        aria-required="true"
                      >
                        <option value="">Selecione...</option>
                        {orgProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.measurementUnitAbbreviation
                              ? ` (${p.measurementUnitAbbreviation})`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="cs-modal__field cs-modal__field--narrow">
                      <label htmlFor={`cs-ing-qty-${row.key}`}>
                        Qtd/lote <span aria-hidden="true">*</span>
                      </label>
                      <input
                        id={`cs-ing-qty-${row.key}`}
                        type="number"
                        step="any"
                        min="0.01"
                        value={row.quantityPerBatch}
                        onChange={(e) =>
                          handleIngredientChange(row.key, 'quantityPerBatch', e.target.value)
                        }
                        aria-required="true"
                      />
                    </div>
                    <div className="cs-modal__field cs-modal__field--narrow">
                      <label htmlFor={`cs-ing-order-${row.key}`}>Ordem</label>
                      <input
                        id={`cs-ing-order-${row.key}`}
                        type="number"
                        min="1"
                        value={row.sortOrder}
                        onChange={(e) =>
                          handleIngredientChange(row.key, 'sortOrder', e.target.value)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="cs-modal__ingredient-remove"
                      onClick={() => handleRemoveIngredient(row.key)}
                      aria-label={`Remover ingrediente`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className="cs-modal__btn-add" onClick={handleAddIngredient}>
                <Plus size={16} aria-hidden="true" />
                Adicionar ingrediente
              </button>
            </>
          )}
        </div>

        <footer className="cs-modal__footer">
          <button type="button" className="cs-modal__btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="cs-modal__btn--primary"
            disabled={!canSave}
            onClick={handleSave}
          >
            {isSaving ? 'Salvando...' : 'Salvar composição'}
          </button>
        </footer>
      </div>
    </div>
  );
}
