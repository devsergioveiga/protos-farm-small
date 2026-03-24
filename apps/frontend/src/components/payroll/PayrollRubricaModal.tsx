import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { PayrollRubrica, CreateRubricaInput, UpdateRubricaInput, RubricaType, CalculationType } from '@/types/payroll';
import './PayrollRubricaModal.css';

interface PayrollRubricaModalProps {
  isOpen: boolean;
  rubrica: PayrollRubrica | null;
  onSave: (data: CreateRubricaInput | UpdateRubricaInput) => Promise<boolean>;
  onClose: () => void;
}

const AVAILABLE_VARIABLES = [
  'SALARIO_BASE',
  'HORA_NORMAL',
  'HORAS_EXTRAS_50',
  'HORAS_EXTRAS_100',
  'SALARIO_MINIMO',
  'PISO_REGIONAL',
  'DIAS_TRABALHADOS',
  'DIAS_UTEIS_MES',
];

interface FormErrors {
  name?: string;
  code?: string;
  rubricaType?: string;
  calculationType?: string;
  rate?: string;
  baseFormula?: string;
}

export default function PayrollRubricaModal({
  isOpen,
  rubrica,
  onSave,
  onClose,
}: PayrollRubricaModalProps) {
  const isEditing = rubrica !== null;
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [rubricaType, setRubricaType] = useState<RubricaType>('PROVENTO');
  const [calculationType, setCalculationType] = useState<CalculationType>('PERCENTAGE');
  const [rate, setRate] = useState('');
  const [baseFormula, setBaseFormula] = useState('');
  const [incideINSS, setIncideINSS] = useState(false);
  const [incideFGTS, setIncideFGTS] = useState(false);
  const [incideIRRF, setIncideIRRF] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Capture trigger element when modal opens
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (isOpen) {
      if (rubrica) {
        setName(rubrica.name);
        setCode(rubrica.code);
        setRubricaType(rubrica.rubricaType);
        setCalculationType(
          rubrica.calculationType === 'SYSTEM' ? 'PERCENTAGE' : rubrica.calculationType,
        );
        setRate(rubrica.rate ?? '');
        setBaseFormula(rubrica.baseFormula ?? '');
        setIncideINSS(rubrica.incideINSS);
        setIncideFGTS(rubrica.incideFGTS);
        setIncideIRRF(rubrica.incideIRRF);
      } else {
        setName('');
        setCode('');
        setRubricaType('PROVENTO');
        setCalculationType('PERCENTAGE');
        setRate('');
        setBaseFormula('');
        setIncideINSS(false);
        setIncideFGTS(false);
        setIncideIRRF(false);
      }
      setErrors({});
      setTimeout(() => firstFieldRef.current?.focus(), 100);
    }
  }, [isOpen, rubrica]);

  // Escape closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        setTimeout(() => {
          if (triggerRef.current instanceof HTMLElement) {
            triggerRef.current.focus();
          }
        }, 50);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const validateField = (field: keyof FormErrors, value: string): string | undefined => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Nome é obrigatório';
        if (value.length > 100) return 'Nome deve ter no máximo 100 caracteres';
        return undefined;
      case 'code':
        if (!value.trim()) return 'Código é obrigatório';
        return undefined;
      case 'rate':
        if (calculationType === 'PERCENTAGE') {
          const num = parseFloat(value);
          if (!value || isNaN(num)) return 'Taxa é obrigatória';
          if (num < 0.01 || num > 100) return 'Taxa deve estar entre 0,01% e 100%';
        }
        return undefined;
      case 'baseFormula':
        if (calculationType === 'FORMULA' && !value.trim()) return 'Fórmula é obrigatória';
        return undefined;
      default:
        return undefined;
    }
  };

  const handleBlur = (field: keyof FormErrors, value: string) => {
    const error = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const isFormValid = () => {
    if (!name.trim()) return false;
    if (!isEditing && !code.trim()) return false;
    if (calculationType === 'PERCENTAGE') {
      const num = parseFloat(rate);
      if (!rate || isNaN(num) || num < 0.01 || num > 100) return false;
    }
    if (calculationType === 'FORMULA' && !baseFormula.trim()) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: FormErrors = {};
    newErrors.name = validateField('name', name);
    if (!isEditing) newErrors.code = validateField('code', code);
    if (calculationType === 'PERCENTAGE') newErrors.rate = validateField('rate', rate);
    if (calculationType === 'FORMULA') newErrors.baseFormula = validateField('baseFormula', baseFormula);

    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const data: CreateRubricaInput | UpdateRubricaInput = isEditing
        ? {
            name: name.trim(),
            rubricaType,
            calculationType,
            ...(calculationType === 'PERCENTAGE' ? { rate: parseFloat(rate) } : {}),
            ...(calculationType === 'FORMULA' ? { baseFormula: baseFormula.trim() } : {}),
            incideINSS,
            incideFGTS,
            incideIRRF,
          }
        : {
            name: name.trim(),
            code: code.trim().toUpperCase(),
            rubricaType,
            calculationType,
            ...(calculationType === 'PERCENTAGE' ? { rate: parseFloat(rate) } : {}),
            ...(calculationType === 'FORMULA' ? { baseFormula: baseFormula.trim() } : {}),
            incideINSS,
            incideFGTS,
            incideIRRF,
          };

      const success = await onSave(data);
      if (success) {
        onClose();
        setTimeout(() => {
          if (triggerRef.current instanceof HTMLElement) {
            triggerRef.current.focus();
          }
        }, 50);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="rubrica-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rubrica-modal-title"
    >
      <div className="rubrica-modal">
        {/* Header */}
        <div className="rubrica-modal__header">
          <h2 id="rubrica-modal-title" className="rubrica-modal__title">
            {isEditing ? 'Editar Rubrica' : 'Nova Rubrica'}
          </h2>
          <button
            type="button"
            className="rubrica-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <div className="rubrica-modal__body">
            {/* Name */}
            <div className="rubrica-modal__field">
              <label htmlFor="rubrica-name" className="rubrica-modal__label">
                Nome da Rubrica <span aria-hidden="true">*</span>
              </label>
              <input
                ref={firstFieldRef}
                id="rubrica-name"
                type="text"
                className={`rubrica-modal__input ${errors.name ? 'rubrica-modal__input--error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => handleBlur('name', name)}
                maxLength={100}
                required
                aria-required="true"
                aria-describedby={errors.name ? 'rubrica-name-error' : undefined}
              />
              {errors.name && (
                <span id="rubrica-name-error" className="rubrica-modal__error" role="alert">
                  {errors.name}
                </span>
              )}
            </div>

            {/* Code (only on create) */}
            {!isEditing && (
              <div className="rubrica-modal__field">
                <label htmlFor="rubrica-code" className="rubrica-modal__label">
                  Código <span aria-hidden="true">*</span>
                </label>
                <input
                  id="rubrica-code"
                  type="text"
                  className={`rubrica-modal__input ${errors.code ? 'rubrica-modal__input--error' : ''}`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onBlur={() => handleBlur('code', code)}
                  required
                  aria-required="true"
                  aria-describedby={errors.code ? 'rubrica-code-error' : undefined}
                  placeholder="Ex: HORA_EXTRA_50"
                />
                {errors.code && (
                  <span id="rubrica-code-error" className="rubrica-modal__error" role="alert">
                    {errors.code}
                  </span>
                )}
              </div>
            )}

            {/* Tipo (radio group) */}
            <fieldset className="rubrica-modal__fieldset">
              <legend className="rubrica-modal__label">
                Tipo <span aria-hidden="true">*</span>
              </legend>
              <div className="rubrica-modal__radio-group">
                {(['PROVENTO', 'DESCONTO'] as RubricaType[]).map((type) => (
                  <label key={type} className="rubrica-modal__radio-label">
                    <input
                      type="radio"
                      name="rubricaType"
                      value={type}
                      checked={rubricaType === type}
                      onChange={() => setRubricaType(type)}
                      className="rubrica-modal__radio"
                    />
                    {type === 'PROVENTO' ? 'Provento' : 'Desconto'}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Tipo de Cálculo (radio group) */}
            <fieldset className="rubrica-modal__fieldset">
              <legend className="rubrica-modal__label">
                Tipo de Cálculo <span aria-hidden="true">*</span>
              </legend>
              <div className="rubrica-modal__radio-group">
                <label className="rubrica-modal__radio-label">
                  <input
                    type="radio"
                    name="calculationType"
                    value="PERCENTAGE"
                    checked={calculationType === 'PERCENTAGE'}
                    onChange={() => setCalculationType('PERCENTAGE')}
                    className="rubrica-modal__radio"
                  />
                  Percentual
                </label>
                <label className="rubrica-modal__radio-label">
                  <input
                    type="radio"
                    name="calculationType"
                    value="FORMULA"
                    checked={calculationType === 'FORMULA'}
                    onChange={() => setCalculationType('FORMULA')}
                    className="rubrica-modal__radio"
                  />
                  Fórmula
                </label>
              </div>
            </fieldset>

            {/* Taxa (visible only for PERCENTAGE) */}
            {calculationType === 'PERCENTAGE' && (
              <div className="rubrica-modal__field">
                <label htmlFor="rubrica-rate" className="rubrica-modal__label">
                  Taxa (%) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="rubrica-rate"
                  type="number"
                  className={`rubrica-modal__input ${errors.rate ? 'rubrica-modal__input--error' : ''}`}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  onBlur={() => handleBlur('rate', rate)}
                  min={0.01}
                  max={100}
                  step={0.01}
                  required
                  aria-required="true"
                  aria-describedby={errors.rate ? 'rubrica-rate-error' : undefined}
                />
                {errors.rate && (
                  <span id="rubrica-rate-error" className="rubrica-modal__error" role="alert">
                    {errors.rate}
                  </span>
                )}
              </div>
            )}

            {/* Fórmula (visible only for FORMULA) */}
            {calculationType === 'FORMULA' && (
              <div className="rubrica-modal__field">
                <label htmlFor="rubrica-formula" className="rubrica-modal__label">
                  Fórmula <span aria-hidden="true">*</span>
                </label>
                <input
                  id="rubrica-formula"
                  type="text"
                  className={`rubrica-modal__input rubrica-modal__input--mono ${errors.baseFormula ? 'rubrica-modal__input--error' : ''}`}
                  style={{ fontFamily: 'var(--font-mono)' }}
                  value={baseFormula}
                  onChange={(e) => setBaseFormula(e.target.value)}
                  onBlur={() => handleBlur('baseFormula', baseFormula)}
                  placeholder="SALARIO_BASE * 0.05"
                  required
                  aria-required="true"
                  aria-describedby={errors.baseFormula ? 'rubrica-formula-error' : 'rubrica-formula-hint'}
                />
                {errors.baseFormula && (
                  <span id="rubrica-formula-error" className="rubrica-modal__error" role="alert">
                    {errors.baseFormula}
                  </span>
                )}
                {/* Variable reference panel */}
                <div id="rubrica-formula-hint" className="rubrica-modal__formula-vars">
                  <span className="rubrica-modal__formula-vars-label">Variáveis disponíveis:</span>
                  <div className="rubrica-modal__formula-vars-list">
                    {AVAILABLE_VARIABLES.map((v) => (
                      <code key={v} className="rubrica-modal__var-tag">
                        {v}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Incidências */}
            <fieldset className="rubrica-modal__fieldset">
              <legend className="rubrica-modal__label">Incidências</legend>
              <div className="rubrica-modal__checkbox-group">
                <label className="rubrica-modal__checkbox-label">
                  <input
                    type="checkbox"
                    checked={incideINSS}
                    onChange={(e) => setIncideINSS(e.target.checked)}
                    className="rubrica-modal__checkbox"
                  />
                  Incide INSS
                </label>
                <label className="rubrica-modal__checkbox-label">
                  <input
                    type="checkbox"
                    checked={incideFGTS}
                    onChange={(e) => setIncideFGTS(e.target.checked)}
                    className="rubrica-modal__checkbox"
                  />
                  Incide FGTS
                </label>
                <label className="rubrica-modal__checkbox-label">
                  <input
                    type="checkbox"
                    checked={incideIRRF}
                    onChange={(e) => setIncideIRRF(e.target.checked)}
                    className="rubrica-modal__checkbox"
                  />
                  Incide IRRF
                </label>
              </div>
            </fieldset>
          </div>

          {/* Footer */}
          <div className="rubrica-modal__footer">
            <button
              type="button"
              className="rubrica-modal__btn rubrica-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rubrica-modal__btn rubrica-modal__btn--primary"
              disabled={!isFormValid() || isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Rubrica'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
