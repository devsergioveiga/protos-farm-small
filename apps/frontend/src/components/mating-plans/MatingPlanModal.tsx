import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import type { MatingPlanItem, CreateMatingPlanInput } from '@/types/mating-plan';
import { MATING_PLAN_STATUSES } from '@/types/mating-plan';
import './MatingPlanModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  plan: MatingPlanItem | null;
  onSuccess: () => void;
}

export default function MatingPlanModal({ isOpen, onClose, farmId, plan, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [objective, setObjective] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!plan;

  // Reset / populate form on open
  useEffect(() => {
    if (!isOpen) return;
    if (plan) {
      setName(plan.name);
      setSeason(plan.season ?? '');
      setObjective(plan.objective ?? '');
      setStatus(plan.status);
      setStartDate(plan.startDate ? plan.startDate.slice(0, 10) : '');
      setEndDate(plan.endDate ? plan.endDate.slice(0, 10) : '');
      setNotes(plan.notes ?? '');
    } else {
      setName('');
      setSeason('');
      setObjective('');
      setStatus('DRAFT');
      setStartDate('');
      setEndDate('');
      setNotes('');
    }
    setError(null);
  }, [isOpen, plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload: CreateMatingPlanInput = {
        name,
        season: season || null,
        objective: objective || null,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
        notes: notes || null,
      };

      if (isEditing) {
        await api.patch(`/org/farms/${farmId}/mating-plans/${plan!.id}`, payload);
      } else {
        await api.post(`/org/farms/${farmId}/mating-plans`, payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar plano de acasalamento');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="mating-plan-modal__overlay" onClick={onClose}>
      <div
        className="mating-plan-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar plano de acasalamento' : 'Novo plano de acasalamento'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mating-plan-modal__header">
          <h2>{isEditing ? 'Editar plano' : 'Novo plano de acasalamento'}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="mating-plan-modal__close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="mating-plan-modal__form" onSubmit={handleSubmit}>
          {error && (
            <div className="mating-plan-modal__error" role="alert">
              {error}
            </div>
          )}

          <div className="mating-plan-modal__field">
            <label htmlFor="mp-name">Nome do plano *</label>
            <input
              id="mp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-required="true"
              placeholder="Ex: Estação monta 2026"
            />
          </div>

          <div className="mating-plan-modal__row">
            <div className="mating-plan-modal__field">
              <label htmlFor="mp-season">Estação</label>
              <input
                id="mp-season"
                type="text"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="Ex: 2026/2027"
              />
            </div>

            <div className="mating-plan-modal__field">
              <label htmlFor="mp-status">Status *</label>
              <select
                id="mp-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                required
                aria-required="true"
              >
                {MATING_PLAN_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mating-plan-modal__field">
            <label htmlFor="mp-objective">Objetivo</label>
            <input
              id="mp-objective"
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ex: Melhorar produção leiteira"
            />
          </div>

          <div className="mating-plan-modal__row">
            <div className="mating-plan-modal__field">
              <label htmlFor="mp-start-date">Data de início</label>
              <input
                id="mp-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="mating-plan-modal__field">
              <label htmlFor="mp-end-date">Data de término</label>
              <input
                id="mp-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="mating-plan-modal__field">
            <label htmlFor="mp-notes">Observações</label>
            <textarea
              id="mp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observações gerais sobre o plano..."
            />
          </div>
        </form>

        <footer className="mating-plan-modal__footer">
          <button type="button" className="mating-plan-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="mating-plan-modal__btn-save"
            disabled={isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar plano'}
          </button>
        </footer>
      </div>
    </div>
  );
}
