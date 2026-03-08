import { useState } from 'react';
import { X, Syringe, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import { HEALTH_EVENT_TYPE_LABELS, APPLICATION_METHOD_LABELS } from '@/types/animal';
import type { HealthEventType, ApplicationMethod } from '@/types/animal';
import './BulkHealthEventModal.css';

interface BulkHealthEventModalProps {
  isOpen: boolean;
  farmId: string;
  selectedAnimalIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

interface BulkHealthResult {
  created: number;
  failed: number;
  errors: Array<{ animalId: string; error: string }>;
}

function BulkHealthEventModal({
  isOpen,
  farmId,
  selectedAnimalIds,
  onClose,
  onSuccess,
}: BulkHealthEventModalProps) {
  const [eventType, setEventType] = useState<HealthEventType | ''>('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [productName, setProductName] = useState('');
  const [dosage, setDosage] = useState('');
  const [applicationMethod, setApplicationMethod] = useState<ApplicationMethod | ''>('');
  const [batchNumber, setBatchNumber] = useState('');
  const [veterinaryName, setVeterinaryName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkHealthResult | null>(null);

  const handleSubmit = async () => {
    if (!eventType || !eventDate) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.post<BulkHealthResult>(`/org/farms/${farmId}/animals/bulk-health`, {
        animalIds: selectedAnimalIds,
        type: eventType,
        eventDate,
        productName: productName || undefined,
        dosage: dosage || undefined,
        applicationMethod: applicationMethod || undefined,
        batchNumber: batchNumber || undefined,
        veterinaryName: veterinaryName || undefined,
        notes: notes || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar eventos');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (result) {
      onSuccess();
    }
    setEventType('');
    setEventDate(new Date().toISOString().slice(0, 10));
    setProductName('');
    setDosage('');
    setApplicationMethod('');
    setBatchNumber('');
    setVeterinaryName('');
    setNotes('');
    setError(null);
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  const showProductFields =
    eventType === 'VACCINATION' || eventType === 'DEWORMING' || eventType === 'TREATMENT';

  return (
    <div
      className="bulk-health-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-health-title"
    >
      <div className="bulk-health">
        <header className="bulk-health__header">
          <h2 id="bulk-health-title" className="bulk-health__title">
            <Syringe aria-hidden="true" size={20} />
            Registrar evento sanitário em lote
          </h2>
          <button
            type="button"
            className="bulk-health__close"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="bulk-health__body">
          {result ? (
            <div className="bulk-health__result">
              <CheckCircle size={48} color="var(--color-primary-600)" aria-hidden="true" />
              <h3 className="bulk-health__result-title">Registros criados</h3>
              <p className="bulk-health__result-desc">
                <strong>{result.created}</strong> registro(s) sanitário(s) criado(s) com sucesso.
              </p>
              {result.failed > 0 && (
                <p className="bulk-health__result-warning">
                  <AlertCircle size={16} aria-hidden="true" />
                  {result.failed} animal(is) não encontrado(s).
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="bulk-health__info">
                O mesmo evento sanitário será registrado para{' '}
                <strong>{selectedAnimalIds.length}</strong> animal(is) selecionado(s).
              </p>

              {error && (
                <div className="bulk-health__error" role="alert" aria-live="polite">
                  <AlertCircle size={16} aria-hidden="true" />
                  {error}
                </div>
              )}

              <div className="bulk-health__row">
                <div className="bulk-health__field">
                  <label htmlFor="bulk-health-type" className="bulk-health__label">
                    Tipo de evento *
                  </label>
                  <select
                    id="bulk-health-type"
                    className="bulk-health__select"
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as HealthEventType | '')}
                    aria-required="true"
                  >
                    <option value="">Selecione o tipo</option>
                    {(
                      Object.entries(HEALTH_EVENT_TYPE_LABELS) as Array<[HealthEventType, string]>
                    ).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bulk-health__field">
                  <label htmlFor="bulk-health-date" className="bulk-health__label">
                    Data *
                  </label>
                  <input
                    id="bulk-health-date"
                    type="date"
                    className="bulk-health__input"
                    value={eventDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setEventDate(e.target.value)}
                    aria-required="true"
                  />
                </div>
              </div>

              {showProductFields && (
                <>
                  <div className="bulk-health__row">
                    <div className="bulk-health__field">
                      <label htmlFor="bulk-health-product" className="bulk-health__label">
                        Produto/Medicamento
                      </label>
                      <input
                        id="bulk-health-product"
                        type="text"
                        className="bulk-health__input"
                        placeholder="Ex: Ivomec, Vacina Aftosa..."
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                      />
                    </div>
                    <div className="bulk-health__field">
                      <label htmlFor="bulk-health-dosage" className="bulk-health__label">
                        Dosagem
                      </label>
                      <input
                        id="bulk-health-dosage"
                        type="text"
                        className="bulk-health__input"
                        placeholder="Ex: 1ml/50kg"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="bulk-health__row">
                    <div className="bulk-health__field">
                      <label htmlFor="bulk-health-method" className="bulk-health__label">
                        Método de aplicação
                      </label>
                      <select
                        id="bulk-health-method"
                        className="bulk-health__select"
                        value={applicationMethod}
                        onChange={(e) =>
                          setApplicationMethod(e.target.value as ApplicationMethod | '')
                        }
                      >
                        <option value="">Selecione</option>
                        {(
                          Object.entries(APPLICATION_METHOD_LABELS) as Array<
                            [ApplicationMethod, string]
                          >
                        ).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bulk-health__field">
                      <label htmlFor="bulk-health-batch" className="bulk-health__label">
                        Lote do produto
                      </label>
                      <input
                        id="bulk-health-batch"
                        type="text"
                        className="bulk-health__input"
                        placeholder="Número do lote"
                        value={batchNumber}
                        onChange={(e) => setBatchNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="bulk-health__field">
                <label htmlFor="bulk-health-vet" className="bulk-health__label">
                  Veterinário responsável
                </label>
                <input
                  id="bulk-health-vet"
                  type="text"
                  className="bulk-health__input"
                  placeholder="Nome do veterinário"
                  value={veterinaryName}
                  onChange={(e) => setVeterinaryName(e.target.value)}
                />
              </div>

              <div className="bulk-health__field">
                <label htmlFor="bulk-health-notes" className="bulk-health__label">
                  Observações
                </label>
                <input
                  id="bulk-health-notes"
                  type="text"
                  className="bulk-health__input"
                  placeholder="Notas adicionais..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <footer className="bulk-health__footer">
          {result ? (
            <button
              type="button"
              className="bulk-health__btn bulk-health__btn--primary"
              onClick={handleClose}
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                className="bulk-health__btn bulk-health__btn--secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="bulk-health__btn bulk-health__btn--primary"
                onClick={() => void handleSubmit()}
                disabled={!eventType || !eventDate || isSubmitting}
              >
                {isSubmitting
                  ? 'Registrando...'
                  : `Registrar em ${selectedAnimalIds.length} animal(is)`}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export default BulkHealthEventModal;
