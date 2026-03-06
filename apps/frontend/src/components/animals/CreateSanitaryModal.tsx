import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { HealthRecordItem, HealthEventType, ApplicationMethod } from '@/types/animal';
import { HEALTH_EVENT_TYPE_LABELS, APPLICATION_METHOD_LABELS } from '@/types/animal';
import './CreateSanitaryModal.css';

interface CreateSanitaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: HealthEventType;
    eventDate: string;
    productName?: string | null;
    dosage?: string | null;
    applicationMethod?: ApplicationMethod | null;
    batchNumber?: string | null;
    diagnosis?: string | null;
    durationDays?: number | null;
    examResult?: string | null;
    labName?: string | null;
    isFieldExam?: boolean | null;
    veterinaryName?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  editingRecord?: HealthRecordItem | null;
}

const EVENT_TYPES: HealthEventType[] = ['VACCINATION', 'DEWORMING', 'TREATMENT', 'EXAM'];
const APP_METHODS: ApplicationMethod[] = ['INJECTABLE', 'ORAL', 'POUR_ON', 'OTHER'];

function CreateSanitaryModal({
  isOpen,
  onClose,
  onSubmit,
  editingRecord,
}: CreateSanitaryModalProps) {
  const [type, setType] = useState<HealthEventType>('VACCINATION');
  const [eventDate, setEventDate] = useState('');
  const [productName, setProductName] = useState('');
  const [dosage, setDosage] = useState('');
  const [applicationMethod, setApplicationMethod] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [examResult, setExamResult] = useState('');
  const [labName, setLabName] = useState('');
  const [isFieldExam, setIsFieldExam] = useState(false);
  const [veterinaryName, setVeterinaryName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);

  const isEditing = editingRecord != null;

  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        setType(editingRecord.type);
        setEventDate(editingRecord.eventDate);
        setProductName(editingRecord.productName ?? '');
        setDosage(editingRecord.dosage ?? '');
        setApplicationMethod(editingRecord.applicationMethod ?? '');
        setBatchNumber(editingRecord.batchNumber ?? '');
        setDiagnosis(editingRecord.diagnosis ?? '');
        setDurationDays(
          editingRecord.durationDays != null ? String(editingRecord.durationDays) : '',
        );
        setExamResult(editingRecord.examResult ?? '');
        setLabName(editingRecord.labName ?? '');
        setIsFieldExam(editingRecord.isFieldExam ?? false);
        setVeterinaryName(editingRecord.veterinaryName ?? '');
        setNotes(editingRecord.notes ?? '');
      } else {
        setType('VACCINATION');
        setEventDate(new Date().toISOString().slice(0, 10));
        setProductName('');
        setDosage('');
        setApplicationMethod('');
        setBatchNumber('');
        setDiagnosis('');
        setDurationDays('');
        setExamResult('');
        setLabName('');
        setIsFieldExam(false);
        setVeterinaryName('');
        setNotes('');
      }
      setError(null);
      if (dialogRef.current?.showModal) {
        dialogRef.current.showModal();
      }
      setTimeout(() => firstInputRef.current?.focus(), 100);
    } else {
      if (dialogRef.current?.close) {
        dialogRef.current.close();
      }
    }
  }, [isOpen, editingRecord]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!eventDate) {
      setError('Informe a data do evento');
      return;
    }

    const duration = durationDays ? parseInt(durationDays, 10) : null;
    if (duration != null && (isNaN(duration) || duration < 1)) {
      setError('Duração do tratamento deve ser um número positivo');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        eventDate,
        productName: productName.trim() || null,
        dosage: dosage.trim() || null,
        applicationMethod: (applicationMethod as ApplicationMethod) || null,
        batchNumber: batchNumber.trim() || null,
        diagnosis: diagnosis.trim() || null,
        durationDays: duration,
        examResult: examResult.trim() || null,
        labName: labName.trim() || null,
        isFieldExam: type === 'EXAM' ? isFieldExam : null,
        veterinaryName: veterinaryName.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar registro sanitário');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const showBatchNumber = type === 'VACCINATION';
  const showDiagnosis = type === 'TREATMENT';
  const showExamFields = type === 'EXAM';

  return (
    <dialog
      ref={dialogRef}
      className="sanitary-modal__dialog"
      onKeyDown={handleKeyDown}
      aria-labelledby="sanitary-modal-title"
    >
      <div className="sanitary-modal">
        <header className="sanitary-modal__header">
          <h2 className="sanitary-modal__title" id="sanitary-modal-title">
            {isEditing ? 'Editar registro sanitário' : 'Novo registro sanitário'}
          </h2>
          <button
            type="button"
            className="sanitary-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="sanitary-modal__form">
          {error && (
            <div className="sanitary-modal__error" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div className="sanitary-modal__row">
            <div className="sanitary-modal__field">
              <label htmlFor="sanitary-type" className="sanitary-modal__label">
                Tipo <span aria-hidden="true">*</span>
              </label>
              <select
                ref={firstInputRef}
                id="sanitary-type"
                className="sanitary-modal__input"
                value={type}
                onChange={(e) => setType(e.target.value as HealthEventType)}
                required
                aria-required="true"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {HEALTH_EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="sanitary-modal__field">
              <label htmlFor="sanitary-date" className="sanitary-modal__label">
                Data <span aria-hidden="true">*</span>
              </label>
              <input
                id="sanitary-date"
                type="date"
                className="sanitary-modal__input"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                required
                aria-required="true"
              />
            </div>
          </div>

          <div className="sanitary-modal__row">
            <div className="sanitary-modal__field">
              <label htmlFor="sanitary-product" className="sanitary-modal__label">
                Produto/Medicamento
              </label>
              <input
                id="sanitary-product"
                type="text"
                className="sanitary-modal__input"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ex: Ivomec, Aftosa Bivalente"
              />
            </div>

            <div className="sanitary-modal__field">
              <label htmlFor="sanitary-dosage" className="sanitary-modal__label">
                Dosagem
              </label>
              <input
                id="sanitary-dosage"
                type="text"
                className="sanitary-modal__input"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="Ex: 5ml, 2 comprimidos"
              />
            </div>
          </div>

          <div className="sanitary-modal__row">
            <div className="sanitary-modal__field">
              <label htmlFor="sanitary-method" className="sanitary-modal__label">
                Método de aplicação
              </label>
              <select
                id="sanitary-method"
                className="sanitary-modal__input"
                value={applicationMethod}
                onChange={(e) => setApplicationMethod(e.target.value)}
              >
                <option value="">Selecione...</option>
                {APP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {APPLICATION_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="sanitary-modal__field">
              <label htmlFor="sanitary-vet" className="sanitary-modal__label">
                Veterinário responsável
              </label>
              <input
                id="sanitary-vet"
                type="text"
                className="sanitary-modal__input"
                value={veterinaryName}
                onChange={(e) => setVeterinaryName(e.target.value)}
                placeholder="Nome do veterinário"
              />
            </div>
          </div>

          {showBatchNumber && (
            <div className="sanitary-modal__field">
              <label htmlFor="sanitary-batch" className="sanitary-modal__label">
                Lote/Série da vacina
              </label>
              <input
                id="sanitary-batch"
                type="text"
                className="sanitary-modal__input"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="Número do lote"
              />
            </div>
          )}

          {showDiagnosis && (
            <div className="sanitary-modal__row">
              <div className="sanitary-modal__field">
                <label htmlFor="sanitary-diagnosis" className="sanitary-modal__label">
                  Diagnóstico
                </label>
                <input
                  id="sanitary-diagnosis"
                  type="text"
                  className="sanitary-modal__input"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Descrição do diagnóstico"
                />
              </div>
              <div className="sanitary-modal__field">
                <label htmlFor="sanitary-duration" className="sanitary-modal__label">
                  Duração (dias)
                </label>
                <input
                  id="sanitary-duration"
                  type="number"
                  min="1"
                  className="sanitary-modal__input"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="Ex: 7"
                />
              </div>
            </div>
          )}

          {showExamFields && (
            <>
              <div className="sanitary-modal__row">
                <div className="sanitary-modal__field">
                  <label htmlFor="sanitary-exam-result" className="sanitary-modal__label">
                    Resultado do exame
                  </label>
                  <input
                    id="sanitary-exam-result"
                    type="text"
                    className="sanitary-modal__input"
                    value={examResult}
                    onChange={(e) => setExamResult(e.target.value)}
                    placeholder="Ex: Negativo, Reagente"
                  />
                </div>
                <div className="sanitary-modal__field">
                  <label htmlFor="sanitary-lab" className="sanitary-modal__label">
                    Laboratório
                  </label>
                  <input
                    id="sanitary-lab"
                    type="text"
                    className="sanitary-modal__input"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    placeholder="Nome do laboratório"
                  />
                </div>
              </div>
              <div className="sanitary-modal__field sanitary-modal__field--checkbox">
                <input
                  id="sanitary-field-exam"
                  type="checkbox"
                  checked={isFieldExam}
                  onChange={(e) => setIsFieldExam(e.target.checked)}
                />
                <label htmlFor="sanitary-field-exam" className="sanitary-modal__label">
                  Exame de campo
                </label>
              </div>
            </>
          )}

          <div className="sanitary-modal__field">
            <label htmlFor="sanitary-notes" className="sanitary-modal__label">
              Observações
            </label>
            <textarea
              id="sanitary-notes"
              className="sanitary-modal__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Informações adicionais sobre o evento sanitário"
            />
          </div>

          <footer className="sanitary-modal__footer">
            <button
              type="button"
              className="sanitary-modal__btn sanitary-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="sanitary-modal__btn sanitary-modal__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar evento'}
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

export default CreateSanitaryModal;
