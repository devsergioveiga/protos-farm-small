import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateApplicationInput } from '@/types/mastitis';
import { QUARTERS, ADMINISTRATION_ROUTES } from '@/types/mastitis';
import './ApplicationModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  caseId: string;
  quartersAffected: string[];
  onSuccess: () => void;
}

export default function ApplicationModal({
  isOpen,
  onClose,
  farmId,
  caseId,
  quartersAffected,
  onSuccess,
}: Props) {
  const [applicationDate, setApplicationDate] = useState(new Date().toISOString().slice(0, 10));
  const [applicationTime, setApplicationTime] = useState('');
  const [productName, setProductName] = useState('');
  const [dose, setDose] = useState('');
  const [administrationRoute, setAdministrationRoute] = useState('INTRAMMARY');
  const [quarterTreated, setQuarterTreated] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [costCents, setCostCents] = useState('');
  const [notes, setNotes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form
  useEffect(() => {
    if (!isOpen) return;
    setApplicationDate(new Date().toISOString().slice(0, 10));
    setApplicationTime(new Date().toTimeString().slice(0, 5));
    setProductName('');
    setDose('');
    setAdministrationRoute('INTRAMMARY');
    setQuarterTreated('');
    setResponsibleName('');
    setCostCents('');
    setNotes('');
    setError(null);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const costValue = costCents ? Math.round(parseFloat(costCents) * 100) : 0;

      const payload: CreateApplicationInput = {
        applicationDate,
        applicationTime: applicationTime || null,
        productName,
        dose,
        administrationRoute,
        quarterTreated: quarterTreated || null,
        responsibleName,
        costCents: costValue,
        notes: notes || null,
      };

      await api.post(`/org/farms/${farmId}/mastitis-cases/${caseId}/applications`, payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar aplicação');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const affectedQuarterOptions = QUARTERS.filter((q) => quartersAffected.includes(q.value));

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Registrar aplicação"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2>Registrar aplicação</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="modal__close">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="modal__body" onSubmit={handleSubmit}>
          {error && (
            <div className="modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Date + Time */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="app-date">Data da aplicação *</label>
              <input
                id="app-date"
                type="date"
                value={applicationDate}
                onChange={(e) => setApplicationDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="modal__field">
              <label htmlFor="app-time">Hora</label>
              <input
                id="app-time"
                type="time"
                value={applicationTime}
                onChange={(e) => setApplicationTime(e.target.value)}
              />
            </div>
          </div>

          {/* Product + Dose */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="app-product">Produto/medicamento *</label>
              <input
                id="app-product"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="modal__field modal__field--sm">
              <label htmlFor="app-dose">Dose *</label>
              <input
                id="app-dose"
                type="text"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                required
                aria-required="true"
                placeholder="Ex: 10mL"
              />
            </div>
          </div>

          {/* Route + Quarter */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="app-route">Via de administração *</label>
              <select
                id="app-route"
                value={administrationRoute}
                onChange={(e) => setAdministrationRoute(e.target.value)}
                required
                aria-required="true"
              >
                {ADMINISTRATION_ROUTES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal__field">
              <label htmlFor="app-quarter">Quarto tratado</label>
              <select
                id="app-quarter"
                value={quarterTreated}
                onChange={(e) => setQuarterTreated(e.target.value)}
              >
                <option value="">Todos / Sistêmico</option>
                {affectedQuarterOptions.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Responsible + Cost */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="app-responsible">Responsável *</label>
              <input
                id="app-responsible"
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="modal__field modal__field--sm">
              <label htmlFor="app-cost">Custo (R$)</label>
              <input
                id="app-cost"
                type="number"
                step="0.01"
                min="0"
                value={costCents}
                onChange={(e) => setCostCents(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="modal__field">
            <label htmlFor="app-notes">Observações</label>
            <textarea
              id="app-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </form>

        <footer className="modal__footer">
          <button type="button" className="modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="modal__btn-submit"
            disabled={isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? 'Registrando...' : 'Registrar aplicação'}
          </button>
        </footer>
      </div>
    </div>
  );
}
