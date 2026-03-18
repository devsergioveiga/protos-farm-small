import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import type {
  DiagnosisItem,
  CreateDiagnosisInput,
  UpdateDiagnosisInput,
} from '@/types/pregnancy-diagnosis';
import {
  DG_RESULTS,
  DG_METHODS,
  UTERINE_CONDITIONS,
  CYCLICITY_STATUSES,
  FETAL_SEX_OPTIONS,
} from '@/types/pregnancy-diagnosis';
import './DiagnosisModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
  diagnosis?: DiagnosisItem | null;
}

interface AnimalOption {
  id: string;
  earTag: string;
  name: string | null;
}

interface BullOption {
  id: string;
  name: string;
  breedName: string | null;
}

export default function DiagnosisModal({ isOpen, onClose, farmId, onSuccess, diagnosis }: Props) {
  const isEdit = !!diagnosis;

  // ─── Form state ──────────────────────────────────────────
  const [animalId, setAnimalId] = useState('');
  const [diagnosisDate, setDiagnosisDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState('PREGNANT');
  const [method, setMethod] = useState('ULTRASOUND');
  const [gestationDays, setGestationDays] = useState<number | ''>('');
  const [fetalSex, setFetalSex] = useState('');
  const [expectedCalvingDate, setExpectedCalvingDate] = useState('');
  const [cyclicityStatus, setCyclicityStatus] = useState('');
  const [uterineCondition, setUterineCondition] = useState('NONE');
  const [placentaRetentionHours, setPlacentaRetentionHours] = useState<number | ''>('');
  const [reproductiveRestriction, setReproductiveRestriction] = useState(false);
  const [restrictionEndDate, setRestrictionEndDate] = useState('');
  const [bullId, setBullId] = useState('');
  const [bullBreedName, setBullBreedName] = useState('');
  const [veterinaryName, setVeterinaryName] = useState('');
  const [notes, setNotes] = useState('');

  // ─── Reference data ──────────────────────────────────────
  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [bulls, setBulls] = useState<BullOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Load reference data ─────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    void (async () => {
      try {
        const [animalsRes, bullsRes] = await Promise.all([
          api.get<{ data: AnimalOption[] }>(`/org/farms/${farmId}/animals?limit=500&sex=FEMALE`),
          api.get<{ data: BullOption[] }>(`/org/farms/${farmId}/bulls?limit=200`),
        ]);
        setAnimals(animalsRes.data ?? []);
        setBulls(bullsRes.data ?? []);
      } catch {
        // Non-critical
      }
    })();
  }, [isOpen, farmId]);

  // ─── Reset / populate form ───────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (diagnosis) {
      setAnimalId(diagnosis.animalId);
      setDiagnosisDate(diagnosis.diagnosisDate.slice(0, 10));
      setResult(diagnosis.result);
      setMethod(diagnosis.method);
      setGestationDays(diagnosis.gestationDays ?? '');
      setFetalSex(diagnosis.fetalSex ?? '');
      setExpectedCalvingDate(diagnosis.expectedCalvingDate?.slice(0, 10) ?? '');
      setCyclicityStatus(diagnosis.cyclicityStatus ?? '');
      setUterineCondition(diagnosis.uterineCondition);
      setPlacentaRetentionHours(diagnosis.placentaRetentionHours ?? '');
      setReproductiveRestriction(diagnosis.reproductiveRestriction);
      setRestrictionEndDate(diagnosis.restrictionEndDate?.slice(0, 10) ?? '');
      setBullId(diagnosis.bullId ?? '');
      setBullBreedName(diagnosis.bullBreedName ?? '');
      setVeterinaryName(diagnosis.veterinaryName);
      setNotes(diagnosis.notes ?? '');
    } else {
      setAnimalId('');
      setDiagnosisDate(new Date().toISOString().slice(0, 10));
      setResult('PREGNANT');
      setMethod('ULTRASOUND');
      setGestationDays('');
      setFetalSex('');
      setExpectedCalvingDate('');
      setCyclicityStatus('');
      setUterineCondition('NONE');
      setPlacentaRetentionHours('');
      setReproductiveRestriction(false);
      setRestrictionEndDate('');
      setBullId('');
      setBullBreedName('');
      setVeterinaryName('');
      setNotes('');
    }
    setError(null);
  }, [isOpen, diagnosis]);

  // ─── Auto-calc expected calving date ─────────────────────
  const calcExpectedCalving = useCallback(() => {
    if (result !== 'PREGNANT' || !gestationDays || !diagnosisDate) return;
    const avgGestation = 283; // days for cattle
    const remaining = avgGestation - Number(gestationDays);
    if (remaining <= 0) return;
    const date = new Date(diagnosisDate);
    date.setDate(date.getDate() + remaining);
    setExpectedCalvingDate(date.toISOString().slice(0, 10));
  }, [result, gestationDays, diagnosisDate]);

  useEffect(() => {
    if (result === 'PREGNANT' && gestationDays && !isEdit) {
      calcExpectedCalving();
    }
  }, [gestationDays, result, calcExpectedCalving, isEdit]);

  // ─── Submit ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isEdit && diagnosis) {
        const payload: UpdateDiagnosisInput = {
          diagnosisDate,
          result,
          method,
          gestationDays:
            result === 'PREGNANT' && gestationDays !== '' ? Number(gestationDays) : null,
          fetalSex: result === 'PREGNANT' && fetalSex ? fetalSex : null,
          expectedCalvingDate:
            result === 'PREGNANT' && expectedCalvingDate ? expectedCalvingDate : null,
          cyclicityStatus:
            (result === 'EMPTY' || result === 'CYCLING') && cyclicityStatus
              ? cyclicityStatus
              : null,
          uterineCondition,
          placentaRetentionHours:
            uterineCondition === 'PLACENTA_RETENTION' && placentaRetentionHours !== ''
              ? Number(placentaRetentionHours)
              : null,
          reproductiveRestriction,
          restrictionEndDate:
            reproductiveRestriction && restrictionEndDate ? restrictionEndDate : null,
          bullId: bullId || null,
          bullBreedName: bullBreedName || null,
          veterinaryName,
          notes: notes || null,
        };
        await api.patch(`/org/farms/${farmId}/pregnancy-diagnoses/${diagnosis.id}`, payload);
      } else {
        const payload: CreateDiagnosisInput = {
          animalId,
          diagnosisDate,
          result,
          method,
          gestationDays:
            result === 'PREGNANT' && gestationDays !== '' ? Number(gestationDays) : null,
          fetalSex: result === 'PREGNANT' && fetalSex ? fetalSex : null,
          expectedCalvingDate:
            result === 'PREGNANT' && expectedCalvingDate ? expectedCalvingDate : null,
          cyclicityStatus:
            (result === 'EMPTY' || result === 'CYCLING') && cyclicityStatus
              ? cyclicityStatus
              : null,
          uterineCondition,
          placentaRetentionHours:
            uterineCondition === 'PLACENTA_RETENTION' && placentaRetentionHours !== ''
              ? Number(placentaRetentionHours)
              : null,
          reproductiveRestriction,
          restrictionEndDate:
            reproductiveRestriction && restrictionEndDate ? restrictionEndDate : null,
          bullId: bullId || null,
          bullBreedName: bullBreedName || null,
          veterinaryName,
          notes: notes || null,
        };
        await api.post(`/org/farms/${farmId}/pregnancy-diagnoses`, payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar diagnóstico');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPregnant = result === 'PREGNANT';
  const needsCyclicity = result === 'EMPTY' || result === 'CYCLING';
  const showRetentionHours = uterineCondition === 'PLACENTA_RETENTION';

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal__dialog modal__dialog--lg"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Editar diagnóstico de gestação' : 'Novo diagnóstico de gestação'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2>{isEdit ? 'Editar diagnóstico de gestação' : 'Novo diagnóstico de gestação'}</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="modal__close">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="modal__body" onSubmit={handleSubmit}>
          {error && (
            <div className="modal__error" role="alert">
              {error}
            </div>
          )}

          {/* ─── Dados do DG ───────────────────────────────── */}
          <fieldset className="modal__fieldset">
            <legend>Dados do DG</legend>

            <div className="modal__row">
              <div className="modal__field">
                <label htmlFor="dg-animal">Animal (fêmea) *</label>
                <select
                  id="dg-animal"
                  value={animalId}
                  onChange={(e) => setAnimalId(e.target.value)}
                  required
                  aria-required="true"
                  disabled={isEdit}
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
                <label htmlFor="dg-date">Data do diagnóstico *</label>
                <input
                  id="dg-date"
                  type="date"
                  value={diagnosisDate}
                  onChange={(e) => setDiagnosisDate(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>
            </div>

            <div className="modal__row">
              <div className="modal__field">
                <label htmlFor="dg-result">Resultado *</label>
                <select
                  id="dg-result"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  required
                  aria-required="true"
                >
                  {DG_RESULTS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal__field">
                <label htmlFor="dg-method">Método *</label>
                <select
                  id="dg-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  required
                  aria-required="true"
                >
                  {DG_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* ─── Gestação (PREGNANT only) ──────────────────── */}
          {isPregnant && (
            <fieldset className="modal__fieldset">
              <legend>Gestação</legend>

              <div className="modal__row">
                <div className="modal__field">
                  <label htmlFor="dg-gestation-days">Dias de gestação</label>
                  <input
                    id="dg-gestation-days"
                    type="number"
                    min="1"
                    max="300"
                    value={gestationDays}
                    onChange={(e) =>
                      setGestationDays(e.target.value === '' ? '' : parseInt(e.target.value) || '')
                    }
                    placeholder="Ex: 60"
                  />
                </div>

                <div className="modal__field">
                  <label htmlFor="dg-fetal-sex">Sexo fetal</label>
                  <select
                    id="dg-fetal-sex"
                    value={fetalSex}
                    onChange={(e) => setFetalSex(e.target.value)}
                  >
                    <option value="">Indeterminado</option>
                    {FETAL_SEX_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal__field">
                <label htmlFor="dg-expected-calving">Data prevista do parto</label>
                <input
                  id="dg-expected-calving"
                  type="date"
                  value={expectedCalvingDate}
                  onChange={(e) => setExpectedCalvingDate(e.target.value)}
                />
                {gestationDays !== '' && expectedCalvingDate && (
                  <span className="dg-modal__calving-preview">
                    Calculado: ~{283 - Number(gestationDays)} dias restantes
                  </span>
                )}
              </div>
            </fieldset>
          )}

          {/* ─── Ciclicidade (EMPTY / CYCLING) ─────────────── */}
          {needsCyclicity && (
            <fieldset className="modal__fieldset">
              <legend>Ciclicidade</legend>
              <div className="modal__field">
                <label htmlFor="dg-cyclicity">Status de ciclicidade</label>
                <select
                  id="dg-cyclicity"
                  value={cyclicityStatus}
                  onChange={(e) => setCyclicityStatus(e.target.value)}
                >
                  <option value="">Não avaliado</option>
                  {CYCLICITY_STATUSES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
          )}

          {/* ─── Saúde uterina ─────────────────────────────── */}
          <fieldset className="modal__fieldset">
            <legend>Saúde uterina</legend>

            <div className="modal__row">
              <div className="modal__field">
                <label htmlFor="dg-uterine">Condição uterina</label>
                <select
                  id="dg-uterine"
                  value={uterineCondition}
                  onChange={(e) => setUterineCondition(e.target.value)}
                >
                  {UTERINE_CONDITIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              {showRetentionHours && (
                <div className="modal__field">
                  <label htmlFor="dg-retention-hours">Horas de retenção</label>
                  <input
                    id="dg-retention-hours"
                    type="number"
                    min="0"
                    value={placentaRetentionHours}
                    onChange={(e) =>
                      setPlacentaRetentionHours(
                        e.target.value === '' ? '' : parseInt(e.target.value) || '',
                      )
                    }
                  />
                </div>
              )}
            </div>

            <div className="modal__row">
              <div className="modal__field dg-modal__checkbox-field">
                <label htmlFor="dg-restriction">
                  <input
                    id="dg-restriction"
                    type="checkbox"
                    checked={reproductiveRestriction}
                    onChange={(e) => setReproductiveRestriction(e.target.checked)}
                  />
                  Restrição reprodutiva
                </label>
              </div>

              {reproductiveRestriction && (
                <div className="modal__field">
                  <label htmlFor="dg-restriction-end">Fim da restrição</label>
                  <input
                    id="dg-restriction-end"
                    type="date"
                    value={restrictionEndDate}
                    onChange={(e) => setRestrictionEndDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          </fieldset>

          {/* ─── Touro ─────────────────────────────────────── */}
          {isPregnant && (
            <fieldset className="modal__fieldset">
              <legend>Touro</legend>
              <div className="modal__row">
                <div className="modal__field">
                  <label htmlFor="dg-bull">Touro (se conhecido)</label>
                  <select id="dg-bull" value={bullId} onChange={(e) => setBullId(e.target.value)}>
                    <option value="">Não identificado</option>
                    {bulls.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.breedName ? `(${b.breedName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal__field">
                  <label htmlFor="dg-bull-breed">Raça do touro (se sem cadastro)</label>
                  <input
                    id="dg-bull-breed"
                    type="text"
                    value={bullBreedName}
                    onChange={(e) => setBullBreedName(e.target.value)}
                    placeholder="Ex: Nelore"
                    disabled={!!bullId}
                  />
                </div>
              </div>
            </fieldset>
          )}

          {/* ─── Veterinário ───────────────────────────────── */}
          <div className="modal__row">
            <div className="modal__field">
              <label htmlFor="dg-vet">Veterinário *</label>
              <input
                id="dg-vet"
                type="text"
                value={veterinaryName}
                onChange={(e) => setVeterinaryName(e.target.value)}
                required
                aria-required="true"
              />
            </div>
          </div>

          <div className="modal__field">
            <label htmlFor="dg-notes">Observações</label>
            <textarea
              id="dg-notes"
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
            {isLoading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Registrar diagnóstico'}
          </button>
        </footer>
      </div>
    </div>
  );
}
