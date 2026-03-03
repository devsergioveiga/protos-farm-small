import { useEffect, useCallback } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { useFarmLinkForm } from '@/hooks/useFarmLinkForm';
import { useFarms } from '@/hooks/useFarms';
import type { ProducerFarmLink } from '@/types/producer';
import './FarmLinkFormModal.css';

const BOND_TYPE_OPTIONS = [
  { value: 'PROPRIETARIO', label: 'Proprietário' },
  { value: 'ARRENDATARIO', label: 'Arrendatário' },
  { value: 'COMODATARIO', label: 'Comodatário' },
  { value: 'PARCEIRO', label: 'Parceiro' },
  { value: 'MEEIRO', label: 'Meeiro' },
  { value: 'USUFRUTUARIO', label: 'Usufrutuário' },
  { value: 'CONDOMINO', label: 'Condômino' },
];

interface FarmLinkFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  producerId: string;
  existingLink?: ProducerFarmLink;
}

function FarmLinkFormModal({
  isOpen,
  onClose,
  onSuccess,
  producerId,
  existingLink,
}: FarmLinkFormModalProps) {
  const {
    formData,
    errors,
    touched,
    isSubmitting,
    submitError,
    isEditMode,
    setField,
    touchField,
    submit,
    reset,
  } = useFarmLinkForm({ onSuccess, producerId, existingLink });

  const { farms, isLoading: isLoadingFarms } = useFarms();

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const farmIdError = touched.farmId && errors.farmId;
  const bondTypeError = touched.bondType && errors.bondType;
  const pctError = touched.participationPct && errors.participationPct;
  const endDateError = touched.endDate && errors.endDate;

  return (
    <div
      className="farm-link-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="farm-link-form-title"
    >
      <div className="farm-link-modal">
        <header className="farm-link-modal__header">
          <h2 id="farm-link-form-title" className="farm-link-modal__title">
            {isEditMode ? 'Editar vínculo' : 'Vincular fazenda'}
          </h2>
          <button
            type="button"
            className="farm-link-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="farm-link-modal__body">
          <div className="farm-link-modal__fields">
            {/* Fazenda */}
            <div className="farm-link-modal__field farm-link-modal__field--full">
              <label htmlFor="fl-farm" className="farm-link-modal__label">
                Fazenda
                <span className="farm-link-modal__required"> *</span>
              </label>
              <select
                id="fl-farm"
                className={`farm-link-modal__select${farmIdError ? ' farm-link-modal__select--error' : ''}`}
                value={formData.farmId}
                aria-required="true"
                aria-invalid={!!farmIdError}
                aria-describedby={farmIdError ? 'fl-farm-error' : undefined}
                disabled={isEditMode}
                onChange={(e) => setField('farmId', e.target.value)}
                onBlur={() => touchField('farmId')}
              >
                <option value="">
                  {isLoadingFarms ? 'Carregando fazendas...' : 'Selecione a fazenda'}
                </option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                    {farm.state ? ` — ${farm.state}` : ''}
                  </option>
                ))}
              </select>
              {farmIdError && (
                <span id="fl-farm-error" className="farm-link-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.farmId}
                </span>
              )}
            </div>

            {/* Tipo de vínculo */}
            <div className="farm-link-modal__field">
              <label htmlFor="fl-bond-type" className="farm-link-modal__label">
                Tipo de vínculo
                <span className="farm-link-modal__required"> *</span>
              </label>
              <select
                id="fl-bond-type"
                className={`farm-link-modal__select${bondTypeError ? ' farm-link-modal__select--error' : ''}`}
                value={formData.bondType}
                aria-required="true"
                aria-invalid={!!bondTypeError}
                aria-describedby={bondTypeError ? 'fl-bond-type-error' : undefined}
                onChange={(e) => setField('bondType', e.target.value)}
                onBlur={() => touchField('bondType')}
              >
                <option value="">Selecione...</option>
                {BOND_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {bondTypeError && (
                <span id="fl-bond-type-error" className="farm-link-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.bondType}
                </span>
              )}
            </div>

            {/* Participação */}
            <div className="farm-link-modal__field">
              <label htmlFor="fl-participation" className="farm-link-modal__label">
                Participação (%)
              </label>
              <input
                id="fl-participation"
                type="number"
                min="0"
                max="100"
                step="0.01"
                className={`farm-link-modal__input${pctError ? ' farm-link-modal__input--error' : ''}`}
                value={formData.participationPct}
                placeholder="Ex: 50"
                aria-invalid={!!pctError}
                aria-describedby={pctError ? 'fl-participation-error' : undefined}
                onChange={(e) => setField('participationPct', e.target.value)}
                onBlur={() => touchField('participationPct')}
              />
              {pctError && (
                <span id="fl-participation-error" className="farm-link-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.participationPct}
                </span>
              )}
            </div>

            {/* Data início */}
            <div className="farm-link-modal__field">
              <label htmlFor="fl-start-date" className="farm-link-modal__label">
                Data início
              </label>
              <input
                id="fl-start-date"
                type="date"
                className="farm-link-modal__input"
                value={formData.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
                onBlur={() => touchField('startDate')}
              />
            </div>

            {/* Data fim */}
            <div className="farm-link-modal__field">
              <label htmlFor="fl-end-date" className="farm-link-modal__label">
                Data fim
              </label>
              <input
                id="fl-end-date"
                type="date"
                className={`farm-link-modal__input${endDateError ? ' farm-link-modal__input--error' : ''}`}
                value={formData.endDate}
                aria-invalid={!!endDateError}
                aria-describedby={endDateError ? 'fl-end-date-error' : undefined}
                onChange={(e) => setField('endDate', e.target.value)}
                onBlur={() => touchField('endDate')}
              />
              {endDateError && (
                <span id="fl-end-date-error" className="farm-link-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.endDate}
                </span>
              )}
            </div>

            {/* Declarante ITR */}
            <div className="farm-link-modal__checkbox-row">
              <input
                id="fl-itr"
                type="checkbox"
                className="farm-link-modal__checkbox"
                checked={formData.isItrDeclarant}
                onChange={(e) => setField('isItrDeclarant', e.target.checked)}
              />
              <label htmlFor="fl-itr" className="farm-link-modal__checkbox-label">
                Declarante de ITR
              </label>
            </div>
          </div>

          {submitError && (
            <div className="farm-link-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}
        </div>

        <footer className="farm-link-modal__footer">
          <button
            type="button"
            className="farm-link-modal__btn farm-link-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="farm-link-modal__btn farm-link-modal__btn--primary"
            onClick={() => void submit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="farm-link-modal__spinner" />
                Salvando...
              </>
            ) : isEditMode ? (
              'Salvar alterações'
            ) : (
              'Vincular'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default FarmLinkFormModal;
