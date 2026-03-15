import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateAnalysisInput } from '@/types/feed-ingredient';
import './AnalysisModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  feedId: string;
  feedName: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateAnalysisInput = {
  batchNumber: '',
  collectionDate: '',
  resultDate: '',
  laboratory: '',
  responsibleName: '',
  dmPercent: null,
  cpPercent: null,
  ndfPercent: null,
  adfPercent: null,
  eePercent: null,
  tdnPercent: null,
  nelMcalKg: null,
  caPercent: null,
  pPercent: null,
  notes: '',
};

export default function AnalysisModal({ isOpen, onClose, feedId, feedName, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateAnalysisInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormData({ ...EMPTY_FORM });
    setError(null);
  }, [isOpen]);

  const setNum = (field: keyof CreateAnalysisInput, value: string) => {
    setFormData({ ...formData, [field]: value === '' ? null : Number(value) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const payload: CreateAnalysisInput = {
      ...formData,
      batchNumber: formData.batchNumber || null,
      resultDate: formData.resultDate || null,
      laboratory: formData.laboratory || null,
      notes: formData.notes || null,
    };

    try {
      await api.post(`/org/feed-ingredients/${feedId}/analyses`, payload);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar análise.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="analysis-modal__overlay" onClick={onClose}>
      <div
        className="analysis-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-modal-title"
      >
        <header className="analysis-modal__header">
          <div>
            <h2 id="analysis-modal-title">Nova análise bromatológica</h2>
            <p className="analysis-modal__subtitle">{feedName}</p>
          </div>
          <button
            type="button"
            className="analysis-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="analysis-modal__form">
          {error && (
            <div className="analysis-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* ─── Identificação ──────────────────────────────────── */}
          <fieldset className="analysis-modal__section">
            <legend className="analysis-modal__section-title">Identificação</legend>

            <div className="analysis-modal__row">
              <div className="analysis-modal__field">
                <label htmlFor="an-responsible">Responsável *</label>
                <input
                  id="an-responsible"
                  type="text"
                  value={formData.responsibleName}
                  onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                  required
                  aria-required="true"
                />
              </div>
              <div className="analysis-modal__field">
                <label htmlFor="an-batch">Número do lote</label>
                <input
                  id="an-batch"
                  type="text"
                  value={formData.batchNumber ?? ''}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="analysis-modal__row">
              <div className="analysis-modal__field">
                <label htmlFor="an-collection-date">Data da coleta *</label>
                <input
                  id="an-collection-date"
                  type="date"
                  value={formData.collectionDate}
                  onChange={(e) => setFormData({ ...formData, collectionDate: e.target.value })}
                  required
                  aria-required="true"
                />
              </div>
              <div className="analysis-modal__field">
                <label htmlFor="an-result-date">Data do resultado</label>
                <input
                  id="an-result-date"
                  type="date"
                  value={formData.resultDate ?? ''}
                  onChange={(e) => setFormData({ ...formData, resultDate: e.target.value })}
                />
              </div>
            </div>

            <div className="analysis-modal__field">
              <label htmlFor="an-lab">Laboratório</label>
              <input
                id="an-lab"
                type="text"
                value={formData.laboratory ?? ''}
                onChange={(e) => setFormData({ ...formData, laboratory: e.target.value })}
                placeholder="Ex: ESALQ, Neogen, Agri-lab..."
              />
            </div>
          </fieldset>

          {/* ─── Energia ────────────────────────────────────────── */}
          <fieldset className="analysis-modal__section">
            <legend className="analysis-modal__section-title">Energia</legend>
            <div className="analysis-modal__row">
              <div className="analysis-modal__field">
                <label htmlFor="an-tdn">TDN (%)</label>
                <input
                  id="an-tdn"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tdnPercent ?? ''}
                  onChange={(e) => setNum('tdnPercent', e.target.value)}
                />
              </div>
              <div className="analysis-modal__field">
                <label htmlFor="an-nel">NEL (Mcal/kg)</label>
                <input
                  id="an-nel"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.nelMcalKg ?? ''}
                  onChange={(e) => setNum('nelMcalKg', e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          {/* ─── Proteína ───────────────────────────────────────── */}
          <fieldset className="analysis-modal__section">
            <legend className="analysis-modal__section-title">Proteína</legend>
            <div className="analysis-modal__row">
              <div className="analysis-modal__field">
                <label htmlFor="an-cp">PB — Proteína bruta (%)</label>
                <input
                  id="an-cp"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.cpPercent ?? ''}
                  onChange={(e) => setNum('cpPercent', e.target.value)}
                />
              </div>
              <div className="analysis-modal__field">
                <label htmlFor="an-ee">EE — Extrato etéreo (%)</label>
                <input
                  id="an-ee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.eePercent ?? ''}
                  onChange={(e) => setNum('eePercent', e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          {/* ─── Fibra ──────────────────────────────────────────── */}
          <fieldset className="analysis-modal__section">
            <legend className="analysis-modal__section-title">Fibra</legend>
            <div className="analysis-modal__row">
              <div className="analysis-modal__field">
                <label htmlFor="an-dm">MS — Matéria seca (%)</label>
                <input
                  id="an-dm"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.dmPercent ?? ''}
                  onChange={(e) => setNum('dmPercent', e.target.value)}
                />
              </div>
              <div className="analysis-modal__field">
                <label htmlFor="an-ndf">FDN (%)</label>
                <input
                  id="an-ndf"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.ndfPercent ?? ''}
                  onChange={(e) => setNum('ndfPercent', e.target.value)}
                />
              </div>
            </div>
            <div className="analysis-modal__row">
              <div className="analysis-modal__field">
                <label htmlFor="an-adf">FDA (%)</label>
                <input
                  id="an-adf"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.adfPercent ?? ''}
                  onChange={(e) => setNum('adfPercent', e.target.value)}
                />
              </div>
              <div className="analysis-modal__field" />
            </div>
          </fieldset>

          {/* ─── Minerais ───────────────────────────────────────── */}
          <fieldset className="analysis-modal__section">
            <legend className="analysis-modal__section-title">Minerais</legend>
            <div className="analysis-modal__row">
              <div className="analysis-modal__field">
                <label htmlFor="an-ca">Cálcio — Ca (%)</label>
                <input
                  id="an-ca"
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={formData.caPercent ?? ''}
                  onChange={(e) => setNum('caPercent', e.target.value)}
                />
              </div>
              <div className="analysis-modal__field">
                <label htmlFor="an-p">Fósforo — P (%)</label>
                <input
                  id="an-p"
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={formData.pPercent ?? ''}
                  onChange={(e) => setNum('pPercent', e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          {/* ─── Observações ─────────────────────────────────────── */}
          <div className="analysis-modal__field">
            <label htmlFor="an-notes">Observações</label>
            <textarea
              id="an-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="analysis-modal__footer">
            <button
              type="button"
              className="analysis-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="analysis-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Registrar análise'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
