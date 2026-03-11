import { useState, useEffect, useCallback } from 'react';
import { Target, Plus, Trash2, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { TEAM_OPERATION_TYPES, PRODUCTIVITY_UNITS } from '@/types/team-operation';
import type { ProductivityTargetItem, CreateProductivityTargetInput } from '@/types/team-operation';
import './ProductivityTargetsModal.css';

interface ProductivityTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ProductivityTargetsModal({ isOpen, onClose }: ProductivityTargetsModalProps) {
  const { selectedFarmId } = useFarmContext();
  const [targets, setTargets] = useState<ProductivityTargetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formOpType, setFormOpType] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formRateUnit, setFormRateUnit] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTargets = useCallback(async () => {
    if (!selectedFarmId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<ProductivityTargetItem[]>(
        `/org/farms/${selectedFarmId}/productivity-targets`,
      );
      setTargets(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar metas');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId]);

  useEffect(() => {
    if (isOpen) void fetchTargets();
  }, [isOpen, fetchTargets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formOpType || !formTarget || !formUnit) {
      setFormError('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSaving(true);
    try {
      const input: CreateProductivityTargetInput = {
        operationType: formOpType,
        targetValue: Number(formTarget),
        targetUnit: formUnit,
        ratePerUnit: formRate ? Number(formRate) : null,
        rateUnit: formRateUnit || null,
      };
      await api.post(`/org/farms/${selectedFarmId}/productivity-targets`, input);
      setShowForm(false);
      setFormOpType('');
      setFormTarget('');
      setFormUnit('');
      setFormRate('');
      setFormRateUnit('');
      void fetchTargets();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar meta');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (targetId: string) => {
    try {
      await api.delete(`/org/farms/${selectedFarmId}/productivity-targets/${targetId}`);
      void fetchTargets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir meta');
    }
  };

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
    <div className="pt-modal__overlay" onClick={onClose}>
      <div
        className="pt-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Metas de produtividade"
      >
        <div className="pt-modal__header">
          <h2 className="pt-modal__title">
            <Target size={20} aria-hidden="true" />
            Metas de produtividade
          </h2>
          <button type="button" className="pt-modal__close" onClick={onClose} aria-label="Fechar">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div className="pt-modal__body">
          {error && (
            <div className="pt-modal__error" role="alert" aria-live="polite">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {isLoading && (
            <div className="pt-modal__skeleton-list">
              {[1, 2].map((i) => (
                <div key={i} className="pt-modal__skeleton" />
              ))}
            </div>
          )}

          {targets.length === 0 && !isLoading && !error && (
            <div className="pt-modal__empty">
              <Target size={48} aria-hidden="true" />
              <p className="pt-modal__empty-text">
                Nenhuma meta configurada. Defina metas para ver indicadores visuais no ranking.
              </p>
            </div>
          )}

          {targets.length > 0 && !isLoading && (
            <ul className="pt-modal__list">
              {targets.map((t) => (
                <li key={t.id} className="pt-modal__item">
                  <div className="pt-modal__item-info">
                    <span className="pt-modal__item-type">{t.operationTypeLabel}</span>
                    <span className="pt-modal__item-target">
                      {t.targetValue.toLocaleString('pt-BR')} {t.targetUnit}/pessoa/
                      {t.period === 'day' ? 'dia' : t.period}
                    </span>
                    {t.ratePerUnit != null && t.rateUnit && (
                      <span className="pt-modal__item-rate">
                        Bonificação: R$ {t.ratePerUnit.toLocaleString('pt-BR')}/{t.rateUnit}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="pt-modal__delete"
                    onClick={() => handleDelete(t.id)}
                    aria-label={`Excluir meta de ${t.operationTypeLabel}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showForm ? (
            <form className="pt-modal__form" onSubmit={handleCreate}>
              {formError && (
                <div className="pt-modal__error" role="alert" aria-live="polite">
                  <AlertCircle size={16} aria-hidden="true" />
                  {formError}
                </div>
              )}

              <div className="pt-modal__form-row">
                <div className="pt-modal__field">
                  <label htmlFor="pt-op-type" className="pt-modal__label">
                    Tipo de operação *
                  </label>
                  <select
                    id="pt-op-type"
                    className="pt-modal__select"
                    value={formOpType}
                    onChange={(e) => setFormOpType(e.target.value)}
                    required
                  >
                    <option value="">Selecione...</option>
                    {TEAM_OPERATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-modal__field">
                  <label htmlFor="pt-unit" className="pt-modal__label">
                    Unidade *
                  </label>
                  <select
                    id="pt-unit"
                    className="pt-modal__select"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    required
                  >
                    <option value="">Selecione...</option>
                    {PRODUCTIVITY_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-modal__form-row">
                <div className="pt-modal__field">
                  <label htmlFor="pt-target" className="pt-modal__label">
                    Meta por pessoa/dia *
                  </label>
                  <input
                    id="pt-target"
                    type="number"
                    className="pt-modal__input"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder="Ex: 200"
                    min="0.01"
                    step="any"
                    required
                  />
                </div>

                <div className="pt-modal__field">
                  <label htmlFor="pt-rate" className="pt-modal__label">
                    Bonificação R$/unidade
                  </label>
                  <input
                    id="pt-rate"
                    type="number"
                    className="pt-modal__input"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    placeholder="Ex: 0.50"
                    min="0"
                    step="any"
                  />
                </div>
              </div>

              <div className="pt-modal__form-actions">
                <button
                  type="button"
                  className="pt-modal__btn pt-modal__btn--ghost"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="pt-modal__btn pt-modal__btn--primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Salvando...' : 'Salvar meta'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="pt-modal__btn pt-modal__btn--add"
              onClick={() => setShowForm(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Nova meta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductivityTargetsModal;
