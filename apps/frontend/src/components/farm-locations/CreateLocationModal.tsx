import { useState, useCallback, useRef, useEffect } from 'react';
import { X, AlertCircle, Loader2, MapPin, Building2 } from 'lucide-react';
import { api } from '@/services/api';
import type {
  FarmLocationType,
  PastureStatus,
  FacilityStatus,
  ForageType,
  FacilityType,
} from '@/types/farm-location';
import {
  PASTURE_STATUS_LABELS,
  FACILITY_STATUS_LABELS,
  FACILITY_TYPE_LABELS,
  FORAGE_TYPE_LABELS,
} from '@/types/farm-location';
import './CreateLocationModal.css';

interface CreateLocationModalProps {
  isOpen: boolean;
  farmId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateLocationModal({ isOpen, farmId, onClose, onSuccess }: CreateLocationModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [locationType, setLocationType] = useState<FarmLocationType | ''>('');
  const [name, setName] = useState('');
  const [capacityUA, setCapacityUA] = useState('');
  const [capacityAnimals, setCapacityAnimals] = useState('');
  const [forageType, setForageType] = useState<ForageType | ''>('');
  const [pastureStatus, setPastureStatus] = useState<PastureStatus>('EM_USO');
  const [facilityType, setFacilityType] = useState<FacilityType | ''>('');
  const [facilityStatus, setFacilityStatus] = useState<FacilityStatus>('ATIVO');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setLocationType('');
      setName('');
      setCapacityUA('');
      setCapacityAnimals('');
      setForageType('');
      setPastureStatus('EM_USO');
      setFacilityType('');
      setFacilityStatus('ATIVO');
      setDescription('');
      setSubmitError(null);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  const handleSubmit = useCallback(async () => {
    if (!locationType || !name.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        type: locationType,
        description: description.trim() || undefined,
      };

      if (locationType === 'PASTURE') {
        if (capacityUA) payload.capacityUA = parseFloat(capacityUA);
        if (forageType) payload.forageType = forageType;
        payload.pastureStatus = pastureStatus;
      }

      if (locationType === 'FACILITY') {
        if (capacityAnimals) payload.capacityAnimals = parseInt(capacityAnimals, 10);
        payload.facilityType = facilityType || undefined;
        payload.facilityStatus = facilityStatus;
      }

      await api.post(`/org/farms/${farmId}/locations`, payload);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível criar o local';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    locationType,
    name,
    capacityUA,
    capacityAnimals,
    forageType,
    pastureStatus,
    facilityType,
    facilityStatus,
    description,
    farmId,
    onSuccess,
  ]);

  if (!isOpen) return null;

  const canProceedStep1 = locationType !== '';
  const canSubmit =
    locationType !== '' &&
    name.trim() !== '' &&
    (locationType === 'PASTURE' || facilityType !== '');

  return (
    <div
      className="create-location-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Novo local"
      onKeyDown={handleKeyDown}
    >
      <div className="create-location-modal" ref={modalRef}>
        {/* Header */}
        <div className="create-location-modal__header">
          <div>
            <h2 className="create-location-modal__title">Novo local</h2>
            <div className="create-location-modal__stepper">
              <span
                className={`create-location-modal__step ${step === 1 ? 'create-location-modal__step--active' : ''}`}
              >
                1. Tipo
              </span>
              <span
                className={`create-location-modal__step ${step === 2 ? 'create-location-modal__step--active' : ''}`}
              >
                2. Dados
              </span>
            </div>
          </div>
          <button
            type="button"
            className="create-location-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="create-location-modal__body">
          {step === 1 && (
            <div className="create-location-modal__type-selection">
              <p className="create-location-modal__label">Selecione o tipo de local:</p>
              <div
                className="create-location-modal__type-options"
                role="radiogroup"
                aria-label="Tipo de local"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={locationType === 'PASTURE'}
                  className={`create-location-modal__type-card ${locationType === 'PASTURE' ? 'create-location-modal__type-card--selected' : ''}`}
                  onClick={() => setLocationType('PASTURE')}
                >
                  <MapPin size={32} aria-hidden="true" />
                  <span className="create-location-modal__type-card-title">Pasto</span>
                  <span className="create-location-modal__type-card-desc">
                    Área de pastagem com forrageira e manejo rotacional
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={locationType === 'FACILITY'}
                  className={`create-location-modal__type-card ${locationType === 'FACILITY' ? 'create-location-modal__type-card--selected' : ''}`}
                  onClick={() => setLocationType('FACILITY')}
                >
                  <Building2 size={32} aria-hidden="true" />
                  <span className="create-location-modal__type-card-title">Instalação</span>
                  <span className="create-location-modal__type-card-desc">
                    Curral, galpão, bezerreiro ou outra estrutura
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form
              className="create-location-modal__form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              <div className="create-location-modal__field">
                <label htmlFor="loc-name" className="create-location-modal__field-label">
                  Nome *
                </label>
                <input
                  id="loc-name"
                  type="text"
                  className="create-location-modal__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    locationType === 'PASTURE' ? 'Ex: Pasto Norte' : 'Ex: Curral Principal'
                  }
                  required
                  aria-required="true"
                  autoFocus
                />
              </div>

              {locationType === 'PASTURE' && (
                <>
                  <div className="create-location-modal__field">
                    <label
                      htmlFor="loc-pasture-status"
                      className="create-location-modal__field-label"
                    >
                      Status
                    </label>
                    <select
                      id="loc-pasture-status"
                      className="create-location-modal__select"
                      value={pastureStatus}
                      onChange={(e) => setPastureStatus(e.target.value as PastureStatus)}
                    >
                      {Object.entries(PASTURE_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="create-location-modal__field">
                    <label htmlFor="loc-forage" className="create-location-modal__field-label">
                      Forrageira
                    </label>
                    <select
                      id="loc-forage"
                      className="create-location-modal__select"
                      value={forageType}
                      onChange={(e) => setForageType(e.target.value as ForageType | '')}
                    >
                      <option value="">Selecione...</option>
                      {Object.entries(FORAGE_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="create-location-modal__field">
                    <label htmlFor="loc-capacity-ua" className="create-location-modal__field-label">
                      Capacidade (UA)
                    </label>
                    <input
                      id="loc-capacity-ua"
                      type="number"
                      className="create-location-modal__input"
                      value={capacityUA}
                      onChange={(e) => setCapacityUA(e.target.value)}
                      placeholder="Ex: 25"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </>
              )}

              {locationType === 'FACILITY' && (
                <>
                  <div className="create-location-modal__field">
                    <label
                      htmlFor="loc-facility-type"
                      className="create-location-modal__field-label"
                    >
                      Tipo de instalação *
                    </label>
                    <select
                      id="loc-facility-type"
                      className="create-location-modal__select"
                      value={facilityType}
                      onChange={(e) => setFacilityType(e.target.value as FacilityType | '')}
                      required
                      aria-required="true"
                    >
                      <option value="">Selecione...</option>
                      {Object.entries(FACILITY_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="create-location-modal__field">
                    <label
                      htmlFor="loc-facility-status"
                      className="create-location-modal__field-label"
                    >
                      Status
                    </label>
                    <select
                      id="loc-facility-status"
                      className="create-location-modal__select"
                      value={facilityStatus}
                      onChange={(e) => setFacilityStatus(e.target.value as FacilityStatus)}
                    >
                      {Object.entries(FACILITY_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="create-location-modal__field">
                    <label
                      htmlFor="loc-capacity-animals"
                      className="create-location-modal__field-label"
                    >
                      Capacidade (animais)
                    </label>
                    <input
                      id="loc-capacity-animals"
                      type="number"
                      className="create-location-modal__input"
                      value={capacityAnimals}
                      onChange={(e) => setCapacityAnimals(e.target.value)}
                      placeholder="Ex: 50"
                      min="0"
                      step="1"
                    />
                  </div>
                </>
              )}

              <div className="create-location-modal__field">
                <label htmlFor="loc-description" className="create-location-modal__field-label">
                  Descrição
                </label>
                <textarea
                  id="loc-description"
                  className="create-location-modal__textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Observações sobre o local..."
                  rows={3}
                />
              </div>

              {submitError && (
                <div className="create-location-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {submitError}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="create-location-modal__footer">
          {step === 1 && (
            <button
              type="button"
              className="create-location-modal__btn create-location-modal__btn--primary"
              disabled={!canProceedStep1}
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                className="create-location-modal__btn create-location-modal__btn--secondary"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
              >
                Voltar
              </button>
              <button
                type="button"
                className="create-location-modal__btn create-location-modal__btn--primary"
                disabled={!canSubmit || isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      size={16}
                      aria-hidden="true"
                      className="create-location-modal__spinner"
                    />
                    Salvando...
                  </>
                ) : (
                  'Cadastrar'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateLocationModal;
