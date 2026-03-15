import { useState, useEffect } from 'react';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import type { CalvingEventItem, CreateCalvingEventInput, CalfInput } from '@/types/calving-event';
import {
  EVENT_TYPES,
  BIRTH_TYPES,
  CALF_CONDITIONS,
  ABORTION_CAUSES,
  CALF_SEX_OPTIONS,
  PRESENTATION_OPTIONS,
  EVENT_PERIOD_OPTIONS,
} from '@/types/calving-event';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import './CalvingModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event?: CalvingEventItem | null;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_CALF: CalfInput = {
  sex: 'MALE',
  birthWeightKg: null,
  condition: 'ALIVE',
  earTag: '',
  stillbornReason: '',
};

const EMPTY_FORM: CreateCalvingEventInput = {
  motherId: '',
  fatherId: '',
  fatherBreedName: '',
  eventType: 'BIRTH',
  eventDate: new Date().toISOString().split('T')[0],
  eventTime: '',
  eventPeriod: '',
  birthType: 'NORMAL',
  presentation: '',
  abortionGestationDays: null,
  abortionCause: '',
  motherWeightKg: null,
  placentaRetention: false,
  retentionHours: null,
  attendantName: '',
  notes: '',
  calves: [{ ...EMPTY_CALF }],
};

export default function CalvingModal({ isOpen, onClose, event, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateCalvingEventInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500 });

  const femaleAnimals = animals.filter((a: AnimalListItem) => a.sex === 'FEMALE');
  const maleAnimals = animals.filter((a: AnimalListItem) => a.sex === 'MALE');

  useEffect(() => {
    if (!isOpen) return;
    if (event) {
      setFormData({
        motherId: event.motherId,
        fatherId: event.fatherId ?? '',
        fatherBreedName: event.fatherBreedName ?? '',
        eventType: event.eventType,
        eventDate: event.eventDate.split('T')[0],
        eventTime: event.eventTime ?? '',
        eventPeriod: event.eventPeriod ?? '',
        birthType: event.birthType ?? 'NORMAL',
        presentation: event.presentation ?? '',
        abortionGestationDays: event.abortionGestationDays,
        abortionCause: event.abortionCause ?? '',
        motherWeightKg: event.motherWeightKg,
        placentaRetention: event.placentaRetention,
        retentionHours: event.retentionHours,
        attendantName: event.attendantName,
        notes: event.notes ?? '',
        calves: event.calves.map((c) => ({
          sex: c.sex,
          birthWeightKg: c.birthWeightKg,
          condition: c.condition,
          earTag: c.earTag ?? '',
          stillbornReason: c.stillbornReason ?? '',
        })),
      });
    } else {
      setFormData({
        ...EMPTY_FORM,
        calves: [{ ...EMPTY_CALF }],
      });
    }
    setError(null);
  }, [event, isOpen]);

  const isBirth = formData.eventType === 'BIRTH';

  const handleAddCalf = () => {
    if (formData.calves.length >= 3) return;
    setFormData({ ...formData, calves: [...formData.calves, { ...EMPTY_CALF }] });
  };

  const handleRemoveCalf = (index: number) => {
    if (formData.calves.length <= 1) return;
    const updated = formData.calves.filter((_, i) => i !== index);
    setFormData({ ...formData, calves: updated });
  };

  const handleCalfChange = (
    index: number,
    field: keyof CalfInput,
    value: string | number | null,
  ) => {
    const updated = [...formData.calves];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, calves: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.motherId) {
      setError('Selecione a mãe.');
      return;
    }
    if (!formData.eventDate) {
      setError('Informe a data do evento.');
      return;
    }
    if (!formData.attendantName.trim()) {
      setError('Informe o responsável pelo atendimento.');
      return;
    }
    if (isBirth && !formData.birthType) {
      setError('Selecione o tipo de parto.');
      return;
    }
    if (isBirth) {
      for (let i = 0; i < formData.calves.length; i++) {
        const c = formData.calves[i];
        if (!c.sex) {
          setError(`Informe o sexo da cria ${i + 1}.`);
          return;
        }
        if (!c.condition) {
          setError(`Informe a condição da cria ${i + 1}.`);
          return;
        }
      }
    }

    setIsLoading(true);

    const payload: Record<string, unknown> = {
      motherId: formData.motherId,
      eventType: formData.eventType,
      eventDate: formData.eventDate,
      eventTime: formData.eventTime || null,
      eventPeriod: formData.eventPeriod || null,
      attendantName: formData.attendantName,
      motherWeightKg: formData.motherWeightKg,
      placentaRetention: formData.placentaRetention,
      retentionHours: formData.placentaRetention ? formData.retentionHours : null,
      fatherId: formData.fatherId || null,
      fatherBreedName: formData.fatherBreedName || null,
      notes: formData.notes || null,
    };

    if (isBirth) {
      payload.birthType = formData.birthType;
      payload.presentation = formData.presentation || null;
      payload.calves = formData.calves.map((c) => ({
        sex: c.sex,
        birthWeightKg: c.birthWeightKg,
        condition: c.condition,
        earTag: c.condition === 'ALIVE' && c.earTag ? c.earTag : null,
        stillbornReason:
          c.condition === 'STILLBORN' && c.stillbornReason ? c.stillbornReason : null,
      }));
    } else {
      payload.abortionGestationDays = formData.abortionGestationDays;
      payload.abortionCause = formData.abortionCause || null;
    }

    try {
      if (event) {
        await api.patch(`/org/farms/${farmId}/calving-events/${event.id}`, payload);
      } else {
        await api.post(`/org/farms/${farmId}/calving-events`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar evento.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="calving-modal__overlay" onClick={onClose}>
      <div
        className="calving-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calving-modal-title"
      >
        <header className="calving-modal__header">
          <h2 id="calving-modal-title">
            {event ? 'Editar evento' : 'Novo evento de parto/aborto'}
          </h2>
          <button
            type="button"
            className="calving-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="calving-modal__form">
          {error && (
            <div className="calving-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* ── Tipo do evento ─────────────────────────────────── */}
          <fieldset className="calving-modal__section">
            <legend className="calving-modal__legend">Tipo de evento</legend>
            <div className="calving-modal__toggle-group">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`calving-modal__toggle ${formData.eventType === t.value ? 'calving-modal__toggle--active' : ''} ${t.value === 'BIRTH' ? 'calving-modal__toggle--birth' : 'calving-modal__toggle--abortion'}`}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      eventType: t.value,
                      calves:
                        t.value === 'BIRTH'
                          ? formData.calves.length
                            ? formData.calves
                            : [{ ...EMPTY_CALF }]
                          : [],
                    })
                  }
                  aria-pressed={formData.eventType === t.value}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* ── Dados gerais ───────────────────────────────────── */}
          <fieldset className="calving-modal__section">
            <legend className="calving-modal__legend">Dados gerais</legend>

            <div className="calving-modal__field">
              <label htmlFor="calving-mother">Mãe *</label>
              <select
                id="calving-mother"
                value={formData.motherId}
                onChange={(e) => setFormData({ ...formData, motherId: e.target.value })}
                required
                aria-required="true"
                disabled={!!event}
              >
                <option value="">Selecione a fêmea...</option>
                {femaleAnimals.map((a: AnimalListItem) => (
                  <option key={a.id} value={a.id}>
                    {a.earTag} — {a.name || 'Sem nome'}
                  </option>
                ))}
              </select>
            </div>

            <div className="calving-modal__row">
              <div className="calving-modal__field">
                <label htmlFor="calving-date">Data *</label>
                <input
                  id="calving-date"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  required
                  aria-required="true"
                />
              </div>
              <div className="calving-modal__field">
                <label htmlFor="calving-time">Hora</label>
                <input
                  id="calving-time"
                  type="time"
                  value={formData.eventTime}
                  onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                />
              </div>
            </div>

            <div className="calving-modal__row">
              <div className="calving-modal__field">
                <label htmlFor="calving-period">Turno</label>
                <select
                  id="calving-period"
                  value={formData.eventPeriod}
                  onChange={(e) => setFormData({ ...formData, eventPeriod: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {EVENT_PERIOD_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="calving-modal__field">
                <label htmlFor="calving-attendant">Responsável *</label>
                <input
                  id="calving-attendant"
                  type="text"
                  value={formData.attendantName}
                  onChange={(e) => setFormData({ ...formData, attendantName: e.target.value })}
                  required
                  aria-required="true"
                  placeholder="Nome do atendente"
                />
              </div>
            </div>
          </fieldset>

          {/* ── Seção Parto (condicional) ──────────────────────── */}
          {isBirth && (
            <fieldset className="calving-modal__section">
              <legend className="calving-modal__legend">Detalhes do parto</legend>
              <div className="calving-modal__row">
                <div className="calving-modal__field">
                  <label htmlFor="calving-birth-type">Tipo de parto *</label>
                  <select
                    id="calving-birth-type"
                    value={formData.birthType}
                    onChange={(e) => setFormData({ ...formData, birthType: e.target.value })}
                    required
                    aria-required="true"
                  >
                    {BIRTH_TYPES.map((bt) => (
                      <option key={bt.value} value={bt.value}>
                        {bt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="calving-modal__field">
                  <label htmlFor="calving-presentation">Apresentação</label>
                  <select
                    id="calving-presentation"
                    value={formData.presentation}
                    onChange={(e) => setFormData({ ...formData, presentation: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {PRESENTATION_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
          )}

          {/* ── Seção Aborto (condicional) ─────────────────────── */}
          {!isBirth && (
            <fieldset className="calving-modal__section">
              <legend className="calving-modal__legend">Detalhes do aborto</legend>
              <div className="calving-modal__row">
                <div className="calving-modal__field">
                  <label htmlFor="calving-abort-days">Dias de gestação</label>
                  <input
                    id="calving-abort-days"
                    type="number"
                    min="0"
                    value={formData.abortionGestationDays ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        abortionGestationDays: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="calving-modal__field">
                  <label htmlFor="calving-abort-cause">Causa</label>
                  <select
                    id="calving-abort-cause"
                    value={formData.abortionCause}
                    onChange={(e) => setFormData({ ...formData, abortionCause: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {ABORTION_CAUSES.map((ac) => (
                      <option key={ac.value} value={ac.value}>
                        {ac.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
          )}

          {/* ── Mãe ───────────────────────────────────────────── */}
          <fieldset className="calving-modal__section">
            <legend className="calving-modal__legend">Dados da mãe</legend>
            <div className="calving-modal__row">
              <div className="calving-modal__field">
                <label htmlFor="calving-mother-weight">Peso da mãe (kg)</label>
                <input
                  id="calving-mother-weight"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.motherWeightKg ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      motherWeightKg: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="calving-modal__field calving-modal__field--checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.placentaRetention}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        placentaRetention: e.target.checked,
                        retentionHours: e.target.checked ? formData.retentionHours : null,
                      })
                    }
                  />
                  Retenção de placenta
                </label>
              </div>
            </div>
            {formData.placentaRetention && (
              <div className="calving-modal__field">
                <label htmlFor="calving-retention-hours">Horas de retenção</label>
                <input
                  id="calving-retention-hours"
                  type="number"
                  min="0"
                  value={formData.retentionHours ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      retentionHours: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            )}
          </fieldset>

          {/* ── Crias (para partos) ────────────────────────────── */}
          {isBirth && (
            <fieldset className="calving-modal__section">
              <legend className="calving-modal__legend">Crias ({formData.calves.length})</legend>

              {formData.calves.map((calf, idx) => (
                <div key={idx} className="calving-modal__calf-card">
                  <div className="calving-modal__calf-header">
                    <span className="calving-modal__calf-number">Cria {idx + 1}</span>
                    {formData.calves.length > 1 && (
                      <button
                        type="button"
                        className="calving-modal__calf-remove"
                        onClick={() => handleRemoveCalf(idx)}
                        aria-label={`Remover cria ${idx + 1}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="calving-modal__row">
                    <div className="calving-modal__field">
                      <label htmlFor={`calf-sex-${idx}`}>Sexo *</label>
                      <select
                        id={`calf-sex-${idx}`}
                        value={calf.sex}
                        onChange={(e) => handleCalfChange(idx, 'sex', e.target.value)}
                        required
                        aria-required="true"
                      >
                        {CALF_SEX_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="calving-modal__field">
                      <label htmlFor={`calf-weight-${idx}`}>Peso ao nascer (kg)</label>
                      <input
                        id={`calf-weight-${idx}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={calf.birthWeightKg ?? ''}
                        onChange={(e) =>
                          handleCalfChange(
                            idx,
                            'birthWeightKg',
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="calving-modal__row">
                    <div className="calving-modal__field">
                      <label htmlFor={`calf-condition-${idx}`}>Condição *</label>
                      <select
                        id={`calf-condition-${idx}`}
                        value={calf.condition}
                        onChange={(e) => handleCalfChange(idx, 'condition', e.target.value)}
                        required
                        aria-required="true"
                      >
                        {CALF_CONDITIONS.map((cc) => (
                          <option key={cc.value} value={cc.value}>
                            {cc.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {calf.condition === 'ALIVE' && (
                      <div className="calving-modal__field">
                        <label htmlFor={`calf-ear-tag-${idx}`}>Brinco</label>
                        <input
                          id={`calf-ear-tag-${idx}`}
                          type="text"
                          value={calf.earTag}
                          onChange={(e) => handleCalfChange(idx, 'earTag', e.target.value)}
                          placeholder="Brinco da cria"
                        />
                      </div>
                    )}

                    {calf.condition === 'STILLBORN' && (
                      <div className="calving-modal__field">
                        <label htmlFor={`calf-stillborn-reason-${idx}`}>Motivo natimorto</label>
                        <input
                          id={`calf-stillborn-reason-${idx}`}
                          type="text"
                          value={calf.stillbornReason}
                          onChange={(e) => handleCalfChange(idx, 'stillbornReason', e.target.value)}
                          placeholder="Descreva o motivo"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {formData.calves.length < 3 && (
                <button type="button" className="calving-modal__add-calf" onClick={handleAddCalf}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar cria
                </button>
              )}
            </fieldset>
          )}

          {/* ── Pai ────────────────────────────────────────────── */}
          <fieldset className="calving-modal__section">
            <legend className="calving-modal__legend">Pai (opcional)</legend>
            <div className="calving-modal__row">
              <div className="calving-modal__field">
                <label htmlFor="calving-father">Touro / Sêmen</label>
                <select
                  id="calving-father"
                  value={formData.fatherId}
                  onChange={(e) => setFormData({ ...formData, fatherId: e.target.value })}
                >
                  <option value="">Não informado</option>
                  {maleAnimals.map((a: AnimalListItem) => (
                    <option key={a.id} value={a.id}>
                      {a.earTag} — {a.name || 'Sem nome'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="calving-modal__field">
                <label htmlFor="calving-father-breed">Raça do pai</label>
                <input
                  id="calving-father-breed"
                  type="text"
                  value={formData.fatherBreedName}
                  onChange={(e) => setFormData({ ...formData, fatherBreedName: e.target.value })}
                  placeholder="Ex: Nelore, Angus..."
                />
              </div>
            </div>
          </fieldset>

          {/* ── Observações ────────────────────────────────────── */}
          <div className="calving-modal__field">
            <label htmlFor="calving-notes">Observações</label>
            <textarea
              id="calving-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <footer className="calving-modal__footer">
            <button
              type="button"
              className="calving-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="calving-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : event ? 'Salvar alterações' : 'Registrar evento'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
