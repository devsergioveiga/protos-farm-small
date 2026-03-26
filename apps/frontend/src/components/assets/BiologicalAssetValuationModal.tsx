import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import type { CreateBiologicalValuationInput, BiologicalGroupType } from '@/types/asset';
import { ANIMAL_GROUPS, PERENNIAL_CROP_GROUPS } from '@/types/asset';
import './BiologicalAssetValuationModal.css';

interface BiologicalAssetValuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (input: CreateBiologicalValuationInput) => Promise<void>;
}

interface FormState {
  farmId: string;
  groupType: BiologicalGroupType;
  assetGroup: string;
  valuationDate: string;
  headCount: string;
  areaHa: string;
  pricePerUnit: string;
  totalFairValue: string;
  notes: string;
}

const INITIAL_FORM: FormState = {
  farmId: '',
  groupType: 'ANIMAL',
  assetGroup: '',
  valuationDate: '',
  headCount: '',
  areaHa: '',
  pricePerUnit: '',
  totalFairValue: '',
  notes: '',
};

export default function BiologicalAssetValuationModal({
  isOpen,
  onClose,
  onSuccess,
  onSubmit,
}: BiologicalAssetValuationModalProps) {
  const { farms } = useFarmContext();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL_FORM);
      setErrors({});
      setSubmitError(null);
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Auto-compute totalFairValue
  useEffect(() => {
    const price = parseFloat(form.pricePerUnit);
    if (isNaN(price)) return;

    if (form.groupType === 'ANIMAL') {
      const count = parseInt(form.headCount, 10);
      if (!isNaN(count) && count > 0) {
        setForm((prev) => ({ ...prev, totalFairValue: (price * count).toFixed(2) }));
      }
    } else {
      const area = parseFloat(form.areaHa);
      if (!isNaN(area) && area > 0) {
        setForm((prev) => ({ ...prev, totalFairValue: (price * area).toFixed(2) }));
      }
    }
  }, [form.pricePerUnit, form.headCount, form.areaHa, form.groupType]);

  const handleGroupTypeChange = useCallback((gt: BiologicalGroupType) => {
    setForm((prev) => ({
      ...prev,
      groupType: gt,
      assetGroup: '',
      headCount: '',
      areaHa: '',
    }));
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    },
    [],
  );

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.farmId) newErrors.farmId = 'Selecione a fazenda';
    if (!form.assetGroup) newErrors.assetGroup = 'Selecione o grupo';
    if (!form.valuationDate) newErrors.valuationDate = 'Informe a data de avaliacao';
    if (!form.pricePerUnit || isNaN(parseFloat(form.pricePerUnit))) {
      newErrors.pricePerUnit = 'Informe o preco por unidade';
    }
    if (!form.totalFairValue || isNaN(parseFloat(form.totalFairValue))) {
      newErrors.totalFairValue = 'Informe o valor justo total';
    }
    if (form.groupType === 'ANIMAL') {
      const count = parseInt(form.headCount, 10);
      if (!form.headCount || isNaN(count) || count <= 0) {
        newErrors.headCount = 'Informe a quantidade de cabecas';
      }
    } else {
      const area = parseFloat(form.areaHa);
      if (!form.areaHa || isNaN(area) || area <= 0) {
        newErrors.areaHa = 'Informe a area em hectares';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const input: CreateBiologicalValuationInput = {
          farmId: form.farmId,
          valuationDate: form.valuationDate,
          assetGroup: form.assetGroup,
          groupType: form.groupType,
          pricePerUnit: parseFloat(form.pricePerUnit),
          totalFairValue: parseFloat(form.totalFairValue),
          notes: form.notes || undefined,
        };
        if (form.groupType === 'ANIMAL') {
          input.headCount = parseInt(form.headCount, 10);
        } else {
          input.areaHa = parseFloat(form.areaHa);
        }
        await onSubmit(input);
        onSuccess();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Nao foi possivel registrar a avaliacao.';
        setSubmitError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, onSubmit, onSuccess],
  );

  if (!isOpen) return null;

  const groups = form.groupType === 'ANIMAL' ? ANIMAL_GROUPS : PERENNIAL_CROP_GROUPS;

  return (
    <div className="bio-val-modal__overlay" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-labelledby="bio-val-modal-title">
      <div className="bio-val-modal__dialog">
        {/* Header */}
        <header className="bio-val-modal__header">
          <h2 id="bio-val-modal-title">Registrar Avaliacao de Valor Justo</h2>
          <button
            type="button"
            className="bio-val-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div className="bio-val-modal__body">
          <form id="bio-val-form" className="bio-val-modal__form" onSubmit={handleSubmit} noValidate>

            {/* Fazenda */}
            <div className="bio-val-modal__field">
              <label className="bio-val-modal__label" htmlFor="bav-farmId">
                Fazenda <span className="required" aria-hidden="true">*</span>
              </label>
              <select
                id="bav-farmId"
                name="farmId"
                className="bio-val-modal__select"
                value={form.farmId}
                onChange={handleChange}
                aria-required="true"
                ref={firstInputRef}
              >
                <option value="">Selecione a fazenda</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.farmId && (
                <span className="bio-val-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" />
                  {errors.farmId}
                </span>
              )}
            </div>

            {/* Tipo de Grupo */}
            <div className="bio-val-modal__field">
              <span className="bio-val-modal__label" id="bav-groupType-label">
                Tipo de grupo <span className="required" aria-hidden="true">*</span>
              </span>
              <div className="bio-val-modal__radio-group" role="radiogroup" aria-labelledby="bav-groupType-label">
                <label className="bio-val-modal__radio-label">
                  <input
                    type="radio"
                    name="groupType"
                    value="ANIMAL"
                    checked={form.groupType === 'ANIMAL'}
                    onChange={() => handleGroupTypeChange('ANIMAL')}
                    aria-required="true"
                  />
                  Rebanho
                </label>
                <label className="bio-val-modal__radio-label">
                  <input
                    type="radio"
                    name="groupType"
                    value="PERENNIAL_CROP"
                    checked={form.groupType === 'PERENNIAL_CROP'}
                    onChange={() => handleGroupTypeChange('PERENNIAL_CROP')}
                  />
                  Cultura Perene
                </label>
              </div>
            </div>

            {/* Grupo */}
            <div className="bio-val-modal__field">
              <label className="bio-val-modal__label" htmlFor="bav-assetGroup">
                Grupo <span className="required" aria-hidden="true">*</span>
              </label>
              <select
                id="bav-assetGroup"
                name="assetGroup"
                className="bio-val-modal__select"
                value={form.assetGroup}
                onChange={handleChange}
                aria-required="true"
              >
                <option value="">Selecione o grupo</option>
                {groups.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              {errors.assetGroup && (
                <span className="bio-val-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" />
                  {errors.assetGroup}
                </span>
              )}
            </div>

            {/* Data de avaliacao */}
            <div className="bio-val-modal__field">
              <label className="bio-val-modal__label" htmlFor="bav-valuationDate">
                Data de avaliacao <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                id="bav-valuationDate"
                type="date"
                name="valuationDate"
                className="bio-val-modal__input"
                value={form.valuationDate}
                onChange={handleChange}
                aria-required="true"
              />
              {errors.valuationDate && (
                <span className="bio-val-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" />
                  {errors.valuationDate}
                </span>
              )}
            </div>

            {/* Quantidade de cabecas (ANIMAL only) */}
            {form.groupType === 'ANIMAL' && (
              <div className="bio-val-modal__field">
                <label className="bio-val-modal__label" htmlFor="bav-headCount">
                  Quantidade de cabecas <span className="required" aria-hidden="true">*</span>
                </label>
                <input
                  id="bav-headCount"
                  type="number"
                  name="headCount"
                  className="bio-val-modal__input"
                  value={form.headCount}
                  onChange={handleChange}
                  min={1}
                  step={1}
                  placeholder="0"
                  aria-required="true"
                />
                {errors.headCount && (
                  <span className="bio-val-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" />
                    {errors.headCount}
                  </span>
                )}
              </div>
            )}

            {/* Area ha (PERENNIAL_CROP only) */}
            {form.groupType === 'PERENNIAL_CROP' && (
              <div className="bio-val-modal__field">
                <label className="bio-val-modal__label" htmlFor="bav-areaHa">
                  Area (ha) <span className="required" aria-hidden="true">*</span>
                </label>
                <input
                  id="bav-areaHa"
                  type="number"
                  name="areaHa"
                  className="bio-val-modal__input"
                  value={form.areaHa}
                  onChange={handleChange}
                  min={0.0001}
                  step={0.0001}
                  placeholder="0.0000"
                  aria-required="true"
                />
                {errors.areaHa && (
                  <span className="bio-val-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" />
                    {errors.areaHa}
                  </span>
                )}
              </div>
            )}

            {/* Preco e total */}
            <div className="bio-val-modal__row">
              <div className="bio-val-modal__field">
                <label className="bio-val-modal__label" htmlFor="bav-pricePerUnit">
                  Preco por unidade (R$) <span className="required" aria-hidden="true">*</span>
                </label>
                <input
                  id="bav-pricePerUnit"
                  type="number"
                  name="pricePerUnit"
                  className="bio-val-modal__input"
                  value={form.pricePerUnit}
                  onChange={handleChange}
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  aria-required="true"
                />
                {errors.pricePerUnit && (
                  <span className="bio-val-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" />
                    {errors.pricePerUnit}
                  </span>
                )}
              </div>
              <div className="bio-val-modal__field">
                <label className="bio-val-modal__label" htmlFor="bav-totalFairValue">
                  Valor justo total (R$) <span className="required" aria-hidden="true">*</span>
                </label>
                <input
                  id="bav-totalFairValue"
                  type="number"
                  name="totalFairValue"
                  className="bio-val-modal__input"
                  value={form.totalFairValue}
                  onChange={handleChange}
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  aria-required="true"
                />
                {errors.totalFairValue && (
                  <span className="bio-val-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" />
                    {errors.totalFairValue}
                  </span>
                )}
              </div>
            </div>

            {/* Observacoes */}
            <div className="bio-val-modal__field">
              <label className="bio-val-modal__label" htmlFor="bav-notes">
                Observacoes
              </label>
              <textarea
                id="bav-notes"
                name="notes"
                className="bio-val-modal__textarea"
                value={form.notes}
                onChange={handleChange}
                placeholder="Informacoes adicionais sobre a avaliacao..."
              />
            </div>

            {submitError && (
              <div className="bio-val-modal__error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {submitError}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <footer className="bio-val-modal__footer">
          <button type="button" className="bio-val-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="bio-val-form"
            className="bio-val-modal__btn-submit"
            disabled={submitting}
          >
            {submitting ? 'Registrando...' : 'Registrar Avaliacao'}
          </button>
        </footer>
      </div>
    </div>
  );
}
