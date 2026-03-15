import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { LactationItem, DryOffInput } from '@/types/lactation';
import { DRYING_REASONS } from '@/types/lactation';
import './DryOffModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lactation: LactationItem | null;
  farmId: string;
  onSuccess: () => void;
}

export default function DryOffModal({ isOpen, onClose, lactation, farmId, onSuccess }: Props) {
  const [dryingDate, setDryingDate] = useState(new Date().toISOString().slice(0, 10));
  const [dryingReason, setDryingReason] = useState('SCHEDULED');
  const [dryingProtocol, setDryingProtocol] = useState('');
  const [dryingVet, setDryingVet] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDryingDate(new Date().toISOString().slice(0, 10));
    setDryingReason('SCHEDULED');
    setDryingProtocol('');
    setDryingVet('');
    setNotes('');
    setError(null);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lactation) return;
    setIsLoading(true);
    setError(null);

    try {
      const payload: DryOffInput = {
        dryingDate,
        dryingReason,
        dryingProtocol: dryingProtocol || null,
        dryingVet: dryingVet || null,
        notes: notes || null,
      };
      await api.post(`/org/farms/${farmId}/lactations/${lactation.id}/dry-off`, payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar secagem');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !lactation) return null;

  return (
    <div className="dryoff-modal__overlay" onClick={onClose}>
      <div
        className="dryoff-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Secar lactação"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dryoff-modal__header">
          <h2>Secar lactação</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="dryoff-modal__close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="dryoff-modal__form" onSubmit={handleSubmit}>
          {error && (
            <div className="dryoff-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="dryoff-modal__animal-info">
            <span className="dryoff-modal__animal-tag">
              {lactation.animalEarTag} — {lactation.animalName || 'Sem nome'}
            </span>
            <span className="dryoff-modal__animal-del">DEL {lactation.del}</span>
          </div>

          <div className="dryoff-modal__row">
            <div className="dryoff-modal__field">
              <label htmlFor="dry-date">Data da secagem *</label>
              <input
                id="dry-date"
                type="date"
                value={dryingDate}
                onChange={(e) => setDryingDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="dryoff-modal__field">
              <label htmlFor="dry-reason">Motivo *</label>
              <select
                id="dry-reason"
                value={dryingReason}
                onChange={(e) => setDryingReason(e.target.value)}
                required
                aria-required="true"
              >
                {DRYING_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="dryoff-modal__row">
            <div className="dryoff-modal__field">
              <label htmlFor="dry-protocol">Protocolo de secagem</label>
              <input
                id="dry-protocol"
                type="text"
                value={dryingProtocol}
                onChange={(e) => setDryingProtocol(e.target.value)}
                placeholder="Ex: Selante intramamário"
              />
            </div>
            <div className="dryoff-modal__field">
              <label htmlFor="dry-vet">Veterinário</label>
              <input
                id="dry-vet"
                type="text"
                value={dryingVet}
                onChange={(e) => setDryingVet(e.target.value)}
              />
            </div>
          </div>

          <div className="dryoff-modal__field">
            <label htmlFor="dry-notes">Observações</label>
            <textarea
              id="dry-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </form>

        <footer className="dryoff-modal__footer">
          <button type="button" className="dryoff-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="dryoff-modal__btn-save"
            disabled={isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? 'Secando...' : 'Confirmar secagem'}
          </button>
        </footer>
      </div>
    </div>
  );
}
