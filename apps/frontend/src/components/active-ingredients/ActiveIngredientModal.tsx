import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { ActiveIngredientItem } from '@/hooks/useActiveIngredients';
import './ActiveIngredientModal.css';

const INGREDIENT_TYPES = [
  { value: 'AGROCHEMICAL', label: 'Agroquímico' },
  { value: 'VETERINARY', label: 'Veterinário' },
  { value: 'FERTILIZER', label: 'Fertilizante' },
  { value: 'OTHER', label: 'Outro' },
];

interface ActiveIngredientModalProps {
  isOpen: boolean;
  ingredient?: ActiveIngredientItem | null;
  initialName?: string;
  onClose: () => void;
  onSave: (name: string, type: string) => Promise<void>;
}

export default function ActiveIngredientModal({
  isOpen,
  ingredient,
  initialName,
  onClose,
  onSave,
}: ActiveIngredientModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('AGROCHEMICAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      if (ingredient) {
        setName(ingredient.name);
        setType(ingredient.type);
      } else {
        setName(initialName ?? '');
        setType('AGROCHEMICAL');
      }
      setSubmitError(null);
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, ingredient, initialName, handleKeyDown]);

  if (!isOpen) return null;

  const isEditing = !!ingredient;
  const canSubmit = name.trim() && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSave(name.trim(), type);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao salvar princípio ativo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ai-modal__overlay" onClick={onClose}>
      <div
        className="ai-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ai-modal__header">
          <h2 id="ai-modal-title">
            {isEditing ? 'Editar princípio ativo' : 'Novo princípio ativo'}
          </h2>
          <button onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="ai-modal__body">
            {submitError && (
              <div className="ai-modal__error" role="alert">
                {submitError}
              </div>
            )}

            <div className="ai-modal__field">
              <label htmlFor="ai-name">
                Nome <span>*</span>
              </label>
              <input
                id="ai-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Glifosato"
                required
                autoFocus
              />
            </div>

            <div className="ai-modal__field">
              <label htmlFor="ai-type">Tipo</label>
              <select id="ai-type" value={type} onChange={(e) => setType(e.target.value)}>
                {INGREDIENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <footer className="ai-modal__footer">
            <button type="button" className="ai-modal__btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="ai-modal__btn--primary" disabled={!canSubmit}>
              {isSubmitting && (
                <Loader2 size={16} className="ai-modal__spinner" aria-hidden="true" />
              )}
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
