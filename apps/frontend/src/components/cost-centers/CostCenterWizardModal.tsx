import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Check,
  AlertCircle,
  Tractor,
  Truck,
  Wrench,
  Building2,
  Mountain,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { useFarmContext } from '@/stores/FarmContext';
import './CostCenterWizardModal.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface CostCenterWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Template data ──────────────────────────────────────────────────────────

const CC_TEMPLATES: Record<
  string,
  { codePrefix: string; label: string; icon: string; examples: string[]; description: string }
> = {
  MAQUINA: {
    codePrefix: 'MAQ',
    label: 'Maquina',
    icon: 'Tractor',
    examples: ['MAQ-TRATOR-01', 'MAQ-COLHEITADEIRA-01', 'MAQ-PULVERIZADOR-01'],
    description: 'Tratores, colheitadeiras, pulverizadores e outras maquinas agricolas',
  },
  VEICULO: {
    codePrefix: 'VEI',
    label: 'Veiculo',
    icon: 'Truck',
    examples: ['VEI-CAMINHONETE-01', 'VEI-CAMINHAO-01'],
    description: 'Caminhonetes, caminhoes e veiculos utilitarios',
  },
  IMPLEMENTO: {
    codePrefix: 'IMP',
    label: 'Implemento',
    icon: 'Wrench',
    examples: ['IMP-GRADE-01', 'IMP-PLANTADEIRA-01', 'IMP-BALANCA-01'],
    description: 'Grades, plantadeiras, balancas e implementos menores',
  },
  BENFEITORIA: {
    codePrefix: 'BEN',
    label: 'Benfeitoria',
    icon: 'Building2',
    examples: ['BEN-SILO-01', 'BEN-CURRAL-01', 'BEN-GALPAO-01'],
    description: 'Silos, currais, galpoes e construcoes na propriedade',
  },
  TERRA: {
    codePrefix: 'TER',
    label: 'Terra',
    icon: 'Mountain',
    examples: ['TER-TALHAO-SOJA-01', 'TER-PASTO-01'],
    description: 'Talhoes, pastos e areas de terra',
  },
};

// ─── Icon resolver ───────────────────────────────────────────────────────────

function AssetIcon({ name, size = 24 }: { name: string; size?: number }) {
  switch (name) {
    case 'Tractor':
      return <Tractor size={size} aria-hidden="true" />;
    case 'Truck':
      return <Truck size={size} aria-hidden="true" />;
    case 'Wrench':
      return <Wrench size={size} aria-hidden="true" />;
    case 'Building2':
      return <Building2 size={size} aria-hidden="true" />;
    case 'Mountain':
      return <Mountain size={size} aria-hidden="true" />;
    default:
      return <ChevronRight size={size} aria-hidden="true" />;
  }
}

// ─── Stepper dot ─────────────────────────────────────────────────────────────

function StepDot({ index, current }: { index: number; current: number }) {
  if (index < current) {
    return (
      <span className="cc-wizard__step-dot cc-wizard__step-dot--completed" aria-hidden="true">
        <Check size={8} />
      </span>
    );
  }
  if (index === current) {
    return <span className="cc-wizard__step-dot cc-wizard__step-dot--active" aria-hidden="true" />;
  }
  return <span className="cc-wizard__step-dot" aria-hidden="true" />;
}

// ─── Component ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

export default function CostCenterWizardModal({
  isOpen,
  onClose,
  onSuccess,
}: CostCenterWizardModalProps) {
  const { user } = useAuth();
  const { selectedFarm, farms, selectedFarmId } = useFarmContext();

  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<string>('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [farmId, setFarmId] = useState<string>(selectedFarmId ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = 'cc-wizard-title';

  // Sync farmId when context changes
  useEffect(() => {
    if (selectedFarmId) setFarmId(selectedFarmId);
  }, [selectedFarmId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setSelectedType('');
      setCode('');
      setName('');
      setDescription('');
      setFarmId(selectedFarmId ?? '');
      setIsSubmitting(false);
      setSubmitError(null);
      setCodeError(null);
      setNameError(null);
    }
  }, [isOpen, selectedFarmId]);

  // Focus trap and Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // When type selected, pre-fill code prefix
  const handleTypeSelect = useCallback((type: string) => {
    setSelectedType(type);
    const template = CC_TEMPLATES[type];
    if (template) {
      setCode(`${template.codePrefix}-`);
    }
  }, []);

  // Navigation
  const canAdvanceStep = useCallback(() => {
    if (step === 0) return selectedType !== '';
    if (step === 2) {
      return code.trim() !== '' && name.trim() !== '';
    }
    return true;
  }, [step, selectedType, code, name]);

  const handleNext = useCallback(() => {
    if (step === 2) {
      let valid = true;
      if (!code.trim()) {
        setCodeError('Codigo e obrigatorio');
        valid = false;
      } else {
        setCodeError(null);
      }
      if (!name.trim()) {
        setNameError('Nome e obrigatorio');
        valid = false;
      } else {
        setNameError(null);
      }
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, [step, code, name]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  // Submission
  const handleSubmit = useCallback(async () => {
    const effectiveFarmId = farmId || selectedFarmId;
    const orgId = user?.organizationId;
    if (!effectiveFarmId || !orgId) {
      setSubmitError('Fazenda nao selecionada. Selecione uma fazenda e tente novamente.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const token = localStorage.getItem('protos_access_token');
      const resp = await fetch(`/api/org/farms/${effectiveFarmId}/cost-centers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!resp.ok) {
        let message = 'Nao foi possivel salvar. Verifique sua conexao e tente novamente.';
        try {
          const data = (await resp.json()) as { message?: string };
          if (data.message) message = data.message;
        } catch {
          // ignore
        }
        setSubmitError(message);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setSubmitError('Nao foi possivel salvar. Verifique sua conexao e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }, [farmId, selectedFarmId, user, code, name, description, onSuccess, onClose]);

  if (!isOpen) return null;

  const template = selectedType ? CC_TEMPLATES[selectedType] : null;
  const effectiveFarmName =
    selectedFarm?.name ??
    farms.find((f) => f.id === farmId)?.name ??
    'Nenhuma fazenda selecionada';

  const stepTitles = ['Tipo de Ativo', 'Sugestao de Codigo', 'Configuracao', 'Confirmacao'];

  return (
    <div className="cc-wizard__overlay" role="presentation">
      <div
        ref={modalRef}
        className="cc-wizard__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="cc-wizard__header">
          <div className="cc-wizard__header-top">
            <h2 id={titleId} className="cc-wizard__title">
              Novo Centro de Custo
            </h2>
            <button
              type="button"
              className="cc-wizard__close-btn"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="cc-wizard__stepper" aria-label="Etapas do assistente">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <StepDot key={i} index={i} current={step} />
            ))}
          </div>
          <p className="cc-wizard__step-label">
            Etapa {step + 1} de {TOTAL_STEPS}: {stepTitles[step]}
          </p>
        </div>

        {/* Body */}
        <div className="cc-wizard__body">
          {/* Step 1 — Tipo de Ativo */}
          <div className={`cc-wizard__step${step === 0 ? ' cc-wizard__step--active' : ''}`}>
            <p className="cc-wizard__step-description">
              Selecione o tipo de ativo para o centro de custo:
            </p>
            <div className="cc-wizard__radio-grid" role="radiogroup" aria-label="Tipo de ativo">
              {Object.entries(CC_TEMPLATES).map(([key, tmpl]) => (
                <label
                  key={key}
                  className={`cc-wizard__radio-card${selectedType === key ? ' cc-wizard__radio-card--selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="asset-type"
                    value={key}
                    checked={selectedType === key}
                    onChange={() => handleTypeSelect(key)}
                    className="cc-wizard__radio-hidden"
                  />
                  <AssetIcon name={tmpl.icon} size={24} />
                  <span className="cc-wizard__radio-label">{tmpl.label}</span>
                  <span className="cc-wizard__radio-desc">{tmpl.description}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Step 2 — Sugestao de Codigo */}
          <div className={`cc-wizard__step${step === 1 ? ' cc-wizard__step--active' : ''}`}>
            {template && (
              <>
                <p className="cc-wizard__step-description">Sugestao baseada no tipo selecionado</p>
                <div className="cc-wizard__code-preview">
                  <span className="cc-wizard__code-badge">{template.codePrefix}</span>
                </div>
                <div className="cc-wizard__examples">
                  <p className="cc-wizard__examples-label">Exemplos:</p>
                  <ul className="cc-wizard__examples-list">
                    {template.examples.map((ex) => (
                      <li key={ex} className="cc-wizard__example-item">
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Step 3 — Configuracao */}
          <div className={`cc-wizard__step${step === 2 ? ' cc-wizard__step--active' : ''}`}>
            <div className="cc-wizard__form-group">
              <label htmlFor="cc-code" className="cc-wizard__label">
                Codigo <span aria-hidden="true">*</span>
              </label>
              <input
                id="cc-code"
                type="text"
                className={`cc-wizard__input${codeError ? ' cc-wizard__input--error' : ''}`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onBlur={() => {
                  if (!code.trim()) setCodeError('Codigo e obrigatorio');
                  else setCodeError(null);
                }}
                aria-required="true"
                aria-describedby={codeError ? 'cc-code-error' : undefined}
              />
              {codeError && (
                <span id="cc-code-error" className="cc-wizard__field-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {codeError}
                </span>
              )}
            </div>

            <div className="cc-wizard__form-group">
              <label htmlFor="cc-name" className="cc-wizard__label">
                Nome <span aria-hidden="true">*</span>
              </label>
              <input
                id="cc-name"
                type="text"
                className={`cc-wizard__input${nameError ? ' cc-wizard__input--error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (!name.trim()) setNameError('Nome e obrigatorio');
                  else setNameError(null);
                }}
                aria-required="true"
                aria-describedby={nameError ? 'cc-name-error' : undefined}
              />
              {nameError && (
                <span id="cc-name-error" className="cc-wizard__field-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {nameError}
                </span>
              )}
            </div>

            <div className="cc-wizard__form-group">
              <label htmlFor="cc-description" className="cc-wizard__label">
                Descricao
              </label>
              <textarea
                id="cc-description"
                className="cc-wizard__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="cc-wizard__form-group">
              <label htmlFor="cc-farm" className="cc-wizard__label">
                Fazenda
              </label>
              {selectedFarm ? (
                <input
                  id="cc-farm"
                  type="text"
                  className="cc-wizard__input"
                  value={selectedFarm.name}
                  readOnly
                  aria-readonly="true"
                />
              ) : (
                <select
                  id="cc-farm"
                  className="cc-wizard__select"
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione uma fazenda</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Step 4 — Confirmacao */}
          <div className={`cc-wizard__step${step === 3 ? ' cc-wizard__step--active' : ''}`}>
            <p className="cc-wizard__step-description">
              Revise as informacoes antes de criar o centro de custo:
            </p>
            <dl className="cc-wizard__summary">
              <dt>TIPO</dt>
              <dd>{template?.label ?? '—'}</dd>
              <dt>CODIGO</dt>
              <dd>{code || '—'}</dd>
              <dt>NOME</dt>
              <dd>{name || '—'}</dd>
              <dt>DESCRICAO</dt>
              <dd>{description || '—'}</dd>
              <dt>FAZENDA</dt>
              <dd>{effectiveFarmName}</dd>
            </dl>

            {submitError && (
              <div className="cc-wizard__error-banner" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="cc-wizard__footer">
          <button type="button" className="cc-wizard__btn cc-wizard__btn--ghost" onClick={onClose}>
            Cancelar
          </button>

          <div className="cc-wizard__footer-nav">
            {step > 0 && (
              <button
                type="button"
                className="cc-wizard__btn cc-wizard__btn--secondary"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Voltar
              </button>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                className="cc-wizard__btn cc-wizard__btn--primary"
                onClick={handleNext}
                disabled={!canAdvanceStep()}
              >
                Proximo
              </button>
            ) : (
              <button
                type="button"
                className="cc-wizard__btn cc-wizard__btn--primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Salvando...' : 'Criar Centro de Custo'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
