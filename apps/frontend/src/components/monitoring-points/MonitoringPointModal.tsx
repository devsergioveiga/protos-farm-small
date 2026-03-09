import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import type { MonitoringPointItem, CreateMonitoringPointInput } from '@/types/monitoring-point';
import './MonitoringPointModal.css';

interface MonitoringPointModalProps {
  isOpen: boolean;
  farmId: string;
  fieldPlotId: string;
  point: MonitoringPointItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function MonitoringPointModal({
  isOpen,
  farmId,
  fieldPlotId,
  point,
  onClose,
  onSuccess,
}: MonitoringPointModalProps) {
  const isEditing = !!point;

  const [code, setCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setLatitude('');
      setLongitude('');
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
    } else if (point) {
      setCode(point.code);
      setLatitude(String(point.latitude));
      setLongitude(String(point.longitude));
      setNotes(point.notes ?? '');
    }
  }, [isOpen, point]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      setIsSubmitting(true);

      try {
        if (isEditing && point) {
          await api.patch(`/org/farms/${farmId}/monitoring-points/${point.id}`, {
            code: code.trim(),
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            notes: notes.trim() || null,
          });
        } else {
          const payload: CreateMonitoringPointInput = {
            fieldPlotId,
            code: code.trim(),
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            notes: notes.trim() || null,
          };
          await api.post(`/org/farms/${farmId}/monitoring-points`, payload);
        }
        onSuccess();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao salvar ponto de monitoramento';
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isEditing, point, farmId, fieldPlotId, code, latitude, longitude, notes, onSuccess],
  );

  if (!isOpen) return null;

  const isValid =
    code.trim() !== '' &&
    latitude !== '' &&
    longitude !== '' &&
    !isNaN(parseFloat(latitude)) &&
    !isNaN(parseFloat(longitude));

  return (
    <div
      className="mp-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Editar ponto de monitoramento' : 'Novo ponto de monitoramento'}
    >
      <div className="mp-modal__container">
        <div className="mp-modal__header">
          <h2 className="mp-modal__title">
            {isEditing ? 'Editar ponto de monitoramento' : 'Novo ponto de monitoramento'}
          </h2>
          <button
            type="button"
            className="mp-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mp-modal__body">
          {submitError && (
            <div className="mp-modal__error" role="alert">
              {submitError}
            </div>
          )}

          <div className="mp-modal__field">
            <label htmlFor="mp-code" className="mp-modal__label">
              Código do ponto <span aria-hidden="true">*</span>
            </label>
            <input
              id="mp-code"
              type="text"
              className="mp-modal__input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: P01"
              aria-required="true"
              autoFocus
            />
          </div>

          <div className="mp-modal__row">
            <div className="mp-modal__field">
              <label htmlFor="mp-latitude" className="mp-modal__label">
                Latitude <span aria-hidden="true">*</span>
              </label>
              <input
                id="mp-latitude"
                type="number"
                step="any"
                className="mp-modal__input"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="-23.5505"
                aria-required="true"
              />
            </div>
            <div className="mp-modal__field">
              <label htmlFor="mp-longitude" className="mp-modal__label">
                Longitude <span aria-hidden="true">*</span>
              </label>
              <input
                id="mp-longitude"
                type="number"
                step="any"
                className="mp-modal__input"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="-46.6333"
                aria-required="true"
              />
            </div>
          </div>

          <div className="mp-modal__field">
            <label htmlFor="mp-notes" className="mp-modal__label">
              Observações
            </label>
            <textarea
              id="mp-notes"
              className="mp-modal__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o ponto (opcional)"
              rows={3}
            />
          </div>

          <div className="mp-modal__footer">
            <button
              type="button"
              className="mp-modal__btn mp-modal__btn--ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="mp-modal__btn mp-modal__btn--primary"
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar ponto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MonitoringPointModal;
