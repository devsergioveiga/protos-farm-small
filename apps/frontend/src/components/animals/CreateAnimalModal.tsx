import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, Loader2, Plus, Trash2, Check, ArrowRight, ArrowLeft, Dna, ScrollText } from 'lucide-react';
import { api } from '@/services/api';
import { useBreeds } from '@/hooks/useBreeds';
import type {
  CreateAnimalPayload,
  UpdateAnimalPayload,
  AnimalSex,
  AnimalCategory,
  AnimalOrigin,
  AnimalDetail,
  BreedCompositionInput,
  GenealogicalRecordInput,
} from '@/types/animal';
import { SEX_LABELS, CATEGORY_LABELS, ORIGIN_LABELS, GENEALOGY_CLASS_LABELS } from '@/types/animal';
import './CreateAnimalModal.css';

const GIROLANDO_GRADES: Record<string, string> = {
  '50.00': 'F1',
  '75.00': '3/4',
  '62.50': '5/8',
  '37.50': '3/8',
  '87.50': '7/8',
};

interface CreateAnimalModalProps {
  isOpen: boolean;
  farmId: string;
  animal?: AnimalDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}

const STEPS = [
  { number: 1, label: 'Dados básicos' },
  { number: 2, label: 'Composição racial' },
  { number: 3, label: 'Genealogia' },
] as const;

function suggestCategory(sex: string, birthDate: string): AnimalCategory | null {
  if (!sex) return null;
  if (!birthDate) return sex === 'MALE' ? 'BEZERRO' : 'BEZERRA';

  const birth = new Date(birthDate);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

  if (sex === 'MALE') {
    if (months < 12) return 'BEZERRO';
    if (months < 24) return 'NOVILHO';
    return 'TOURO_REPRODUTOR';
  } else {
    if (months < 12) return 'BEZERRA';
    if (months < 24) return 'NOVILHA';
    return 'VACA_SECA';
  }
}

function detectGirolandoGrade(
  compositions: BreedCompositionInput[],
  breedNames: Record<string, string>,
): string | null {
  if (compositions.length !== 2) return null;

  const c1Name = breedNames[compositions[0].breedId];
  const c2Name = breedNames[compositions[1].breedId];

  let holPct: number | null = null;
  if (c1Name === 'Holandesa' && c2Name === 'Gir Leiteiro') holPct = compositions[0].percentage;
  else if (c2Name === 'Holandesa' && c1Name === 'Gir Leiteiro') holPct = compositions[1].percentage;
  if (holPct == null) return null;

  return GIROLANDO_GRADES[holPct.toFixed(2)] ?? null;
}

function CreateAnimalModal({ isOpen, farmId, animal, onClose, onSuccess }: CreateAnimalModalProps) {
  const isEditMode = Boolean(animal);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Step 1: Basic data
  const [earTag, setEarTag] = useState('');
  const [rfidTag, setRfidTag] = useState('');
  const [name, setName] = useState('');
  const [registeredName, setRegisteredName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [sex, setSex] = useState<AnimalSex | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [birthDateEstimated, setBirthDateEstimated] = useState(false);
  const [category, setCategory] = useState<AnimalCategory | ''>('');
  const [origin, setOrigin] = useState<AnimalOrigin>('BORN');
  const [entryWeightKg, setEntryWeightKg] = useState('');
  const [bodyConditionScore, setBodyConditionScore] = useState('');
  const [notes, setNotes] = useState('');

  // Step 2: Breed composition
  const [compositions, setCompositions] = useState<BreedCompositionInput[]>([]);
  const [isCompositionEstimated, setIsCompositionEstimated] = useState(false);

  // Step 3: Genealogy
  const [genealogicalRecords, setGenealogicalRecords] = useState<GenealogicalRecordInput[]>([]);

  const { breeds } = useBreeds();

  const breedNames: Record<string, string> = {};
  for (const b of breeds) {
    breedNames[b.id] = b.name;
  }

  // Auto-suggest category
  const suggestedCategory = sex ? suggestCategory(sex, birthDate) : null;

  useEffect(() => {
    if (suggestedCategory && !category) {
      setCategory(suggestedCategory);
    }
  }, [suggestedCategory, category]);

  // Girolando detection
  const girolandoGrade = detectGirolandoGrade(compositions, breedNames);

  // Track previous isOpen to detect open transitions
  const prevIsOpenRef = useRef(false);

  // Reset on close / Populate on open in edit mode
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!isOpen) {
      // Reset all fields when modal closes
      setStep(1);
      setEarTag('');
      setRfidTag('');
      setName('');
      setRegisteredName('');
      setRegistrationNumber('');
      setSex('');
      setBirthDate('');
      setBirthDateEstimated(false);
      setCategory('');
      setOrigin('BORN');
      setEntryWeightKg('');
      setBodyConditionScore('');
      setNotes('');
      setCompositions([]);
      setIsCompositionEstimated(false);
      setGenealogicalRecords([]);
      setSubmitError(null);
      setIsSubmitting(false);
      return;
    }

    // Populate fields when opening in edit mode
    if (isOpen && !wasOpen && animal) {
      setEarTag(animal.earTag);
      setRfidTag(animal.rfidTag ?? '');
      setName(animal.name ?? '');
      setRegisteredName(animal.registeredName ?? '');
      setRegistrationNumber(animal.registrationNumber ?? '');
      setSex(animal.sex);
      setBirthDate(animal.birthDate ? animal.birthDate.slice(0, 10) : '');
      setBirthDateEstimated(animal.birthDateEstimated);
      setCategory(animal.category);
      setOrigin(animal.origin);
      setEntryWeightKg(animal.entryWeightKg != null ? String(animal.entryWeightKg) : '');
      setBodyConditionScore(animal.bodyConditionScore != null ? String(animal.bodyConditionScore) : '');
      setNotes(animal.notes ?? '');
      setIsCompositionEstimated(animal.isCompositionEstimated);
      setCompositions(
        animal.compositions.map((c) => ({
          breedId: c.breedId,
          percentage: c.percentage,
          fraction: c.fraction ?? undefined,
        })),
      );
      setGenealogicalRecords(
        animal.genealogicalRecords.map((r) => ({
          genealogyClass: r.genealogyClass,
          registrationNumber: r.registrationNumber ?? undefined,
          associationName: r.associationName ?? undefined,
          registrationDate: r.registrationDate ? r.registrationDate.slice(0, 10) : undefined,
          girolando_grade: r.girolando_grade ?? undefined,
          notes: r.notes ?? undefined,
        })),
      );
      setSubmitError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, animal]);

  // Focus trap with Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const compositionTotal = compositions.reduce((sum, c) => sum + (c.percentage || 0), 0);

  const addComposition = useCallback(() => {
    setCompositions((prev) => [...prev, { breedId: '', percentage: 0 }]);
  }, []);

  const removeComposition = useCallback((index: number) => {
    setCompositions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateComposition = useCallback(
    (index: number, field: 'breedId' | 'percentage', value: string | number) => {
      setCompositions((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
    },
    [],
  );

  const addGenealogicalRecord = useCallback(() => {
    setGenealogicalRecords((prev) => [...prev, { genealogyClass: '' }]);
  }, []);

  const removeGenealogicalRecord = useCallback((index: number) => {
    setGenealogicalRecords((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateGenealogicalRecord = useCallback(
    (index: number, field: keyof GenealogicalRecordInput, value: string) => {
      setGenealogicalRecords((prev) =>
        prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const canGoStep2 = earTag.trim() !== '' && sex !== '';
  const compositionValid = compositions.length === 0 || Math.abs(compositionTotal - 100) < 0.01;

  const goToStep = useCallback((newStep: number) => {
    setStep(newStep);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canGoStep2) return;
    if (!compositionValid) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (isEditMode && animal) {
        // Edit mode: PATCH
        const payload: UpdateAnimalPayload = {
          earTag: earTag.trim(),
          sex: sex as AnimalSex,
          origin,
          rfidTag: rfidTag.trim() || undefined,
          name: name.trim() || undefined,
          registeredName: registeredName.trim() || undefined,
          registrationNumber: registrationNumber.trim() || undefined,
          birthDate: birthDate || undefined,
          birthDateEstimated,
          category: category || undefined,
          entryWeightKg: entryWeightKg ? Number(entryWeightKg) : undefined,
          bodyConditionScore: bodyConditionScore ? Number(bodyConditionScore) : undefined,
          notes: notes.trim() || undefined,
          isCompositionEstimated,
          compositions: compositions.filter((c) => c.breedId && c.percentage > 0),
          genealogicalRecords: genealogicalRecords.filter((r) => r.genealogyClass),
        };

        await api.patch<AnimalDetail>(`/org/farms/${farmId}/animals/${animal.id}`, payload);
      } else {
        // Create mode: POST
        const payload: CreateAnimalPayload = {
          earTag: earTag.trim(),
          sex: sex as AnimalSex,
          origin,
        };

        if (rfidTag.trim()) payload.rfidTag = rfidTag.trim();
        if (name.trim()) payload.name = name.trim();
        if (registeredName.trim()) payload.registeredName = registeredName.trim();
        if (registrationNumber.trim()) payload.registrationNumber = registrationNumber.trim();
        if (birthDate) payload.birthDate = birthDate;
        if (birthDateEstimated) payload.birthDateEstimated = true;
        if (category) payload.category = category;
        if (entryWeightKg) payload.entryWeightKg = Number(entryWeightKg);
        if (bodyConditionScore) payload.bodyConditionScore = Number(bodyConditionScore);
        if (notes.trim()) payload.notes = notes.trim();
        if (isCompositionEstimated) payload.isCompositionEstimated = true;

        if (compositions.length > 0) {
          payload.compositions = compositions.filter((c) => c.breedId && c.percentage > 0);
        }

        if (genealogicalRecords.length > 0) {
          const validRecords = genealogicalRecords.filter((r) => r.genealogyClass);
          if (validRecords.length > 0) payload.genealogicalRecords = validRecords;
        }

        await api.post<AnimalDetail>(`/org/farms/${farmId}/animals`, payload);
      }

      onSuccess();
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : isEditMode
          ? 'Não foi possível atualizar o animal.'
          : 'Não foi possível cadastrar o animal.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    earTag,
    sex,
    rfidTag,
    name,
    registeredName,
    registrationNumber,
    birthDate,
    birthDateEstimated,
    category,
    origin,
    entryWeightKg,
    bodyConditionScore,
    notes,
    compositions,
    genealogicalRecords,
    isCompositionEstimated,
    farmId,
    animal,
    isEditMode,
    onSuccess,
    canGoStep2,
    compositionValid,
  ]);

  if (!isOpen) return null;

  return (
    <div className="create-animal-overlay" onClick={onClose}>
      <div
        className="create-animal-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditMode ? 'Editar animal' : 'Cadastrar animal'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="create-animal-modal__header">
          <div className="create-animal-modal__header-content">
            <h2 className="create-animal-modal__title">{isEditMode ? 'Editar animal' : 'Cadastrar animal'}</h2>
            <nav className="create-animal-modal__stepper" aria-label="Progresso do cadastro">
              {STEPS.map((s, i) => {
                const isCompleted = step > s.number;
                const isCurrent = step === s.number;
                return (
                  <div key={s.number} className="create-animal-modal__step-item">
                    {i > 0 && (
                      <div
                        className={`create-animal-modal__step-connector ${isCompleted || isCurrent ? 'create-animal-modal__step-connector--active' : ''}`}
                      />
                    )}
                    <button
                      type="button"
                      className={`create-animal-modal__step-circle ${
                        isCurrent ? 'create-animal-modal__step-circle--current' : ''
                      } ${isCompleted ? 'create-animal-modal__step-circle--completed' : ''}`}
                      onClick={() => {
                        if (s.number === 1 || (s.number === 2 && canGoStep2) || (s.number === 3 && canGoStep2 && compositionValid)) {
                          goToStep(s.number);
                        }
                      }}
                      aria-current={isCurrent ? 'step' : undefined}
                      aria-label={`Etapa ${s.number}: ${s.label}${isCompleted ? ' (concluída)' : isCurrent ? ' (atual)' : ''}`}
                    >
                      {isCompleted ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <span>{s.number}</span>
                      )}
                    </button>
                    <span
                      className={`create-animal-modal__step-label ${
                        isCurrent ? 'create-animal-modal__step-label--current' : ''
                      } ${isCompleted ? 'create-animal-modal__step-label--completed' : ''}`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </nav>
          </div>
          <button
            type="button"
            className="create-animal-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div className="create-animal-modal__body" ref={bodyRef}>
          {submitError && (
            <div className="create-animal-modal__alert" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {submitError}
            </div>
          )}

          {/* Step 1: Basic Data */}
          {step === 1 && (
            <div className="create-animal-modal__step-content">
              <fieldset className="create-animal-modal__fieldset">
                <legend className="create-animal-modal__fieldset-legend">Identificação</legend>
                <div className="create-animal-modal__row">
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-ear-tag" className="create-animal-modal__label">
                      Brinco <span className="create-animal-modal__required">*</span>
                    </label>
                    <input
                      id="animal-ear-tag"
                      type="text"
                      className="create-animal-modal__input create-animal-modal__input--mono"
                      value={earTag}
                      onChange={(e) => setEarTag(e.target.value)}
                      aria-required="true"
                      placeholder="Ex: BR-001"
                    />
                  </div>
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-rfid" className="create-animal-modal__label">
                      RFID
                    </label>
                    <input
                      id="animal-rfid"
                      type="text"
                      className="create-animal-modal__input create-animal-modal__input--mono"
                      value={rfidTag}
                      onChange={(e) => setRfidTag(e.target.value)}
                      placeholder="Tag eletrônica"
                    />
                  </div>
                </div>

                <div className="create-animal-modal__row">
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-name" className="create-animal-modal__label">
                      Nome
                    </label>
                    <input
                      id="animal-name"
                      type="text"
                      className="create-animal-modal__input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Mimosa"
                    />
                  </div>
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-sex" className="create-animal-modal__label">
                      Sexo <span className="create-animal-modal__required">*</span>
                    </label>
                    <select
                      id="animal-sex"
                      className="create-animal-modal__select"
                      value={sex}
                      onChange={(e) => {
                        setSex(e.target.value as AnimalSex);
                        setCategory('');
                      }}
                      aria-required="true"
                    >
                      <option value="">Selecione...</option>
                      {Object.entries(SEX_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="create-animal-modal__row">
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-registered-name" className="create-animal-modal__label">
                      Nome completo (registro)
                    </label>
                    <input
                      id="animal-registered-name"
                      type="text"
                      className="create-animal-modal__input"
                      value={registeredName}
                      onChange={(e) => setRegisteredName(e.target.value)}
                      placeholder="Ex: Mimosa da Fazenda Limeira"
                    />
                  </div>
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-registration-number" className="create-animal-modal__label">
                      N. registro (associação)
                    </label>
                    <input
                      id="animal-registration-number"
                      type="text"
                      className="create-animal-modal__input create-animal-modal__input--mono"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="Ex: 12345-AB"
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="create-animal-modal__fieldset">
                <legend className="create-animal-modal__fieldset-legend">Classificação</legend>
                <div className="create-animal-modal__row">
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-birthdate" className="create-animal-modal__label">
                      Data de nascimento
                    </label>
                    <input
                      id="animal-birthdate"
                      type="date"
                      className="create-animal-modal__input"
                      value={birthDate}
                      onChange={(e) => {
                        setBirthDate(e.target.value);
                        setCategory('');
                      }}
                    />
                    <label className="create-animal-modal__checkbox-label">
                      <input
                        type="checkbox"
                        checked={birthDateEstimated}
                        onChange={(e) => setBirthDateEstimated(e.target.checked)}
                      />
                      Data estimada
                    </label>
                  </div>
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-category" className="create-animal-modal__label">
                      Categoria
                      {suggestedCategory && (
                        <span className="create-animal-modal__hint">
                          {' '}
                          (sugerido: {CATEGORY_LABELS[suggestedCategory]})
                        </span>
                      )}
                    </label>
                    <select
                      id="animal-category"
                      className="create-animal-modal__select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as AnimalCategory)}
                    >
                      <option value="">Auto (pela idade)</option>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="create-animal-modal__row">
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-origin" className="create-animal-modal__label">
                      Origem
                    </label>
                    <select
                      id="animal-origin"
                      className="create-animal-modal__select"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value as AnimalOrigin)}
                    >
                      {Object.entries(ORIGIN_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-weight" className="create-animal-modal__label">
                      Peso de entrada (kg)
                    </label>
                    <input
                      id="animal-weight"
                      type="number"
                      className="create-animal-modal__input"
                      value={entryWeightKg}
                      onChange={(e) => setEntryWeightKg(e.target.value)}
                      placeholder="Ex: 350"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="create-animal-modal__fieldset">
                <legend className="create-animal-modal__fieldset-legend">Condição e observações</legend>
                <div className="create-animal-modal__row">
                  <div className="create-animal-modal__field">
                    <label htmlFor="animal-bcs" className="create-animal-modal__label">
                      Escore de condição corporal (1-5)
                    </label>
                    <select
                      id="animal-bcs"
                      className="create-animal-modal__select"
                      value={bodyConditionScore}
                      onChange={(e) => setBodyConditionScore(e.target.value)}
                    >
                      <option value="">Não informado</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="create-animal-modal__field" />
                </div>

                <div className="create-animal-modal__field create-animal-modal__field--full">
                  <label htmlFor="animal-notes" className="create-animal-modal__label">
                    Observações
                  </label>
                  <textarea
                    id="animal-notes"
                    className="create-animal-modal__textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Observações sobre o animal..."
                  />
                </div>
              </fieldset>
            </div>
          )}

          {/* Step 2: Breed Composition */}
          {step === 2 && (
            <div className="create-animal-modal__step-content">
              {compositions.length === 0 ? (
                <div className="create-animal-modal__empty-state">
                  <Dna size={48} aria-hidden="true" className="create-animal-modal__empty-icon" />
                  <h3 className="create-animal-modal__empty-title">Nenhuma raça adicionada</h3>
                  <p className="create-animal-modal__empty-desc">
                    Informe a composição racial do animal. A soma dos percentuais deve totalizar 100%.
                    Este passo é opcional.
                  </p>
                  <button
                    type="button"
                    className="create-animal-modal__add-btn"
                    onClick={addComposition}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Adicionar raça
                  </button>
                </div>
              ) : (
                <>
                  <p className="create-animal-modal__section-desc">
                    Informe a composição racial do animal. A soma dos percentuais deve ser 100%.
                  </p>

                  {/* Progress bar */}
                  <div className="create-animal-modal__composition-progress">
                    <div className="create-animal-modal__progress-bar">
                      <div
                        className={`create-animal-modal__progress-fill ${
                          compositionTotal > 100
                            ? 'create-animal-modal__progress-fill--over'
                            : Math.abs(compositionTotal - 100) < 0.01
                              ? 'create-animal-modal__progress-fill--complete'
                              : ''
                        }`}
                        style={{ width: `${Math.min(compositionTotal, 100)}%` }}
                      />
                    </div>
                    <div className="create-animal-modal__progress-info">
                      <span
                        className={`create-animal-modal__total ${
                          Math.abs(compositionTotal - 100) < 0.01
                            ? 'create-animal-modal__total--ok'
                            : compositionTotal > 100
                              ? 'create-animal-modal__total--error'
                              : ''
                        }`}
                      >
                        {compositionTotal.toFixed(1)}%
                      </span>
                      {girolandoGrade && (
                        <span className="create-animal-modal__girolando-badge">
                          Girolando {girolandoGrade}
                        </span>
                      )}
                    </div>
                  </div>

                  {compositions.map((comp, index) => (
                    <div key={index} className="create-animal-modal__composition-row">
                      <div className="create-animal-modal__field" style={{ flex: 2 }}>
                        <label htmlFor={`breed-${index}`} className="create-animal-modal__label">
                          Raça
                        </label>
                        <select
                          id={`breed-${index}`}
                          className="create-animal-modal__select"
                          value={comp.breedId}
                          onChange={(e) => updateComposition(index, 'breedId', e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {breeds.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="create-animal-modal__field" style={{ flex: 1 }}>
                        <label htmlFor={`pct-${index}`} className="create-animal-modal__label">
                          %
                        </label>
                        <input
                          id={`pct-${index}`}
                          type="number"
                          className="create-animal-modal__input create-animal-modal__input--mono"
                          value={comp.percentage || ''}
                          onChange={(e) =>
                            updateComposition(index, 'percentage', Number(e.target.value))
                          }
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </div>
                      <button
                        type="button"
                        className="create-animal-modal__remove-btn"
                        onClick={() => removeComposition(index)}
                        aria-label={`Remover raça ${breedNames[comp.breedId] || ''}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="create-animal-modal__add-btn"
                    onClick={addComposition}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Adicionar raça
                  </button>

                  <label className="create-animal-modal__checkbox-label">
                    <input
                      type="checkbox"
                      checked={isCompositionEstimated}
                      onChange={(e) => setIsCompositionEstimated(e.target.checked)}
                    />
                    Composição estimada
                  </label>
                </>
              )}
            </div>
          )}

          {/* Step 3: Genealogy */}
          {step === 3 && (
            <div className="create-animal-modal__step-content">
              {genealogicalRecords.length === 0 ? (
                <div className="create-animal-modal__empty-state">
                  <ScrollText size={48} aria-hidden="true" className="create-animal-modal__empty-icon" />
                  <h3 className="create-animal-modal__empty-title">Nenhum registro genealógico</h3>
                  <p className="create-animal-modal__empty-desc">
                    Registros genealógicos são opcionais. Adicione se o animal possui registro em
                    associação de criadores.
                  </p>
                  <button
                    type="button"
                    className="create-animal-modal__add-btn"
                    onClick={addGenealogicalRecord}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Adicionar registro genealógico
                  </button>
                </div>
              ) : (
                <>
                  <p className="create-animal-modal__section-desc">
                    Registros genealógicos são opcionais. Adicione se o animal possui registro em
                    associação.
                  </p>

                  {genealogicalRecords.map((rec, index) => (
                    <div key={index} className="create-animal-modal__genealogy-card">
                      <div className="create-animal-modal__genealogy-card-header">
                        <span className="create-animal-modal__genealogy-card-number">
                          Registro {index + 1}
                        </span>
                        <button
                          type="button"
                          className="create-animal-modal__remove-btn create-animal-modal__remove-btn--compact"
                          onClick={() => removeGenealogicalRecord(index)}
                          aria-label="Remover registro genealógico"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="create-animal-modal__row">
                        <div className="create-animal-modal__field" style={{ flex: 2 }}>
                          <label htmlFor={`gen-class-${index}`} className="create-animal-modal__label">
                            Classe
                          </label>
                          <select
                            id={`gen-class-${index}`}
                            className="create-animal-modal__select"
                            value={rec.genealogyClass}
                            onChange={(e) =>
                              updateGenealogicalRecord(index, 'genealogyClass', e.target.value)
                            }
                          >
                            <option value="">Selecione...</option>
                            {Object.entries(GENEALOGY_CLASS_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="create-animal-modal__field" style={{ flex: 1 }}>
                          <label htmlFor={`gen-number-${index}`} className="create-animal-modal__label">
                            N. Registro
                          </label>
                          <input
                            id={`gen-number-${index}`}
                            type="text"
                            className="create-animal-modal__input create-animal-modal__input--mono"
                            value={rec.registrationNumber ?? ''}
                            onChange={(e) =>
                              updateGenealogicalRecord(index, 'registrationNumber', e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="create-animal-modal__row">
                        <div className="create-animal-modal__field">
                          <label htmlFor={`gen-assoc-${index}`} className="create-animal-modal__label">
                            Associação
                          </label>
                          <input
                            id={`gen-assoc-${index}`}
                            type="text"
                            className="create-animal-modal__input"
                            value={rec.associationName ?? ''}
                            onChange={(e) =>
                              updateGenealogicalRecord(index, 'associationName', e.target.value)
                            }
                            placeholder="Ex: ABCGIL"
                          />
                        </div>
                        <div className="create-animal-modal__field">
                          <label htmlFor={`gen-date-${index}`} className="create-animal-modal__label">
                            Data do registro
                          </label>
                          <input
                            id={`gen-date-${index}`}
                            type="date"
                            className="create-animal-modal__input"
                            value={rec.registrationDate ?? ''}
                            onChange={(e) =>
                              updateGenealogicalRecord(index, 'registrationDate', e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="create-animal-modal__add-btn"
                    onClick={addGenealogicalRecord}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Adicionar registro genealógico
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="create-animal-modal__footer">
          {step > 1 && (
            <button
              type="button"
              className="create-animal-modal__btn create-animal-modal__btn--secondary"
              onClick={() => goToStep(step - 1)}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar
            </button>
          )}
          <div className="create-animal-modal__footer-spacer" />
          {step < 3 ? (
            <button
              type="button"
              className="create-animal-modal__btn create-animal-modal__btn--primary"
              disabled={step === 1 && !canGoStep2}
              onClick={() => {
                if (step === 2 && !compositionValid) return;
                goToStep(step + 1);
              }}
            >
              Próximo
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="create-animal-modal__btn create-animal-modal__btn--primary"
              disabled={isSubmitting || !canGoStep2 || !compositionValid}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="create-animal-modal__spinner" aria-hidden="true" />
                  Salvando...
                </>
              ) : isEditMode ? (
                'Salvar alterações'
              ) : (
                'Cadastrar animal'
              )}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export default CreateAnimalModal;
