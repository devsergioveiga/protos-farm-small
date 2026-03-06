import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type {
  ReproductiveRecordItem,
  ReproductiveEventType,
  HeatIntensity,
  BreedingMethod,
  CalvingType,
  PregnancyConfirmation,
} from '@/types/animal';
import {
  REPRODUCTIVE_EVENT_TYPE_LABELS,
  HEAT_INTENSITY_LABELS,
  BREEDING_METHOD_LABELS,
  CALVING_TYPE_LABELS,
  PREGNANCY_CONFIRMATION_LABELS,
} from '@/types/animal';
import './CreateReproductiveModal.css';

interface CreateReproductiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: ReproductiveEventType;
    eventDate: string;
    notes?: string | null;
    approvedBy?: string | null;
    criteriaDetails?: string | null;
    heatIntensity?: HeatIntensity | null;
    plannedSireId?: string | null;
    breedingMethod?: BreedingMethod | null;
    plannedDate?: string | null;
    sireId?: string | null;
    sireName?: string | null;
    semenBatch?: string | null;
    technicianName?: string | null;
    confirmationMethod?: PregnancyConfirmation | null;
    confirmationDate?: string | null;
    expectedDueDate?: string | null;
    calvingType?: CalvingType | null;
    calvingComplications?: string | null;
    calfId?: string | null;
    calfSex?: string | null;
    calfWeightKg?: number | null;
  }) => Promise<void>;
  editingRecord?: ReproductiveRecordItem | null;
  males?: Array<{ id: string; earTag: string; name: string | null }>;
}

const EVENT_TYPES: ReproductiveEventType[] = [
  'CLEARANCE',
  'HEAT',
  'BREEDING_PLAN',
  'AI',
  'PREGNANCY',
  'CALVING',
];
const HEAT_INTENSITIES: HeatIntensity[] = ['WEAK', 'MODERATE', 'STRONG'];
const BREEDING_METHODS: BreedingMethod[] = ['NATURAL', 'AI', 'ET'];
const CALVING_TYPES: CalvingType[] = ['NORMAL', 'ASSISTED', 'CESAREAN', 'DYSTOCIC'];
const PREGNANCY_CONFIRMATIONS: PregnancyConfirmation[] = [
  'PALPATION',
  'ULTRASOUND',
  'BLOOD_TEST',
  'OBSERVATION',
];

function CreateReproductiveModal({
  isOpen,
  onClose,
  onSubmit,
  editingRecord,
  males = [],
}: CreateReproductiveModalProps) {
  const [type, setType] = useState<ReproductiveEventType>('CLEARANCE');
  const [eventDate, setEventDate] = useState('');
  const [notes, setNotes] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [criteriaDetails, setCriteriaDetails] = useState('');
  const [heatIntensity, setHeatIntensity] = useState('');
  const [plannedSireId, setPlannedSireId] = useState('');
  const [breedingMethod, setBreedingMethod] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [sireId, setSireId] = useState('');
  const [sireName, setSireName] = useState('');
  const [semenBatch, setSemenBatch] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [confirmationMethod, setConfirmationMethod] = useState('');
  const [confirmationDate, setConfirmationDate] = useState('');
  const [expectedDueDate, setExpectedDueDate] = useState('');
  const [calvingType, setCalvingType] = useState('');
  const [calvingComplications, setCalvingComplications] = useState('');
  const [calfSex, setCalfSex] = useState('');
  const [calfWeightKg, setCalfWeightKg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);

  const isEditing = editingRecord != null;

  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        setType(editingRecord.type);
        setEventDate(editingRecord.eventDate);
        setNotes(editingRecord.notes ?? '');
        setApprovedBy(editingRecord.approvedBy ?? '');
        setCriteriaDetails(editingRecord.criteriaDetails ?? '');
        setHeatIntensity(editingRecord.heatIntensity ?? '');
        setPlannedSireId(editingRecord.plannedSireId ?? '');
        setBreedingMethod(editingRecord.breedingMethod ?? '');
        setPlannedDate(editingRecord.plannedDate ?? '');
        setSireId(editingRecord.sireId ?? '');
        setSireName(editingRecord.sireName ?? '');
        setSemenBatch(editingRecord.semenBatch ?? '');
        setTechnicianName(editingRecord.technicianName ?? '');
        setConfirmationMethod(editingRecord.confirmationMethod ?? '');
        setConfirmationDate(editingRecord.confirmationDate ?? '');
        setExpectedDueDate(editingRecord.expectedDueDate ?? '');
        setCalvingType(editingRecord.calvingType ?? '');
        setCalvingComplications(editingRecord.calvingComplications ?? '');
        setCalfSex(editingRecord.calfSex ?? '');
        setCalfWeightKg(
          editingRecord.calfWeightKg != null ? String(editingRecord.calfWeightKg) : '',
        );
      } else {
        setType('CLEARANCE');
        setEventDate(new Date().toISOString().slice(0, 10));
        setNotes('');
        setApprovedBy('');
        setCriteriaDetails('');
        setHeatIntensity('');
        setPlannedSireId('');
        setBreedingMethod('');
        setPlannedDate('');
        setSireId('');
        setSireName('');
        setSemenBatch('');
        setTechnicianName('');
        setConfirmationMethod('');
        setConfirmationDate('');
        setExpectedDueDate('');
        setCalvingType('');
        setCalvingComplications('');
        setCalfSex('');
        setCalfWeightKg('');
      }
      setError(null);
      if (dialogRef.current?.showModal) {
        dialogRef.current.showModal();
      }
      setTimeout(() => firstInputRef.current?.focus(), 100);
    } else {
      if (dialogRef.current?.close) {
        dialogRef.current.close();
      }
    }
  }, [isOpen, editingRecord]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!eventDate) {
      setError('Informe a data do evento');
      return;
    }

    const weight = calfWeightKg ? parseFloat(calfWeightKg) : null;
    if (weight != null && (isNaN(weight) || weight <= 0)) {
      setError('Peso do bezerro deve ser um número positivo');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        eventDate,
        notes: notes.trim() || null,
        approvedBy: type === 'CLEARANCE' ? approvedBy.trim() || null : null,
        criteriaDetails: type === 'CLEARANCE' ? criteriaDetails.trim() || null : null,
        heatIntensity: type === 'HEAT' ? (heatIntensity as HeatIntensity) || null : null,
        plannedSireId: type === 'BREEDING_PLAN' ? plannedSireId || null : null,
        breedingMethod:
          type === 'BREEDING_PLAN' || type === 'AI'
            ? (breedingMethod as BreedingMethod) || null
            : null,
        plannedDate: type === 'BREEDING_PLAN' ? plannedDate || null : null,
        sireId: type === 'AI' || type === 'PREGNANCY' ? sireId || null : null,
        sireName: type === 'AI' || type === 'PREGNANCY' ? sireName.trim() || null : null,
        semenBatch: type === 'AI' ? semenBatch.trim() || null : null,
        technicianName: type === 'AI' ? technicianName.trim() || null : null,
        confirmationMethod:
          type === 'PREGNANCY' ? (confirmationMethod as PregnancyConfirmation) || null : null,
        confirmationDate: type === 'PREGNANCY' ? confirmationDate || null : null,
        expectedDueDate: type === 'PREGNANCY' ? expectedDueDate || null : null,
        calvingType: type === 'CALVING' ? (calvingType as CalvingType) || null : null,
        calvingComplications: type === 'CALVING' ? calvingComplications.trim() || null : null,
        calfSex: type === 'CALVING' ? calfSex || null : null,
        calfWeightKg: type === 'CALVING' ? weight : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar registro reprodutivo');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  // Date max: today for eventDate; future allowed for plannedDate/expectedDueDate
  const today = new Date().toISOString().slice(0, 10);

  return (
    <dialog
      ref={dialogRef}
      className="repro-modal__dialog"
      onKeyDown={handleKeyDown}
      aria-labelledby="repro-modal-title"
    >
      <div className="repro-modal">
        <header className="repro-modal__header">
          <h2 className="repro-modal__title" id="repro-modal-title">
            {isEditing ? 'Editar registro reprodutivo' : 'Novo registro reprodutivo'}
          </h2>
          <button
            type="button"
            className="repro-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="repro-modal__form">
          {error && (
            <div className="repro-modal__error" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div className="repro-modal__row">
            <div className="repro-modal__field">
              <label htmlFor="repro-type" className="repro-modal__label">
                Tipo <span aria-hidden="true">*</span>
              </label>
              <select
                ref={firstInputRef}
                id="repro-type"
                className="repro-modal__input"
                value={type}
                onChange={(e) => setType(e.target.value as ReproductiveEventType)}
                required
                aria-required="true"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {REPRODUCTIVE_EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="repro-modal__field">
              <label htmlFor="repro-date" className="repro-modal__label">
                Data <span aria-hidden="true">*</span>
              </label>
              <input
                id="repro-date"
                type="date"
                className="repro-modal__input"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                max={today}
                required
                aria-required="true"
              />
            </div>
          </div>

          {/* CLEARANCE fields */}
          {type === 'CLEARANCE' && (
            <div className="repro-modal__row">
              <div className="repro-modal__field">
                <label htmlFor="repro-approved-by" className="repro-modal__label">
                  Aprovado por
                </label>
                <input
                  id="repro-approved-by"
                  type="text"
                  className="repro-modal__input"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  placeholder="Nome do responsável"
                />
              </div>
              <div className="repro-modal__field">
                <label htmlFor="repro-criteria" className="repro-modal__label">
                  Critérios
                </label>
                <input
                  id="repro-criteria"
                  type="text"
                  className="repro-modal__input"
                  value={criteriaDetails}
                  onChange={(e) => setCriteriaDetails(e.target.value)}
                  placeholder="Critérios de liberação"
                />
              </div>
            </div>
          )}

          {/* HEAT fields */}
          {type === 'HEAT' && (
            <div className="repro-modal__field">
              <label htmlFor="repro-heat-intensity" className="repro-modal__label">
                Intensidade do cio
              </label>
              <select
                id="repro-heat-intensity"
                className="repro-modal__input"
                value={heatIntensity}
                onChange={(e) => setHeatIntensity(e.target.value)}
              >
                <option value="">Selecione...</option>
                {HEAT_INTENSITIES.map((h) => (
                  <option key={h} value={h}>
                    {HEAT_INTENSITY_LABELS[h]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* BREEDING_PLAN fields */}
          {type === 'BREEDING_PLAN' && (
            <>
              <div className="repro-modal__row">
                <div className="repro-modal__field">
                  <label htmlFor="repro-planned-sire" className="repro-modal__label">
                    Touro planejado
                  </label>
                  <select
                    id="repro-planned-sire"
                    className="repro-modal__input"
                    value={plannedSireId}
                    onChange={(e) => setPlannedSireId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {males.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.earTag}
                        {m.name ? ` — ${m.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="repro-modal__field">
                  <label htmlFor="repro-breeding-method" className="repro-modal__label">
                    Método
                  </label>
                  <select
                    id="repro-breeding-method"
                    className="repro-modal__input"
                    value={breedingMethod}
                    onChange={(e) => setBreedingMethod(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {BREEDING_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {BREEDING_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="repro-modal__field">
                <label htmlFor="repro-planned-date" className="repro-modal__label">
                  Data planejada
                </label>
                <input
                  id="repro-planned-date"
                  type="date"
                  className="repro-modal__input"
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                />
              </div>
            </>
          )}

          {/* AI fields */}
          {type === 'AI' && (
            <>
              <div className="repro-modal__row">
                <div className="repro-modal__field">
                  <label htmlFor="repro-sire" className="repro-modal__label">
                    Touro (da fazenda)
                  </label>
                  <select
                    id="repro-sire"
                    className="repro-modal__input"
                    value={sireId}
                    onChange={(e) => setSireId(e.target.value)}
                  >
                    <option value="">Nenhum (externo)</option>
                    {males.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.earTag}
                        {m.name ? ` — ${m.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="repro-modal__field">
                  <label htmlFor="repro-sire-name" className="repro-modal__label">
                    Nome do touro / sêmen
                  </label>
                  <input
                    id="repro-sire-name"
                    type="text"
                    className="repro-modal__input"
                    value={sireName}
                    onChange={(e) => setSireName(e.target.value)}
                    placeholder="Ex: Tornado FIV, Sêmen importado"
                  />
                </div>
              </div>
              <div className="repro-modal__row">
                <div className="repro-modal__field">
                  <label htmlFor="repro-semen-batch" className="repro-modal__label">
                    Lote do sêmen
                  </label>
                  <input
                    id="repro-semen-batch"
                    type="text"
                    className="repro-modal__input"
                    value={semenBatch}
                    onChange={(e) => setSemenBatch(e.target.value)}
                    placeholder="Número do lote"
                  />
                </div>
                <div className="repro-modal__field">
                  <label htmlFor="repro-technician" className="repro-modal__label">
                    Técnico inseminador
                  </label>
                  <input
                    id="repro-technician"
                    type="text"
                    className="repro-modal__input"
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    placeholder="Nome do técnico"
                  />
                </div>
              </div>
              <div className="repro-modal__field">
                <label htmlFor="repro-ai-method" className="repro-modal__label">
                  Método
                </label>
                <select
                  id="repro-ai-method"
                  className="repro-modal__input"
                  value={breedingMethod}
                  onChange={(e) => setBreedingMethod(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {BREEDING_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {BREEDING_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* PREGNANCY fields */}
          {type === 'PREGNANCY' && (
            <>
              <div className="repro-modal__row">
                <div className="repro-modal__field">
                  <label htmlFor="repro-confirmation" className="repro-modal__label">
                    Método de confirmação
                  </label>
                  <select
                    id="repro-confirmation"
                    className="repro-modal__input"
                    value={confirmationMethod}
                    onChange={(e) => setConfirmationMethod(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {PREGNANCY_CONFIRMATIONS.map((c) => (
                      <option key={c} value={c}>
                        {PREGNANCY_CONFIRMATION_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="repro-modal__field">
                  <label htmlFor="repro-confirmation-date" className="repro-modal__label">
                    Data da confirmação
                  </label>
                  <input
                    id="repro-confirmation-date"
                    type="date"
                    className="repro-modal__input"
                    value={confirmationDate}
                    onChange={(e) => setConfirmationDate(e.target.value)}
                    max={today}
                  />
                </div>
              </div>
              <div className="repro-modal__row">
                <div className="repro-modal__field">
                  <label htmlFor="repro-expected-due" className="repro-modal__label">
                    Data prevista do parto
                  </label>
                  <input
                    id="repro-expected-due"
                    type="date"
                    className="repro-modal__input"
                    value={expectedDueDate}
                    onChange={(e) => setExpectedDueDate(e.target.value)}
                  />
                </div>
                <div className="repro-modal__field">
                  <label htmlFor="repro-preg-sire-name" className="repro-modal__label">
                    Touro/sêmen
                  </label>
                  <input
                    id="repro-preg-sire-name"
                    type="text"
                    className="repro-modal__input"
                    value={sireName}
                    onChange={(e) => setSireName(e.target.value)}
                    placeholder="Nome do touro"
                  />
                </div>
              </div>
            </>
          )}

          {/* CALVING fields */}
          {type === 'CALVING' && (
            <>
              <div className="repro-modal__row">
                <div className="repro-modal__field">
                  <label htmlFor="repro-calving-type" className="repro-modal__label">
                    Tipo de parto
                  </label>
                  <select
                    id="repro-calving-type"
                    className="repro-modal__input"
                    value={calvingType}
                    onChange={(e) => setCalvingType(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {CALVING_TYPES.map((c) => (
                      <option key={c} value={c}>
                        {CALVING_TYPE_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="repro-modal__field">
                  <label htmlFor="repro-calf-sex" className="repro-modal__label">
                    Sexo da cria
                  </label>
                  <select
                    id="repro-calf-sex"
                    className="repro-modal__input"
                    value={calfSex}
                    onChange={(e) => setCalfSex(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    <option value="MALE">Macho</option>
                    <option value="FEMALE">Fêmea</option>
                  </select>
                </div>
              </div>
              <div className="repro-modal__row">
                <div className="repro-modal__field">
                  <label htmlFor="repro-calf-weight" className="repro-modal__label">
                    Peso da cria (kg)
                  </label>
                  <input
                    id="repro-calf-weight"
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="repro-modal__input"
                    value={calfWeightKg}
                    onChange={(e) => setCalfWeightKg(e.target.value)}
                    placeholder="Ex: 35"
                  />
                </div>
                <div className="repro-modal__field">
                  <label htmlFor="repro-calving-complications" className="repro-modal__label">
                    Complicações
                  </label>
                  <input
                    id="repro-calving-complications"
                    type="text"
                    className="repro-modal__input"
                    value={calvingComplications}
                    onChange={(e) => setCalvingComplications(e.target.value)}
                    placeholder="Descreva se houver"
                  />
                </div>
              </div>
            </>
          )}

          <div className="repro-modal__field">
            <label htmlFor="repro-notes" className="repro-modal__label">
              Observações
            </label>
            <textarea
              id="repro-notes"
              className="repro-modal__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Informações adicionais sobre o evento reprodutivo"
            />
          </div>

          <footer className="repro-modal__footer">
            <button
              type="button"
              className="repro-modal__btn repro-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="repro-modal__btn repro-modal__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar evento'}
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

export default CreateReproductiveModal;
