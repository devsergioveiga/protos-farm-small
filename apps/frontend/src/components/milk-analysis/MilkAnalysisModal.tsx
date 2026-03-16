import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type {
  MilkAnalysisItem,
  CreateMilkAnalysisInput,
  AnalysisType,
} from '@/types/milk-analysis';
import { ANALYSIS_TYPES, CMT_RESULTS } from '@/types/milk-analysis';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import './MilkAnalysisModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analysis?: MilkAnalysisItem | null;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateMilkAnalysisInput = {
  analysisType: 'INDIVIDUAL_CMT',
  animalId: null,
  analysisDate: new Date().toISOString().split('T')[0],
  laboratory: null,
  dairyCompany: null,
  cmtFrontLeft: null,
  cmtFrontRight: null,
  cmtRearLeft: null,
  cmtRearRight: null,
  scc: null,
  tbc: null,
  fatPercent: null,
  proteinPercent: null,
  lactosePercent: null,
  totalSolidsPercent: null,
  snfPercent: null,
  munMgDl: null,
  antibioticResidue: null,
  productionAmLiters: null,
  productionPmLiters: null,
  notes: null,
};

function needsAnimal(type: string): boolean {
  return type === 'INDIVIDUAL_CMT' || type === 'INDIVIDUAL_LAB' || type === 'OFFICIAL_RECORDING';
}

export default function MilkAnalysisModal({ isOpen, onClose, analysis, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateMilkAnalysisInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500, sex: 'FEMALE' });

  useEffect(() => {
    if (!isOpen) return;
    if (analysis) {
      setFormData({
        analysisType: analysis.analysisType,
        animalId: analysis.animalId,
        analysisDate: analysis.analysisDate.split('T')[0],
        laboratory: analysis.laboratory,
        dairyCompany: analysis.dairyCompany,
        cmtFrontLeft: analysis.cmtFrontLeft,
        cmtFrontRight: analysis.cmtFrontRight,
        cmtRearLeft: analysis.cmtRearLeft,
        cmtRearRight: analysis.cmtRearRight,
        scc: analysis.scc,
        tbc: analysis.tbc,
        fatPercent: analysis.fatPercent,
        proteinPercent: analysis.proteinPercent,
        lactosePercent: analysis.lactosePercent,
        totalSolidsPercent: analysis.totalSolidsPercent,
        snfPercent: analysis.snfPercent,
        munMgDl: analysis.munMgDl,
        antibioticResidue: analysis.antibioticResidue,
        productionAmLiters: analysis.productionAmLiters,
        productionPmLiters: analysis.productionPmLiters,
        notes: analysis.notes,
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [analysis, isOpen]);

  const set = (field: keyof CreateMilkAnalysisInput, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setNum = (field: keyof CreateMilkAnalysisInput, raw: string) => {
    set(field, raw === '' ? null : Number(raw));
  };

  const handleTypeChange = (type: AnalysisType) => {
    setFormData((prev) => ({
      ...prev,
      analysisType: type,
      animalId: needsAnimal(type) ? prev.animalId : null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.analysisDate) {
      setError('Informe a data da análise.');
      return;
    }
    if (needsAnimal(formData.analysisType) && !formData.animalId) {
      setError('Selecione o animal.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = { ...formData };
      if (analysis) {
        const updatePayload = { ...payload };
        delete (updatePayload as Record<string, unknown>).analysisType;
        delete (updatePayload as Record<string, unknown>).animalId;
        await api.patch(`/org/farms/${farmId}/milk-analysis/${analysis.id}`, updatePayload);
      } else {
        await api.post(`/org/farms/${farmId}/milk-analysis`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar análise.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const type = formData.analysisType;

  return (
    <div className="milk-modal__overlay" onClick={onClose}>
      <div
        className="milk-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="milk-modal-title"
      >
        <header className="milk-modal__header">
          <h2 id="milk-modal-title">{analysis ? 'Editar análise' : 'Nova análise de leite'}</h2>
          <button type="button" className="milk-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Type Tabs */}
        {!analysis && (
          <div className="milk-modal__type-tabs" role="tablist" aria-label="Tipo de análise">
            {ANALYSIS_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={type === t.value}
                className={`milk-modal__type-tab ${type === t.value ? 'milk-modal__type-tab--active' : ''}`}
                onClick={() => handleTypeChange(t.value as AnalysisType)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="milk-modal__form">
          {error && (
            <div className="milk-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Common: Animal + Date */}
          <div className="milk-modal__row">
            {needsAnimal(type) && (
              <div className="milk-modal__field">
                <label htmlFor="milk-animal">Animal *</label>
                <select
                  id="milk-animal"
                  value={formData.animalId ?? ''}
                  onChange={(e) => set('animalId', e.target.value || null)}
                  required
                  aria-required="true"
                  disabled={!!analysis}
                >
                  <option value="">Selecione o animal...</option>
                  {animals.map((a: AnimalListItem) => (
                    <option key={a.id} value={a.id}>
                      {a.earTag} — {a.name || 'Sem nome'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="milk-modal__field">
              <label htmlFor="milk-date">Data da análise *</label>
              <input
                id="milk-date"
                type="date"
                value={formData.analysisDate}
                onChange={(e) => set('analysisDate', e.target.value)}
                required
                aria-required="true"
              />
            </div>
          </div>

          {/* ─── CMT Fields ──────────────────────────────────────────── */}
          {type === 'INDIVIDUAL_CMT' && (
            <>
              <div className="milk-modal__cmt-section">
                <p className="milk-modal__cmt-section-title">Resultado CMT por quarto</p>
                <div className="milk-modal__cmt-grid">
                  <div className="milk-modal__field">
                    <label htmlFor="milk-cmt-fl">Anterior esquerdo (AE)</label>
                    <select
                      id="milk-cmt-fl"
                      value={formData.cmtFrontLeft ?? ''}
                      onChange={(e) => set('cmtFrontLeft', e.target.value || null)}
                    >
                      <option value="">--</option>
                      {CMT_RESULTS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="milk-modal__field">
                    <label htmlFor="milk-cmt-fr">Anterior direito (AD)</label>
                    <select
                      id="milk-cmt-fr"
                      value={formData.cmtFrontRight ?? ''}
                      onChange={(e) => set('cmtFrontRight', e.target.value || null)}
                    >
                      <option value="">--</option>
                      {CMT_RESULTS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="milk-modal__field">
                    <label htmlFor="milk-cmt-rl">Posterior esquerdo (PE)</label>
                    <select
                      id="milk-cmt-rl"
                      value={formData.cmtRearLeft ?? ''}
                      onChange={(e) => set('cmtRearLeft', e.target.value || null)}
                    >
                      <option value="">--</option>
                      {CMT_RESULTS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="milk-modal__field">
                    <label htmlFor="milk-cmt-rr">Posterior direito (PD)</label>
                    <select
                      id="milk-cmt-rr"
                      value={formData.cmtRearRight ?? ''}
                      onChange={(e) => set('cmtRearRight', e.target.value || null)}
                    >
                      <option value="">--</option>
                      {CMT_RESULTS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── Lab Individual Fields ───────────────────────────────── */}
          {type === 'INDIVIDUAL_LAB' && (
            <>
              <div className="milk-modal__field">
                <label htmlFor="milk-lab">Laboratório</label>
                <input
                  id="milk-lab"
                  type="text"
                  value={formData.laboratory ?? ''}
                  onChange={(e) => set('laboratory', e.target.value || null)}
                  placeholder="Nome do laboratório"
                />
              </div>

              <p className="milk-modal__section-title">Composição</p>
              <div className="milk-modal__row--3 milk-modal__row">
                <div className="milk-modal__field">
                  <label htmlFor="milk-scc">CCS (x1000/mL)</label>
                  <input
                    id="milk-scc"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.scc ?? ''}
                    onChange={(e) => setNum('scc', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-fat">Gordura (%)</label>
                  <input
                    id="milk-fat"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.fatPercent ?? ''}
                    onChange={(e) => setNum('fatPercent', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-protein">Proteína (%)</label>
                  <input
                    id="milk-protein"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.proteinPercent ?? ''}
                    onChange={(e) => setNum('proteinPercent', e.target.value)}
                  />
                </div>
              </div>
              <div className="milk-modal__row--3 milk-modal__row">
                <div className="milk-modal__field">
                  <label htmlFor="milk-lactose">Lactose (%)</label>
                  <input
                    id="milk-lactose"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.lactosePercent ?? ''}
                    onChange={(e) => setNum('lactosePercent', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-ts">ST (%)</label>
                  <input
                    id="milk-ts"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.totalSolidsPercent ?? ''}
                    onChange={(e) => setNum('totalSolidsPercent', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-snf">ESD (%)</label>
                  <input
                    id="milk-snf"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.snfPercent ?? ''}
                    onChange={(e) => setNum('snfPercent', e.target.value)}
                  />
                </div>
              </div>
              <div className="milk-modal__field">
                <label htmlFor="milk-mun">NUL (mg/dL)</label>
                <input
                  id="milk-mun"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.munMgDl ?? ''}
                  onChange={(e) => setNum('munMgDl', e.target.value)}
                />
              </div>
            </>
          )}

          {/* ─── Tank Fields ─────────────────────────────────────────── */}
          {type === 'TANK' && (
            <>
              <div className="milk-modal__field">
                <label htmlFor="milk-dairy">Laticínio / Empresa</label>
                <input
                  id="milk-dairy"
                  type="text"
                  value={formData.dairyCompany ?? ''}
                  onChange={(e) => set('dairyCompany', e.target.value || null)}
                  placeholder="Nome do laticínio"
                />
              </div>

              <p className="milk-modal__section-title">Análise do tanque</p>
              <div className="milk-modal__row">
                <div className="milk-modal__field">
                  <label htmlFor="milk-tank-scc">CCS (x1000/mL)</label>
                  <input
                    id="milk-tank-scc"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.scc ?? ''}
                    onChange={(e) => setNum('scc', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-tank-tbc">CBT (x1000 UFC/mL)</label>
                  <input
                    id="milk-tank-tbc"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.tbc ?? ''}
                    onChange={(e) => setNum('tbc', e.target.value)}
                  />
                </div>
              </div>
              <div className="milk-modal__row--3 milk-modal__row">
                <div className="milk-modal__field">
                  <label htmlFor="milk-tank-fat">Gordura (%)</label>
                  <input
                    id="milk-tank-fat"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.fatPercent ?? ''}
                    onChange={(e) => setNum('fatPercent', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-tank-protein">Proteína (%)</label>
                  <input
                    id="milk-tank-protein"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.proteinPercent ?? ''}
                    onChange={(e) => setNum('proteinPercent', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-tank-lactose">Lactose (%)</label>
                  <input
                    id="milk-tank-lactose"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.lactosePercent ?? ''}
                    onChange={(e) => setNum('lactosePercent', e.target.value)}
                  />
                </div>
              </div>
              <div className="milk-modal__row">
                <div className="milk-modal__field">
                  <label htmlFor="milk-tank-ts">ST (%)</label>
                  <input
                    id="milk-tank-ts"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.totalSolidsPercent ?? ''}
                    onChange={(e) => setNum('totalSolidsPercent', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-tank-snf">ESD (%)</label>
                  <input
                    id="milk-tank-snf"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.snfPercent ?? ''}
                    onChange={(e) => setNum('snfPercent', e.target.value)}
                  />
                </div>
              </div>
              <div className="milk-modal__checkbox">
                <input
                  id="milk-antibiotic"
                  type="checkbox"
                  checked={formData.antibioticResidue === true}
                  onChange={(e) => set('antibioticResidue', e.target.checked)}
                />
                <label htmlFor="milk-antibiotic">Resíduo de antibiótico detectado</label>
              </div>
            </>
          )}

          {/* ─── Official Recording Fields ───────────────────────────── */}
          {type === 'OFFICIAL_RECORDING' && (
            <>
              <p className="milk-modal__section-title">Produção</p>
              <div className="milk-modal__row">
                <div className="milk-modal__field">
                  <label htmlFor="milk-am">Produção manhã (L)</label>
                  <input
                    id="milk-am"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.productionAmLiters ?? ''}
                    onChange={(e) => setNum('productionAmLiters', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-pm">Produção tarde (L)</label>
                  <input
                    id="milk-pm"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.productionPmLiters ?? ''}
                    onChange={(e) => setNum('productionPmLiters', e.target.value)}
                  />
                </div>
              </div>

              <p className="milk-modal__section-title">Composição</p>
              <div className="milk-modal__row--3 milk-modal__row">
                <div className="milk-modal__field">
                  <label htmlFor="milk-off-fat">Gordura (%)</label>
                  <input
                    id="milk-off-fat"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.fatPercent ?? ''}
                    onChange={(e) => setNum('fatPercent', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-off-protein">Proteína (%)</label>
                  <input
                    id="milk-off-protein"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.proteinPercent ?? ''}
                    onChange={(e) => setNum('proteinPercent', e.target.value)}
                  />
                </div>
                <div className="milk-modal__field">
                  <label htmlFor="milk-off-lactose">Lactose (%)</label>
                  <input
                    id="milk-off-lactose"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.lactosePercent ?? ''}
                    onChange={(e) => setNum('lactosePercent', e.target.value)}
                  />
                </div>
              </div>
              <div className="milk-modal__field">
                <label htmlFor="milk-off-scc">CCS (x1000/mL)</label>
                <input
                  id="milk-off-scc"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.scc ?? ''}
                  onChange={(e) => setNum('scc', e.target.value)}
                />
              </div>
            </>
          )}

          {/* ─── Notes (all types) ───────────────────────────────────── */}
          <div className="milk-modal__field">
            <label htmlFor="milk-notes">Observações</label>
            <textarea
              id="milk-notes"
              value={formData.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              rows={2}
            />
          </div>

          <footer className="milk-modal__footer">
            <button
              type="button"
              className="milk-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="milk-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : analysis ? 'Salvar alterações' : 'Registrar análise'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
