import { useState, useEffect } from 'react';
import { X, AlertCircle, Info } from 'lucide-react';
import { api } from '@/services/api';
import type { InduceLactationInput } from '@/types/lactation';
import { useAnimals } from '@/hooks/useAnimals';
import './InductionModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

export default function InductionModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [animalId, setAnimalId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [inductionProtocol, setInductionProtocol] = useState('');
  const [inductionReason, setInductionReason] = useState('');
  const [inductionVet, setInductionVet] = useState('');
  const [firstMilkingDate, setFirstMilkingDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500, sex: 'FEMALE' });

  useEffect(() => {
    if (!isOpen) return;
    setAnimalId('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setInductionProtocol('');
    setInductionReason('');
    setInductionVet('');
    setFirstMilkingDate('');
    setNotes('');
    setError(null);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload: InduceLactationInput = {
        animalId,
        startDate,
        inductionProtocol: inductionProtocol || null,
        inductionReason: inductionReason || null,
        inductionVet: inductionVet || null,
        firstMilkingDate: firstMilkingDate || null,
        notes: notes || null,
      };
      await api.post(`/org/farms/${farmId}/lactations/induce`, payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao induzir lactação');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="induction-modal__overlay" onClick={onClose}>
      <div
        className="induction-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Induzir lactação"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="induction-modal__header">
          <h2>Induzir lactação</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="induction-modal__close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="induction-modal__form" onSubmit={handleSubmit}>
          {error && (
            <div className="induction-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="induction-modal__info">
            <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              A indução de lactação é utilizada em vacas que não pariram recentemente. Informe o
              protocolo utilizado e o motivo da indução.
            </span>
          </div>

          <div className="induction-modal__field">
            <label htmlFor="ind-animal">Animal *</label>
            <select
              id="ind-animal"
              value={animalId}
              onChange={(e) => setAnimalId(e.target.value)}
              required
              aria-required="true"
            >
              <option value="">Selecione o animal</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.earTag} — {a.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>

          <div className="induction-modal__row">
            <div className="induction-modal__field">
              <label htmlFor="ind-start-date">Data de início *</label>
              <input
                id="ind-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="induction-modal__field">
              <label htmlFor="ind-first-milking">Data da primeira ordenha</label>
              <input
                id="ind-first-milking"
                type="date"
                value={firstMilkingDate}
                onChange={(e) => setFirstMilkingDate(e.target.value)}
              />
            </div>
          </div>

          <div className="induction-modal__field">
            <label htmlFor="ind-protocol">Protocolo de indução</label>
            <input
              id="ind-protocol"
              type="text"
              value={inductionProtocol}
              onChange={(e) => setInductionProtocol(e.target.value)}
              placeholder="Ex: Progesterona + Estradiol"
            />
          </div>

          <div className="induction-modal__row">
            <div className="induction-modal__field">
              <label htmlFor="ind-reason">Motivo da indução</label>
              <input
                id="ind-reason"
                type="text"
                value={inductionReason}
                onChange={(e) => setInductionReason(e.target.value)}
                placeholder="Ex: Vaca seca há muito tempo"
              />
            </div>
            <div className="induction-modal__field">
              <label htmlFor="ind-vet">Veterinário responsável</label>
              <input
                id="ind-vet"
                type="text"
                value={inductionVet}
                onChange={(e) => setInductionVet(e.target.value)}
              />
            </div>
          </div>

          <div className="induction-modal__field">
            <label htmlFor="ind-notes">Observações</label>
            <textarea
              id="ind-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </form>

        <footer className="induction-modal__footer">
          <button type="button" className="induction-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="induction-modal__btn-save"
            disabled={isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? 'Registrando...' : 'Registrar indução'}
          </button>
        </footer>
      </div>
    </div>
  );
}
