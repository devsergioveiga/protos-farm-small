import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { TimeEntry, AddActivityInput } from '@/types/attendance';

interface FieldOperation {
  id: string;
  name: string;
  type: string;
}

interface FieldPlot {
  id: string;
  name: string;
}

interface CostCenter {
  id: string;
  name: string;
}

interface LinkOperationModalProps {
  isOpen: boolean;
  timeEntry: TimeEntry | null;
  fieldOperations?: FieldOperation[];
  fieldPlots?: FieldPlot[];
  costCenters?: CostCenter[];
  onSave: (timeEntryId: string, data: AddActivityInput) => Promise<boolean>;
  onClose: () => void;
}

interface FormErrors {
  operationType?: string;
  minutes?: string;
}

export default function LinkOperationModal({
  isOpen,
  timeEntry,
  fieldOperations = [],
  fieldPlots = [],
  costCenters = [],
  onSave,
  onClose,
}: LinkOperationModalProps) {
  const firstInputRef = useRef<HTMLSelectElement>(null);

  const [operationType, setOperationType] = useState('');
  const [fieldOperationId, setFieldOperationId] = useState('');
  const [fieldPlotId, setFieldPlotId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    } else {
      setOperationType('');
      setFieldOperationId('');
      setFieldPlotId('');
      setCostCenterId('');
      setMinutes('');
      setNotes('');
      setErrors({});
      setTouched({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!operationType) errs.operationType = 'Selecione o tipo de operação';
    if (!minutes) errs.minutes = 'Informe os minutos';
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins <= 0) errs.minutes = 'Informe um valor maior que zero';
    return errs;
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate();
    setErrors(errs);
  }

  const workedMinutes = timeEntry?.workedMinutes ?? 0;
  const minutesNum = parseInt(minutes, 10);
  const estimatedCost =
    !isNaN(minutesNum) && minutesNum > 0
      ? `Estimativa: ${minutesNum} min (~${(minutesNum / 60).toFixed(1)}h)`
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ operationType: true, minutes: true });
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!timeEntry) return;

    setIsSubmitting(true);
    try {
      const data: AddActivityInput = {
        operationType,
        fieldOperationId: fieldOperationId || undefined,
        fieldPlotId: fieldPlotId || undefined,
        costCenterId: costCenterId || undefined,
        minutes: parseInt(minutes, 10),
        notes: notes || undefined,
      };
      const success = await onSave(timeEntry.id, data);
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="link-op-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-op-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="link-op-modal">
        <header className="link-op-modal__header">
          <h2 id="link-op-title" className="link-op-modal__title">
            Vincular a Operação
          </h2>
          {timeEntry && (
            <p className="link-op-modal__subtitle">
              {timeEntry.employeeName} — {new Date(timeEntry.date).toLocaleDateString('pt-BR')}
              {workedMinutes > 0 && ` (${(workedMinutes / 60).toFixed(1)}h trabalhadas)`}
            </p>
          )}
          <button
            type="button"
            className="link-op-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="link-op-modal__form" onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <div className="link-op-modal__body">
            {/* Operação */}
            <div className="link-op-modal__field">
              <label htmlFor="link-op-type" className="link-op-modal__label">
                Tipo de Operação <span aria-hidden="true">*</span>
              </label>
              <select
                id="link-op-type"
                ref={firstInputRef}
                className={`link-op-modal__select ${touched.operationType && errors.operationType ? 'link-op-modal__select--error' : ''}`}
                value={operationType}
                onChange={(e) => setOperationType(e.target.value)}
                onBlur={() => handleBlur('operationType')}
                aria-required="true"
                aria-describedby={touched.operationType && errors.operationType ? 'link-op-type-error' : undefined}
              >
                <option value="">Selecione a operação...</option>
                {fieldOperations.map((op) => (
                  <option key={op.id} value={op.type}>
                    {op.name}
                  </option>
                ))}
                <option value="COLHEITA">Colheita</option>
                <option value="PLANTIO">Plantio</option>
                <option value="PULVERIZACAO">Pulverização</option>
                <option value="ADUBACAO">Adubação</option>
                <option value="MANUTENCAO">Manutenção</option>
                <option value="OUTROS">Outros</option>
              </select>
              {touched.operationType && errors.operationType && (
                <span id="link-op-type-error" className="link-op-modal__error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.operationType}
                </span>
              )}
            </div>

            {/* Talhão / Pasto */}
            <div className="link-op-modal__field">
              <label htmlFor="link-op-plot" className="link-op-modal__label">
                Talhão / Pasto
              </label>
              <select
                id="link-op-plot"
                className="link-op-modal__select"
                value={fieldPlotId}
                onChange={(e) => setFieldPlotId(e.target.value)}
              >
                <option value="">Selecione o talhão ou pasto...</option>
                {fieldPlots.map((plot) => (
                  <option key={plot.id} value={plot.id}>
                    {plot.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Centro de Custo */}
            <div className="link-op-modal__field">
              <label htmlFor="link-op-cc" className="link-op-modal__label">
                Centro de Custo
              </label>
              <select
                id="link-op-cc"
                className="link-op-modal__select"
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
              >
                <option value="">Selecione o centro de custo...</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Minutos */}
            <div className="link-op-modal__field">
              <label htmlFor="link-op-minutes" className="link-op-modal__label">
                Minutos <span aria-hidden="true">*</span>
              </label>
              <input
                id="link-op-minutes"
                type="number"
                min="1"
                className={`link-op-modal__input link-op-modal__input--mono ${touched.minutes && errors.minutes ? 'link-op-modal__input--error' : ''}`}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                onBlur={() => handleBlur('minutes')}
                placeholder="Ex: 120"
                aria-required="true"
                aria-describedby={touched.minutes && errors.minutes ? 'link-op-minutes-error' : undefined}
              />
              {estimatedCost && (
                <span className="link-op-modal__hint">{estimatedCost}</span>
              )}
              {touched.minutes && errors.minutes && (
                <span id="link-op-minutes-error" className="link-op-modal__error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.minutes}
                </span>
              )}
            </div>

            {/* Observações */}
            <div className="link-op-modal__field link-op-modal__field--full">
              <label htmlFor="link-op-notes" className="link-op-modal__label">
                Observações
              </label>
              <textarea
                id="link-op-notes"
                className="link-op-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Informações adicionais sobre esta atividade"
              />
            </div>
          </div>

          <footer className="link-op-modal__footer">
            <button
              type="button"
              className="link-op-modal__btn link-op-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="link-op-modal__btn link-op-modal__btn--primary"
              disabled={isSubmitting}
              aria-label="Vincular horas à operação"
            >
              {isSubmitting ? 'Vinculando...' : 'Vincular'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
