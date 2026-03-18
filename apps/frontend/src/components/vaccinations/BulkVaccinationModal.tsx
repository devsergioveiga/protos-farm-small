import { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { BulkVaccinateInput, BulkVaccinateResult } from '@/types/vaccination';
import { ADMINISTRATION_ROUTES } from '@/types/vaccination';
import type { LotListItem } from '@/types/lot';
import { useLots } from '@/hooks/useLots';
import './BulkVaccinationModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: BulkVaccinateInput = {
  animalLotId: '',
  productName: '',
  dosageMl: 0,
  administrationRoute: 'IM',
  productBatchNumber: '',
  productExpiryDate: '',
  vaccinationDate: new Date().toISOString().split('T')[0],
  responsibleName: '',
  veterinaryName: '',
  doseNumber: 1,
  deductStock: true,
  notes: '',
};

export default function BulkVaccinationModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<BulkVaccinateInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkVaccinateResult | null>(null);

  const { lots } = useLots({ farmId, limit: 200 });

  useEffect(() => {
    if (!isOpen) return;
    setFormData({ ...EMPTY_FORM });
    setError(null);
    setResult(null);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.animalLotId) {
      setError('Selecione o lote.');
      return;
    }
    if (!formData.productName.trim()) {
      setError('Informe o nome da vacina.');
      return;
    }
    if (!formData.dosageMl || formData.dosageMl <= 0) {
      setError('Informe a dosagem em mL.');
      return;
    }
    if (!formData.responsibleName.trim()) {
      setError('Informe o responsável pela aplicação.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      productBatchNumber: formData.productBatchNumber || null,
      productExpiryDate: formData.productExpiryDate || null,
      veterinaryName: formData.veterinaryName || null,
      notes: formData.notes || null,
    };

    try {
      const res = await api.post<BulkVaccinateResult>(
        `/org/farms/${farmId}/vaccinations/bulk`,
        payload,
      );
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar vacinação em lote.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (result) {
      onSuccess();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bulk-vacc-modal__overlay" onClick={handleClose}>
      <div
        className="bulk-vacc-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-vacc-modal-title"
      >
        <header className="bulk-vacc-modal__header">
          <h2 id="bulk-vacc-modal-title">Vacinação em lote</h2>
          <button
            type="button"
            className="bulk-vacc-modal__close"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {result ? (
          <div className="bulk-vacc-modal__result">
            <div className="bulk-vacc-modal__result-success">
              <CheckCircle size={24} aria-hidden="true" />
              <div>
                <h3>{result.created} vacinações registradas com sucesso</h3>
                <p>Campanha: {result.campaignId.slice(0, 8)}...</p>
              </div>
            </div>

            {result.insufficientStockAlerts.length > 0 && (
              <div className="bulk-vacc-modal__result-warnings">
                <div className="bulk-vacc-modal__warning-header">
                  <AlertTriangle size={16} aria-hidden="true" />
                  Alertas de estoque insuficiente
                </div>
                <ul>
                  {result.insufficientStockAlerts.map((alert, i) => (
                    <li key={i}>
                      {alert.productName}: solicitado {alert.requested} mL, disponível{' '}
                      {alert.available} mL
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <footer className="bulk-vacc-modal__footer">
              <button type="button" className="bulk-vacc-modal__btn-save" onClick={handleClose}>
                Fechar
              </button>
            </footer>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bulk-vacc-modal__form">
            {error && (
              <div className="bulk-vacc-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            {/* Lote */}
            <div className="bulk-vacc-modal__field">
              <label htmlFor="bulk-vacc-lot">Lote *</label>
              <select
                id="bulk-vacc-lot"
                value={formData.animalLotId}
                onChange={(e) => setFormData({ ...formData, animalLotId: e.target.value })}
                required
                aria-required="true"
              >
                <option value="">Selecione o lote...</option>
                {lots.map((l: LotListItem) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l._count.animals} animais)
                  </option>
                ))}
              </select>
            </div>

            {/* Vacina + Dosagem */}
            <div className="bulk-vacc-modal__row">
              <div className="bulk-vacc-modal__field">
                <label htmlFor="bulk-vacc-product">Vacina *</label>
                <input
                  id="bulk-vacc-product"
                  type="text"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  required
                  aria-required="true"
                  placeholder="Ex: Vacina contra clostridioses"
                />
              </div>
              <div className="bulk-vacc-modal__field">
                <label htmlFor="bulk-vacc-dosage">Dosagem (mL) *</label>
                <input
                  id="bulk-vacc-dosage"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={formData.dosageMl || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dosageMl: e.target.value ? Number(e.target.value) : 0,
                    })
                  }
                  required
                  aria-required="true"
                />
              </div>
            </div>

            {/* Via + Dose */}
            <div className="bulk-vacc-modal__row">
              <div className="bulk-vacc-modal__field">
                <label htmlFor="bulk-vacc-route">Via de aplicação *</label>
                <select
                  id="bulk-vacc-route"
                  value={formData.administrationRoute}
                  onChange={(e) =>
                    setFormData({ ...formData, administrationRoute: e.target.value })
                  }
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
              <div className="bulk-vacc-modal__field">
                <label htmlFor="bulk-vacc-dose-number">Número da dose</label>
                <input
                  id="bulk-vacc-dose-number"
                  type="number"
                  min="1"
                  value={formData.doseNumber ?? 1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      doseNumber: e.target.value ? Number(e.target.value) : 1,
                    })
                  }
                />
              </div>
            </div>

            {/* Lote produto + Validade */}
            <div className="bulk-vacc-modal__row">
              <div className="bulk-vacc-modal__field">
                <label htmlFor="bulk-vacc-batch">Lote do produto</label>
                <input
                  id="bulk-vacc-batch"
                  type="text"
                  value={formData.productBatchNumber ?? ''}
                  onChange={(e) => setFormData({ ...formData, productBatchNumber: e.target.value })}
                  placeholder="Ex: LOT-2026-01"
                />
              </div>
              <div className="bulk-vacc-modal__field">
                <label htmlFor="bulk-vacc-expiry">Validade do produto</label>
                <input
                  id="bulk-vacc-expiry"
                  type="date"
                  value={formData.productExpiryDate ?? ''}
                  onChange={(e) => setFormData({ ...formData, productExpiryDate: e.target.value })}
                />
              </div>
            </div>

            {/* Data + Responsável */}
            <div className="bulk-vacc-modal__row">
              <div className="bulk-vacc-modal__field">
                <label htmlFor="bulk-vacc-date">Data da vacinação *</label>
                <input
                  id="bulk-vacc-date"
                  type="date"
                  value={formData.vaccinationDate}
                  onChange={(e) => setFormData({ ...formData, vaccinationDate: e.target.value })}
                  required
                  aria-required="true"
                />
              </div>
              <div className="bulk-vacc-modal__field">
                <label htmlFor="bulk-vacc-responsible">Responsável *</label>
                <input
                  id="bulk-vacc-responsible"
                  type="text"
                  value={formData.responsibleName}
                  onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                  required
                  aria-required="true"
                  placeholder="Nome do aplicador"
                />
              </div>
            </div>

            {/* Veterinário */}
            <div className="bulk-vacc-modal__field">
              <label htmlFor="bulk-vacc-vet">Veterinário</label>
              <input
                id="bulk-vacc-vet"
                type="text"
                value={formData.veterinaryName ?? ''}
                onChange={(e) => setFormData({ ...formData, veterinaryName: e.target.value })}
                placeholder="Nome do veterinário (opcional)"
              />
            </div>

            {/* Deduzir estoque */}
            <div className="bulk-vacc-modal__field bulk-vacc-modal__checkbox">
              <input
                id="bulk-vacc-deduct"
                type="checkbox"
                checked={formData.deductStock ?? true}
                onChange={(e) => setFormData({ ...formData, deductStock: e.target.checked })}
              />
              <label htmlFor="bulk-vacc-deduct">Deduzir estoque automaticamente</label>
            </div>

            {/* Observações */}
            <div className="bulk-vacc-modal__field">
              <label htmlFor="bulk-vacc-notes">Observações</label>
              <textarea
                id="bulk-vacc-notes"
                value={formData.notes ?? ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <footer className="bulk-vacc-modal__footer">
              <button
                type="button"
                className="bulk-vacc-modal__btn-cancel"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button type="submit" className="bulk-vacc-modal__btn-save" disabled={isLoading}>
                {isLoading ? 'Registrando...' : 'Vacinar lote'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
