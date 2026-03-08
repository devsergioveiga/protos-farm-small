import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { CULTIVAR_TYPES, CROP_OPTIONS } from '@/types/cultivar';
import type { CultivarItem, CreateCultivarInput } from '@/types/cultivar';
import './CultivarModal.css';

interface CultivarModalProps {
  isOpen: boolean;
  cultivar: CultivarItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CultivarModal({ isOpen, cultivar, onClose, onSuccess }: CultivarModalProps) {
  const isEditing = !!cultivar;

  const [name, setName] = useState('');
  const [crop, setCrop] = useState('');
  const [breeder, setBreeder] = useState('');
  const [cycleDays, setCycleDays] = useState('');
  const [maturationGroup, setMaturationGroup] = useState('');
  const [type, setType] = useState('CONVENCIONAL');
  const [technology, setTechnology] = useState('');
  const [diseaseTolerances, setDiseaseTolerances] = useState('');
  const [regionalAptitude, setRegionalAptitude] = useState('');
  const [populationRecommendation, setPopulationRecommendation] = useState('');
  const [plantingWindowStart, setPlantingWindowStart] = useState('');
  const [plantingWindowEnd, setPlantingWindowEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setCrop('');
      setBreeder('');
      setCycleDays('');
      setMaturationGroup('');
      setType('CONVENCIONAL');
      setTechnology('');
      setDiseaseTolerances('');
      setRegionalAptitude('');
      setPopulationRecommendation('');
      setPlantingWindowStart('');
      setPlantingWindowEnd('');
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
    } else if (cultivar) {
      setName(cultivar.name);
      setCrop(cultivar.crop);
      setBreeder(cultivar.breeder ?? '');
      setCycleDays(cultivar.cycleDays != null ? String(cultivar.cycleDays) : '');
      setMaturationGroup(cultivar.maturationGroup ?? '');
      setType(cultivar.type);
      setTechnology(cultivar.technology ?? '');
      setDiseaseTolerances(cultivar.diseaseTolerances ?? '');
      setRegionalAptitude(cultivar.regionalAptitude ?? '');
      setPopulationRecommendation(cultivar.populationRecommendation ?? '');
      setPlantingWindowStart(cultivar.plantingWindowStart ?? '');
      setPlantingWindowEnd(cultivar.plantingWindowEnd ?? '');
      setNotes(cultivar.notes ?? '');
    }
  }, [isOpen, cultivar]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const canSubmit = name.trim() !== '' && crop.trim() !== '';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateCultivarInput = {
        name: name.trim(),
        crop: crop.trim(),
        breeder: breeder.trim() || undefined,
        cycleDays: cycleDays ? Number(cycleDays) : null,
        maturationGroup: maturationGroup.trim() || undefined,
        type,
        technology: technology.trim() || undefined,
        diseaseTolerances: diseaseTolerances.trim() || undefined,
        regionalAptitude: regionalAptitude.trim() || undefined,
        populationRecommendation: populationRecommendation.trim() || undefined,
        plantingWindowStart: plantingWindowStart || undefined,
        plantingWindowEnd: plantingWindowEnd || undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await api.patch(`/org/cultivars/${cultivar!.id}`, payload);
      } else {
        await api.post('/org/cultivars', payload);
      }
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar cultivar';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    name,
    crop,
    breeder,
    cycleDays,
    maturationGroup,
    type,
    technology,
    diseaseTolerances,
    regionalAptitude,
    populationRecommendation,
    plantingWindowStart,
    plantingWindowEnd,
    notes,
    isEditing,
    cultivar,
    onSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <div className="cultivar-overlay" onClick={onClose}>
      <div
        className="cultivar-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar cultivar' : 'Nova cultivar'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="cultivar-modal__header">
          <h2 className="cultivar-modal__title">
            {isEditing ? 'Editar cultivar' : 'Nova cultivar'}
          </h2>
          <button
            type="button"
            className="cultivar-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="cultivar-modal__body">
          <div className="cultivar-modal__fields">
            {/* Dados básicos */}
            <h3 className="cultivar-modal__section-title">Dados básicos</h3>

            <div className="cultivar-modal__row">
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-name" className="cultivar-modal__label">
                  Nome da cultivar *
                </label>
                <input
                  id="cultivar-name"
                  type="text"
                  className="cultivar-modal__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: TMG 7262 RR"
                  aria-required="true"
                />
              </div>
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-crop" className="cultivar-modal__label">
                  Cultura *
                </label>
                <select
                  id="cultivar-crop"
                  className="cultivar-modal__select"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione</option>
                  {CROP_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="cultivar-modal__row--three">
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-breeder" className="cultivar-modal__label">
                  Obtentora
                </label>
                <input
                  id="cultivar-breeder"
                  type="text"
                  className="cultivar-modal__input"
                  value={breeder}
                  onChange={(e) => setBreeder(e.target.value)}
                  placeholder="Ex: TMG, Embrapa"
                />
              </div>
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-type" className="cultivar-modal__label">
                  Tipo
                </label>
                <select
                  id="cultivar-type"
                  className="cultivar-modal__select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {CULTIVAR_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-technology" className="cultivar-modal__label">
                  Tecnologia
                </label>
                <input
                  id="cultivar-technology"
                  type="text"
                  className="cultivar-modal__input"
                  value={technology}
                  onChange={(e) => setTechnology(e.target.value)}
                  placeholder="Ex: RR, IPRO, Bt"
                />
              </div>
            </div>

            <div className="cultivar-modal__row--three">
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-cycle" className="cultivar-modal__label">
                  Ciclo (dias)
                </label>
                <input
                  id="cultivar-cycle"
                  type="number"
                  className="cultivar-modal__input"
                  value={cycleDays}
                  onChange={(e) => setCycleDays(e.target.value)}
                  placeholder="Ex: 120"
                  min="1"
                />
              </div>
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-maturation" className="cultivar-modal__label">
                  Grupo de maturação
                </label>
                <input
                  id="cultivar-maturation"
                  type="text"
                  className="cultivar-modal__input"
                  value={maturationGroup}
                  onChange={(e) => setMaturationGroup(e.target.value)}
                  placeholder="Ex: 7.2"
                />
              </div>
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-population" className="cultivar-modal__label">
                  População recomendada
                </label>
                <input
                  id="cultivar-population"
                  type="text"
                  className="cultivar-modal__input"
                  value={populationRecommendation}
                  onChange={(e) => setPopulationRecommendation(e.target.value)}
                  placeholder="Ex: 300.000 pl/ha"
                />
              </div>
            </div>

            {/* Características */}
            <h3 className="cultivar-modal__section-title">Características</h3>

            <div className="cultivar-modal__row">
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-diseases" className="cultivar-modal__label">
                  Tolerância a doenças
                </label>
                <input
                  id="cultivar-diseases"
                  type="text"
                  className="cultivar-modal__input"
                  value={diseaseTolerances}
                  onChange={(e) => setDiseaseTolerances(e.target.value)}
                  placeholder="Ex: Ferrugem asiática (moderada), Nematoides (alta)"
                />
              </div>
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-aptitude" className="cultivar-modal__label">
                  Aptidão regional
                </label>
                <input
                  id="cultivar-aptitude"
                  type="text"
                  className="cultivar-modal__input"
                  value={regionalAptitude}
                  onChange={(e) => setRegionalAptitude(e.target.value)}
                  placeholder="Ex: SP, MG, GO, MS"
                />
              </div>
            </div>

            <div className="cultivar-modal__row">
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-window-start" className="cultivar-modal__label">
                  Janela de plantio (início)
                </label>
                <input
                  id="cultivar-window-start"
                  type="date"
                  className="cultivar-modal__input"
                  value={plantingWindowStart}
                  onChange={(e) => setPlantingWindowStart(e.target.value)}
                />
              </div>
              <div className="cultivar-modal__field">
                <label htmlFor="cultivar-window-end" className="cultivar-modal__label">
                  Janela de plantio (fim)
                </label>
                <input
                  id="cultivar-window-end"
                  type="date"
                  className="cultivar-modal__input"
                  value={plantingWindowEnd}
                  onChange={(e) => setPlantingWindowEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Observações */}
            <h3 className="cultivar-modal__section-title">Observações do agrônomo</h3>

            <div className="cultivar-modal__field">
              <label htmlFor="cultivar-notes" className="cultivar-modal__label">
                Observações e avaliações
              </label>
              <textarea
                id="cultivar-notes"
                className="cultivar-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas de campo, avaliações, comportamento observado..."
                rows={4}
              />
            </div>
          </div>

          {submitError && (
            <div className="cultivar-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cultivar-modal__footer">
          <div className="cultivar-modal__footer-spacer" />
          <button
            type="button"
            className="cultivar-modal__btn cultivar-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="cultivar-modal__btn cultivar-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar cultivar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CultivarModal;
