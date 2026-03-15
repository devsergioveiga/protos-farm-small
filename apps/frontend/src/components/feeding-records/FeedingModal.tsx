import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import type {
  CreateFeedingRecordInput,
  FeedingRecordItemInput,
  FeedingRecordResponse,
  RecordLeftoversInput,
} from '@/types/feeding-record';
import { FEEDING_SHIFT_OPTIONS, type FeedingShift } from '@/types/feeding-record';
import './FeedingModal.css';

interface LotOption {
  id: string;
  name: string;
  animalCount: number;
}

interface IngredientOption {
  id: string;
  name: string;
  type: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
  /** If provided, enter leftover-recording mode */
  feedingRecord?: FeedingRecordResponse | null;
}

export default function FeedingModal({ isOpen, onClose, farmId, onSuccess, feedingRecord }: Props) {
  const isLeftoverMode = !!feedingRecord && feedingRecord.totalLeftoverKg == null;

  // ─── Lookup data ────────────────────────────────────────────────
  const [lots, setLots] = useState<LotOption[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);

  // ─── Form state ─────────────────────────────────────────────────
  const [lotId, setLotId] = useState('');
  const [feedingDate, setFeedingDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<FeedingShift>('MORNING');
  const [responsibleName, setResponsibleName] = useState('');
  const [notes, setNotes] = useState('');
  const [deductStock, setDeductStock] = useState(true);
  const [items, setItems] = useState<Array<FeedingRecordItemInput & { key: number }>>([]);

  // ─── Leftover state ─────────────────────────────────────────────
  const [leftoverItems, setLeftoverItems] = useState<
    Array<{ feedingRecordItemId: string; name: string; provided: number; leftoverKg: number }>
  >([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let keyCounter = 0;

  // Fetch lots and ingredients
  useEffect(() => {
    if (!isOpen || !farmId) return;
    const fetchLookups = async () => {
      try {
        const [lotsRes, ingredientsRes] = await Promise.all([
          api.get<{ data: Array<{ id: string; name: string; _count?: { animals: number } }> }>(
            `/org/farms/${farmId}/animal-lots?limit=200`,
          ),
          api.get<{ data: IngredientOption[] }>(`/org/feed-ingredients?limit=200`),
        ]);
        const lotsArr = lotsRes.data ?? [];
        setLots(
          lotsArr.map((l) => ({
            id: l.id,
            name: l.name,
            animalCount: l._count?.animals ?? 0,
          })),
        );
        const ingredientsArr = ingredientsRes.data ?? [];
        setIngredients(
          ingredientsArr.map((i) => ({
            id: i.id,
            name: i.name,
            type: i.type,
          })),
        );
      } catch {
        // silently fail lookups
      }
    };
    void fetchLookups();
  }, [isOpen, farmId]);

  // Load diet when lot changes
  const loadDietForLot = useCallback(
    async (selectedLotId: string) => {
      if (!selectedLotId || !farmId) return;
      try {
        interface AssignmentResponse {
          endDate: string | null;
          diet?: {
            id: string;
            name: string;
            ingredients: Array<{
              feedIngredientId: string;
              feedIngredientName?: string;
              feedIngredient?: { name: string };
              quantityKgDay: number;
            }>;
          };
        }
        const assignments = await api.get<AssignmentResponse[]>(
          `/org/farms/${farmId}/diets/lot-assignments?lotId=${selectedLotId}`,
        );
        const active = Array.isArray(assignments) ? assignments.find((a) => !a.endDate) : null;
        if (active?.diet) {
          const diet = active.diet;
          const dietItems = (diet.ingredients ?? []).map(
            (ing, idx): FeedingRecordItemInput & { key: number } => ({
              key: idx,
              feedIngredientId: ing.feedIngredientId,
              feedIngredientName: ing.feedIngredientName ?? ing.feedIngredient?.name ?? '',
              quantityProvidedKg: ing.quantityKgDay ?? 0,
              productId: null,
            }),
          );
          if (dietItems.length > 0) {
            setItems(dietItems);
          }
        }
      } catch {
        // no diet assigned — that's OK
      }
    },
    [farmId],
  );

  // Initialize form
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (isLeftoverMode && feedingRecord) {
      setLeftoverItems(
        feedingRecord.items.map((item) => ({
          feedingRecordItemId: item.id,
          name: item.feedIngredientName,
          provided: item.quantityProvidedKg,
          leftoverKg: 0,
        })),
      );
    } else {
      setLotId('');
      setFeedingDate(new Date().toISOString().split('T')[0]);
      setShift('MORNING');
      setResponsibleName('');
      setNotes('');
      setDeductStock(true);
      setItems([]);
      setLeftoverItems([]);
    }
  }, [isOpen, feedingRecord, isLeftoverMode]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleLotChange = (newLotId: string) => {
    setLotId(newLotId);
    void loadDietForLot(newLotId);
  };

  const addItem = () => {
    keyCounter += 1;
    setItems((prev) => [
      ...prev,
      {
        key: Date.now() + keyCounter,
        feedIngredientId: '',
        feedIngredientName: '',
        quantityProvidedKg: 0,
        productId: null,
      },
    ]);
  };

  const removeItem = (key: number) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const updateItem = (key: number, field: string, value: string | number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        if (field === 'feedIngredientId') {
          const ing = ingredients.find((ig) => ig.id === value);
          return { ...i, feedIngredientId: value as string, feedIngredientName: ing?.name ?? '' };
        }
        return { ...i, [field]: value };
      }),
    );
  };

  const updateLeftover = (idx: number, value: number) => {
    setLeftoverItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, leftoverKg: value } : item)),
    );
  };

  // ─── Submit ─────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isLeftoverMode && feedingRecord) {
      // Record leftovers
      setIsLoading(true);
      try {
        const payload: RecordLeftoversInput = {
          items: leftoverItems.map((li) => ({
            feedingRecordItemId: li.feedingRecordItemId,
            quantityLeftoverKg: li.leftoverKg,
          })),
        };
        await api.patch(
          `/org/farms/${farmId}/feeding-records/${feedingRecord.id}/leftovers`,
          payload,
        );
        onSuccess();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao registrar sobras.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Validate
    if (!lotId) {
      setError('Selecione o lote.');
      return;
    }
    if (!responsibleName.trim()) {
      setError('Informe o responsável.');
      return;
    }
    if (items.length === 0) {
      setError('Adicione ao menos um ingrediente.');
      return;
    }
    for (const item of items) {
      if (!item.feedIngredientId) {
        setError('Selecione o ingrediente para todos os itens.');
        return;
      }
      if (!item.quantityProvidedKg || item.quantityProvidedKg <= 0) {
        setError(
          `Informe a quantidade fornecida para ${item.feedIngredientName || 'o ingrediente'}.`,
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload: CreateFeedingRecordInput = {
        lotId,
        feedingDate,
        shift,
        responsibleName: responsibleName.trim(),
        notes: notes.trim() || null,
        deductStock,
        items: items.map((i) => ({
          feedIngredientId: i.feedIngredientId,
          feedIngredientName: i.feedIngredientName,
          productId: i.productId ?? null,
          quantityProvidedKg: i.quantityProvidedKg,
        })),
      };

      await api.post(`/org/farms/${farmId}/feeding-records`, payload);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar trato.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalProvided = items.reduce((sum, i) => sum + (i.quantityProvidedKg || 0), 0);

  return (
    <div className="feeding-modal__overlay" onClick={onClose} role="presentation">
      <div
        className="feeding-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isLeftoverMode ? 'Registrar sobras' : 'Registrar trato'}
      >
        {/* Header */}
        <header className="feeding-modal__header">
          <h2>{isLeftoverMode ? 'Registrar Sobras' : 'Registrar Trato'}</h2>
          <button
            type="button"
            className="feeding-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <form onSubmit={handleSubmit} className="feeding-modal__body">
          {error && (
            <div className="feeding-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {isLeftoverMode && feedingRecord ? (
            /* ─── LEFTOVER MODE ────────────────────────────────── */
            <div className="feeding-modal__section">
              <p className="feeding-modal__info">
                Trato de{' '}
                <strong>
                  {feedingRecord.lotName} — {feedingRecord.shiftLabel} (
                  {new Date(feedingRecord.feedingDate + 'T12:00:00').toLocaleDateString('pt-BR')})
                </strong>
              </p>
              <p className="feeding-modal__info">
                Total fornecido: <strong>{feedingRecord.totalProvidedKg.toFixed(1)} kg</strong>
              </p>

              <table className="feeding-modal__table">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Fornecido (kg)</th>
                    <th>Sobra (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {leftoverItems.map((li, idx) => (
                    <tr key={li.feedingRecordItemId}>
                      <td>{li.name}</td>
                      <td className="feeding-modal__mono">{li.provided.toFixed(1)}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={li.provided}
                          step={0.1}
                          value={li.leftoverKg}
                          onChange={(e) => updateLeftover(idx, Number(e.target.value))}
                          aria-label={`Sobra de ${li.name} em kg`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(() => {
                const totalLeftover = leftoverItems.reduce((s, i) => s + i.leftoverKg, 0);
                const pct =
                  feedingRecord.totalProvidedKg > 0
                    ? (totalLeftover / feedingRecord.totalProvidedKg) * 100
                    : 0;
                const alertClass =
                  pct > 10
                    ? 'feeding-modal__alert--excess'
                    : pct === 0
                      ? 'feeding-modal__alert--restriction'
                      : '';
                return (
                  <div className={`feeding-modal__leftover-summary ${alertClass}`}>
                    <span>
                      Total sobra: <strong>{totalLeftover.toFixed(1)} kg</strong> ({pct.toFixed(1)}
                      %)
                    </span>
                    {pct > 10 && (
                      <span className="feeding-modal__alert-badge">
                        <AlertCircle size={14} aria-hidden="true" /> Excesso: possível problema de
                        palatabilidade
                      </span>
                    )}
                    {pct === 0 && totalLeftover === 0 && (
                      <span className="feeding-modal__alert-badge">
                        <AlertCircle size={14} aria-hidden="true" /> Sem sobra: possível restrição
                        alimentar
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ─── CREATE MODE ──────────────────────────────────── */
            <>
              <div className="feeding-modal__row">
                <div className="feeding-modal__field">
                  <label htmlFor="feeding-lot">Lote *</label>
                  <select
                    id="feeding-lot"
                    value={lotId}
                    onChange={(e) => handleLotChange(e.target.value)}
                    required
                    aria-required="true"
                  >
                    <option value="">Selecione o lote</option>
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.name} ({lot.animalCount} animais)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="feeding-modal__row feeding-modal__row--2">
                <div className="feeding-modal__field">
                  <label htmlFor="feeding-date">Data *</label>
                  <input
                    id="feeding-date"
                    type="date"
                    value={feedingDate}
                    onChange={(e) => setFeedingDate(e.target.value)}
                    required
                    aria-required="true"
                  />
                </div>
                <div className="feeding-modal__field">
                  <label htmlFor="feeding-shift">Turno *</label>
                  <select
                    id="feeding-shift"
                    value={shift}
                    onChange={(e) => setShift(e.target.value as FeedingShift)}
                    required
                    aria-required="true"
                  >
                    {FEEDING_SHIFT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="feeding-modal__field">
                <label htmlFor="feeding-responsible">Responsável *</label>
                <input
                  id="feeding-responsible"
                  type="text"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  placeholder="Nome do responsável"
                  required
                  aria-required="true"
                />
              </div>

              {/* Ingredients table */}
              <div className="feeding-modal__section">
                <div className="feeding-modal__section-header">
                  <h3>Ingredientes fornecidos</h3>
                  <button
                    type="button"
                    className="feeding-modal__add-btn"
                    onClick={addItem}
                    aria-label="Adicionar ingrediente"
                  >
                    <Plus size={16} aria-hidden="true" /> Adicionar
                  </button>
                </div>

                {items.length === 0 ? (
                  <p className="feeding-modal__hint">
                    Selecione um lote com dieta vinculada para preencher automaticamente, ou
                    adicione ingredientes manualmente.
                  </p>
                ) : (
                  <table className="feeding-modal__table">
                    <thead>
                      <tr>
                        <th>Ingrediente</th>
                        <th>Quantidade (kg)</th>
                        <th aria-label="Ações"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.key}>
                          <td>
                            <select
                              value={item.feedIngredientId}
                              onChange={(e) =>
                                updateItem(item.key, 'feedIngredientId', e.target.value)
                              }
                              aria-label="Ingrediente"
                            >
                              <option value="">Selecione</option>
                              {ingredients.map((ing) => (
                                <option key={ing.id} value={ing.id}>
                                  {ing.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={item.quantityProvidedKg || ''}
                              onChange={(e) =>
                                updateItem(item.key, 'quantityProvidedKg', Number(e.target.value))
                              }
                              aria-label={`Quantidade de ${item.feedIngredientName || 'ingrediente'} em kg`}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="feeding-modal__remove-btn"
                              onClick={() => removeItem(item.key)}
                              aria-label={`Remover ${item.feedIngredientName || 'ingrediente'}`}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>
                          <strong>Total</strong>
                        </td>
                        <td className="feeding-modal__mono">
                          <strong>{totalProvided.toFixed(1)} kg</strong>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              <div className="feeding-modal__row">
                <label className="feeding-modal__checkbox">
                  <input
                    type="checkbox"
                    checked={deductStock}
                    onChange={(e) => setDeductStock(e.target.checked)}
                  />
                  Deduzir do estoque automaticamente
                </label>
              </div>

              <div className="feeding-modal__field">
                <label htmlFor="feeding-notes">Observações</label>
                <textarea
                  id="feeding-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Observações opcionais..."
                />
              </div>
            </>
          )}

          {/* Footer */}
          <footer className="feeding-modal__footer">
            <button type="button" className="feeding-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="feeding-modal__btn-submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : isLeftoverMode ? 'Registrar sobras' : 'Registrar trato'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
