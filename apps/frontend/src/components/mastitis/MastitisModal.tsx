import { useState, useEffect, useCallback } from 'react';
import { X, Thermometer, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { QuarterInput, CreateMastitisCaseInput } from '@/types/mastitis';
import { QUARTERS, MASTITIS_GRADES, MILK_APPEARANCES, CMT_RESULTS } from '@/types/mastitis';
import './MastitisModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

interface AnimalOption {
  id: string;
  earTag: string;
  name: string | null;
}

const EMPTY_QUARTER: Omit<QuarterInput, 'quarter'> = {
  grade: 'GRADE_1_MILD',
  milkAppearance: 'NORMAL',
  cmtResult: 'NEGATIVE',
};

export default function MastitisModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [animalId, setAnimalId] = useState('');
  const [occurrenceDate, setOccurrenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [occurrenceTime, setOccurrenceTime] = useState('');
  const [identifiedBy, setIdentifiedBy] = useState('');
  const [rectalTemperature, setRectalTemperature] = useState('');
  const [cultureSampleCollected, setCultureSampleCollected] = useState(false);
  const [cultureLab, setCultureLab] = useState('');
  const [cultureSampleNumber, setCultureSampleNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Quarter selection
  const [selectedQuarters, setSelectedQuarters] = useState<Record<string, boolean>>({
    FL: false,
    FR: false,
    RL: false,
    RR: false,
  });
  const [quarterData, setQuarterData] = useState<Record<string, Omit<QuarterInput, 'quarter'>>>({
    FL: { ...EMPTY_QUARTER },
    FR: { ...EMPTY_QUARTER },
    RL: { ...EMPTY_QUARTER },
    RR: { ...EMPTY_QUARTER },
  });

  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load animals
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    void (async () => {
      try {
        const res = await api.get<{ data: AnimalOption[] }>(
          `/org/farms/${farmId}/animals?limit=500`,
        );
        setAnimals(res.data ?? []);
      } catch {
        // Non-critical
      }
    })();
  }, [isOpen, farmId]);

  // Reset form
  useEffect(() => {
    if (!isOpen) return;
    setAnimalId('');
    setOccurrenceDate(new Date().toISOString().slice(0, 10));
    setOccurrenceTime('');
    setIdentifiedBy('');
    setRectalTemperature('');
    setCultureSampleCollected(false);
    setCultureLab('');
    setCultureSampleNumber('');
    setNotes('');
    setSelectedQuarters({ FL: false, FR: false, RL: false, RR: false });
    setQuarterData({
      FL: { ...EMPTY_QUARTER },
      FR: { ...EMPTY_QUARTER },
      RL: { ...EMPTY_QUARTER },
      RR: { ...EMPTY_QUARTER },
    });
    setError(null);
  }, [isOpen]);

  const toggleQuarter = useCallback((q: string) => {
    setSelectedQuarters((prev) => ({ ...prev, [q]: !prev[q] }));
  }, []);

  const updateQuarterField = useCallback(
    (quarter: string, field: keyof Omit<QuarterInput, 'quarter'>, value: string) => {
      setQuarterData((prev) => ({
        ...prev,
        [quarter]: { ...prev[quarter], [field]: value },
      }));
    },
    [],
  );

  const tempValue = rectalTemperature ? parseFloat(rectalTemperature) : null;
  const tempAlert = tempValue != null && tempValue > 39.5;

  const anyQuarterSelected = Object.values(selectedQuarters).some(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anyQuarterSelected) {
      setError('Selecione pelo menos um quarto afetado.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const quarters: QuarterInput[] = QUARTERS.filter((q) => selectedQuarters[q.value]).map(
        (q) => ({
          quarter: q.value,
          grade: quarterData[q.value].grade,
          milkAppearance: quarterData[q.value].milkAppearance,
          cmtResult: quarterData[q.value].cmtResult,
        }),
      );

      const payload: CreateMastitisCaseInput = {
        animalId,
        occurrenceDate,
        occurrenceTime: occurrenceTime || null,
        identifiedBy,
        rectalTemperature: tempValue,
        cultureSampleCollected,
        cultureLab: cultureSampleCollected ? cultureLab || null : null,
        cultureSampleNumber: cultureSampleCollected ? cultureSampleNumber || null : null,
        notes: notes || null,
        quarters,
      };

      await api.post(`/org/farms/${farmId}/mastitis-cases`, payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar caso de mastite');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal__dialog modal__dialog--lg"
        role="dialog"
        aria-modal="true"
        aria-label="Novo caso de mastite"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2>Novo caso de mastite</h2>
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

          {/* Animal + Date */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="mast-animal">Animal *</label>
              <select
                id="mast-animal"
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
            <div className="modal__field">
              <label htmlFor="mast-date">Data da ocorrência *</label>
              <input
                id="mast-date"
                type="date"
                value={occurrenceDate}
                onChange={(e) => setOccurrenceDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>
          </div>

          {/* Time + Identified by */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="mast-time">Hora</label>
              <input
                id="mast-time"
                type="time"
                value={occurrenceTime}
                onChange={(e) => setOccurrenceTime(e.target.value)}
              />
            </div>
            <div className="modal__field">
              <label htmlFor="mast-identified">Identificado por *</label>
              <input
                id="mast-identified"
                type="text"
                value={identifiedBy}
                onChange={(e) => setIdentifiedBy(e.target.value)}
                required
                aria-required="true"
              />
            </div>
          </div>

          {/* Temperature */}
          <div className="modal__field">
            <label htmlFor="mast-temp">
              Temperatura retal (°C)
              {tempAlert && (
                <span className="mast-modal__temp-alert">
                  <Thermometer size={14} aria-hidden="true" />
                  Febre (&gt;39,5°C)
                </span>
              )}
            </label>
            <input
              id="mast-temp"
              type="number"
              step="0.1"
              min="35"
              max="43"
              value={rectalTemperature}
              onChange={(e) => setRectalTemperature(e.target.value)}
              className={tempAlert ? 'mast-modal__input--alert' : ''}
            />
          </div>

          {/* Quarter selection */}
          <fieldset className="modal__fieldset">
            <legend>Quartos afetados *</legend>
            <div className="mast-modal__quarters-grid">
              {QUARTERS.map((q) => (
                <div
                  key={q.value}
                  className={`mast-modal__quarter-check ${selectedQuarters[q.value] ? 'mast-modal__quarter-check--active' : ''}`}
                >
                  <label className="mast-modal__quarter-label">
                    <input
                      type="checkbox"
                      checked={selectedQuarters[q.value]}
                      onChange={() => toggleQuarter(q.value)}
                    />
                    {q.label}
                  </label>
                </div>
              ))}
            </div>

            {/* Per-quarter details */}
            {QUARTERS.filter((q) => selectedQuarters[q.value]).map((q) => (
              <div key={q.value} className="mast-modal__quarter-detail">
                <h4 className="mast-modal__quarter-title">{q.label}</h4>
                <div className="modal__row">
                  <div className="modal__field">
                    <label htmlFor={`q-grade-${q.value}`}>Grau *</label>
                    <select
                      id={`q-grade-${q.value}`}
                      value={quarterData[q.value].grade}
                      onChange={(e) => updateQuarterField(q.value, 'grade', e.target.value)}
                      required
                    >
                      {MASTITIS_GRADES.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal__field">
                    <label htmlFor={`q-milk-${q.value}`}>Aparência do leite</label>
                    <select
                      id={`q-milk-${q.value}`}
                      value={quarterData[q.value].milkAppearance}
                      onChange={(e) =>
                        updateQuarterField(q.value, 'milkAppearance', e.target.value)
                      }
                    >
                      {MILK_APPEARANCES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal__field">
                    <label htmlFor={`q-cmt-${q.value}`}>Resultado CMT</label>
                    <select
                      id={`q-cmt-${q.value}`}
                      value={quarterData[q.value].cmtResult}
                      onChange={(e) => updateQuarterField(q.value, 'cmtResult', e.target.value)}
                    >
                      {CMT_RESULTS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </fieldset>

          {/* Culture */}
          <fieldset className="modal__fieldset">
            <legend>Cultura microbiológica</legend>
            <label className="mast-modal__culture-check">
              <input
                type="checkbox"
                checked={cultureSampleCollected}
                onChange={(e) => setCultureSampleCollected(e.target.checked)}
              />
              Amostra coletada para cultura
            </label>

            {cultureSampleCollected && (
              <div className="modal__row">
                <div className="modal__field">
                  <label htmlFor="mast-lab">Laboratório</label>
                  <input
                    id="mast-lab"
                    type="text"
                    value={cultureLab}
                    onChange={(e) => setCultureLab(e.target.value)}
                  />
                </div>
                <div className="modal__field">
                  <label htmlFor="mast-sample">Número da amostra</label>
                  <input
                    id="mast-sample"
                    type="text"
                    value={cultureSampleNumber}
                    onChange={(e) => setCultureSampleNumber(e.target.value)}
                  />
                </div>
              </div>
            )}
          </fieldset>

          {/* Notes */}
          <div className="modal__field">
            <label htmlFor="mast-notes">Observações</label>
            <textarea
              id="mast-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
            {isLoading ? 'Registrando...' : 'Registrar caso'}
          </button>
        </footer>
      </div>
    </div>
  );
}
