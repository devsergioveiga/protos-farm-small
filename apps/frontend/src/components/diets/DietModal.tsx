import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, AlertCircle, Loader2, FlaskConical } from 'lucide-react';
import { api } from '@/services/api';
import type {
  DietDetail,
  CreateDietInput,
  UpdateDietInput,
  DietIngredientInput,
  FeedIngredientOption,
  SimulationResult,
  NutrientCalculation,
} from '@/types/diet';
import { ANIMAL_CATEGORIES } from '@/types/diet';
import './DietModal.css';

interface DietModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editDiet?: DietDetail | null;
}

interface IngredientRow {
  key: string;
  feedIngredientId: string;
  quantityKgDay: string;
  notes: string;
}

let rowKeyCounter = 0;
function nextKey(): string {
  return `row-${++rowKeyCounter}`;
}

export default function DietModal({ isOpen, onClose, onSuccess, editDiet }: DietModalProps) {
  const [name, setName] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nutritionist, setNutritionist] = useState('');
  const [objective, setObjective] = useState('');
  const [notes, setNotes] = useState('');
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([]);

  const [feedIngredients, setFeedIngredients] = useState<FeedIngredientOption[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editDiet;

  // Load feed ingredients for select
  useEffect(() => {
    if (!isOpen) return;
    setFeedLoading(true);
    api
      .get<{ data: FeedIngredientOption[] }>('/org/feed-ingredients?limit=100')
      .then((res) => setFeedIngredients(res.data))
      .catch(() => setFeedIngredients([]))
      .finally(() => setFeedLoading(false));
  }, [isOpen]);

  // Populate form if editing
  useEffect(() => {
    if (!isOpen) return;
    if (editDiet) {
      setName(editDiet.name);
      setTargetCategory(editDiet.targetCategory);
      setStartDate(editDiet.startDate ?? '');
      setEndDate(editDiet.endDate ?? '');
      setNutritionist(editDiet.nutritionist ?? '');
      setObjective(editDiet.objective ?? '');
      setNotes(editDiet.notes ?? '');
      setIngredientRows(
        editDiet.ingredients.map((i) => ({
          key: nextKey(),
          feedIngredientId: i.feedIngredientId,
          quantityKgDay: String(i.quantityKgDay),
          notes: i.notes ?? '',
        })),
      );
      setSimulation(null);
    } else {
      setName('');
      setTargetCategory('');
      setStartDate('');
      setEndDate('');
      setNutritionist('');
      setObjective('');
      setNotes('');
      setIngredientRows([{ key: nextKey(), feedIngredientId: '', quantityKgDay: '', notes: '' }]);
      setSimulation(null);
    }
    setError(null);
  }, [isOpen, editDiet]);

  const addRow = useCallback(() => {
    setIngredientRows((prev) => [
      ...prev,
      { key: nextKey(), feedIngredientId: '', quantityKgDay: '', notes: '' },
    ]);
  }, []);

  const removeRow = useCallback((key: string) => {
    setIngredientRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const updateRow = useCallback((key: string, field: keyof IngredientRow, value: string) => {
    setIngredientRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }, []);

  // CA7: Simulate
  const handleSimulate = useCallback(async () => {
    const valid = ingredientRows.filter(
      (r) => r.feedIngredientId && parseFloat(r.quantityKgDay) > 0,
    );
    if (valid.length === 0) {
      setError('Adicione ao menos um ingrediente com quantidade para simular');
      return;
    }
    setSimLoading(true);
    setError(null);
    try {
      const result = await api.post<SimulationResult>('/org/diets/simulate', {
        ingredients: valid.map((r, idx) => ({
          feedIngredientId: r.feedIngredientId,
          quantityKgDay: parseFloat(r.quantityKgDay),
          sortOrder: idx,
        })),
      });
      setSimulation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao simular dieta');
    } finally {
      setSimLoading(false);
    }
  }, [ingredientRows]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const ingredients: DietIngredientInput[] = ingredientRows
        .filter((r) => r.feedIngredientId && parseFloat(r.quantityKgDay) > 0)
        .map((r, idx) => ({
          feedIngredientId: r.feedIngredientId,
          quantityKgDay: parseFloat(r.quantityKgDay),
          sortOrder: idx,
          notes: r.notes.trim() || null,
        }));

      if (ingredients.length === 0) {
        setError('Adicione ao menos um ingrediente');
        return;
      }

      setSaving(true);
      try {
        if (isEdit) {
          const payload: UpdateDietInput = {
            name: name.trim(),
            targetCategory: targetCategory.trim(),
            startDate: startDate || null,
            endDate: endDate || null,
            nutritionist: nutritionist.trim() || null,
            objective: objective.trim() || null,
            notes: notes.trim() || null,
            ingredients,
          };
          await api.put(`/org/diets/${editDiet!.id}`, payload);
        } else {
          const payload: CreateDietInput = {
            name: name.trim(),
            targetCategory: targetCategory.trim(),
            startDate: startDate || null,
            endDate: endDate || null,
            nutritionist: nutritionist.trim() || null,
            objective: objective.trim() || null,
            notes: notes.trim() || null,
            ingredients,
          };
          await api.post('/org/diets', payload);
        }
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar dieta');
      } finally {
        setSaving(false);
      }
    },
    [
      name,
      targetCategory,
      startDate,
      endDate,
      nutritionist,
      objective,
      notes,
      ingredientRows,
      isEdit,
      editDiet,
      onSuccess,
    ],
  );

  if (!isOpen) return null;

  return (
    <div className="diet-modal__overlay" onClick={onClose} aria-hidden="true">
      <div
        className="diet-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Editar dieta' : 'Nova dieta'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="diet-modal__header">
          <h2>{isEdit ? 'Editar dieta' : 'Nova dieta'}</h2>
          <button type="button" className="diet-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="diet-modal__body">
          {error && (
            <div className="diet-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Basic fields */}
          <div className="diet-modal__grid">
            <div className="diet-modal__field">
              <label htmlFor="diet-name">
                Nome <span aria-hidden="true">*</span>
              </label>
              <input
                id="diet-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                aria-required="true"
                placeholder="Ex: Dieta Vacas Lactação 30L"
              />
            </div>

            <div className="diet-modal__field">
              <label htmlFor="diet-category">
                Categoria alvo <span aria-hidden="true">*</span>
              </label>
              <select
                id="diet-category"
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                required
                aria-required="true"
              >
                <option value="">Selecione...</option>
                {ANIMAL_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="diet-modal__field">
              <label htmlFor="diet-start">Data inicial</label>
              <input
                id="diet-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="diet-modal__field">
              <label htmlFor="diet-end">Data final</label>
              <input
                id="diet-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="diet-modal__field">
              <label htmlFor="diet-nutritionist">Nutricionista</label>
              <input
                id="diet-nutritionist"
                type="text"
                value={nutritionist}
                onChange={(e) => setNutritionist(e.target.value)}
                placeholder="Nome do nutricionista"
              />
            </div>

            <div className="diet-modal__field">
              <label htmlFor="diet-objective">Objetivo</label>
              <input
                id="diet-objective"
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ex: Manter produção 30L/dia"
              />
            </div>
          </div>

          {/* Ingredients section */}
          <div className="diet-modal__section">
            <h3>Ingredientes</h3>
            {feedLoading ? (
              <p className="diet-modal__loading-text">Carregando ingredientes...</p>
            ) : (
              <>
                <div className="diet-modal__ingredients">
                  {ingredientRows.map((row) => (
                    <div key={row.key} className="diet-modal__ingredient-row">
                      <div className="diet-modal__field diet-modal__field--ingredient">
                        <label htmlFor={`feed-${row.key}`}>Ingrediente</label>
                        <select
                          id={`feed-${row.key}`}
                          value={row.feedIngredientId}
                          onChange={(e) => updateRow(row.key, 'feedIngredientId', e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {feedIngredients.map((fi) => (
                            <option key={fi.id} value={fi.id}>
                              {fi.name} ({fi.typeLabel})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="diet-modal__field diet-modal__field--qty">
                        <label htmlFor={`qty-${row.key}`}>kg/animal/dia</label>
                        <input
                          id={`qty-${row.key}`}
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={row.quantityKgDay}
                          onChange={(e) => updateRow(row.key, 'quantityKgDay', e.target.value)}
                          placeholder="0.000"
                        />
                      </div>
                      <button
                        type="button"
                        className="diet-modal__remove-btn"
                        onClick={() => removeRow(row.key)}
                        aria-label="Remover ingrediente"
                        disabled={ingredientRows.length <= 1}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="diet-modal__add-btn" onClick={addRow}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar ingrediente
                </button>
              </>
            )}
          </div>

          {/* Simulate button (CA7) */}
          <div className="diet-modal__simulate-area">
            <button
              type="button"
              className="diet-modal__simulate-btn"
              onClick={handleSimulate}
              disabled={simLoading}
            >
              {simLoading ? (
                <Loader2 size={16} aria-hidden="true" className="diet-modal__spinner" />
              ) : (
                <FlaskConical size={16} aria-hidden="true" />
              )}
              Simular dieta
            </button>

            {simulation && (
              <div className="diet-modal__simulation">
                <h4>Resultado da simulação</h4>
                <NutrientsSummary nutrients={simulation.nutrients} />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="diet-modal__field diet-modal__field--full">
            <label htmlFor="diet-notes">Observações</label>
            <textarea
              id="diet-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observações adicionais..."
            />
          </div>

          {/* Footer */}
          <div className="diet-modal__footer">
            <button
              type="button"
              className="diet-modal__btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="diet-modal__btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar dieta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shared nutrients summary (reused in page too) ──────────────────

export function NutrientsSummary({ nutrients }: { nutrients: NutrientCalculation }) {
  const items: Array<{ label: string; value: string | null; unit: string }> = [
    { label: 'MS Total', value: nutrients.totalDmKgDay?.toFixed(3) ?? null, unit: 'kg/dia' },
    { label: 'PB', value: nutrients.cpPercentDm?.toFixed(1) ?? null, unit: '% MS' },
    { label: 'PB Total', value: nutrients.totalCpGDay?.toFixed(0) ?? null, unit: 'g/dia' },
    { label: 'FDN', value: nutrients.ndfPercentDm?.toFixed(1) ?? null, unit: '% MS' },
    { label: 'FDA', value: nutrients.adfPercentDm?.toFixed(1) ?? null, unit: '% MS' },
    { label: 'EE', value: nutrients.eePercentDm?.toFixed(1) ?? null, unit: '% MS' },
    { label: 'NDT', value: nutrients.tdnPercentDm?.toFixed(1) ?? null, unit: '% MS' },
    { label: 'ELl', value: nutrients.nelMcalDay?.toFixed(2) ?? null, unit: 'Mcal/dia' },
    { label: 'ELl/kg MS', value: nutrients.nelMcalKgDm?.toFixed(3) ?? null, unit: 'Mcal/kg' },
    { label: 'Ca', value: nutrients.caGDay?.toFixed(1) ?? null, unit: 'g/dia' },
    { label: 'P', value: nutrients.pGDay?.toFixed(1) ?? null, unit: 'g/dia' },
    { label: 'Vol:Conc', value: nutrients.roughageConcentrateRatio?.toFixed(0) ?? null, unit: '%' },
    { label: 'Custo', value: nutrients.costPerAnimalDay?.toFixed(2) ?? null, unit: 'R$/an/dia' },
    { label: 'Custo MS', value: nutrients.costPerKgDm?.toFixed(3) ?? null, unit: 'R$/kg' },
  ];

  return (
    <div className="nutrients-summary">
      {items.map((item) => (
        <div key={item.label} className="nutrients-summary__item">
          <span className="nutrients-summary__label">{item.label}</span>
          <span className="nutrients-summary__value">
            {item.value != null ? (
              <>
                <strong>{item.value}</strong>{' '}
                <span className="nutrients-summary__unit">{item.unit}</span>
              </>
            ) : (
              <span className="nutrients-summary__na">--</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
