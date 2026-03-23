import { useEffect, useState } from 'react';
import {
  X,
  Check,
  Tractor,
  Truck,
  Wrench,
  Building2,
  Mountain,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { useFarm } from '@/stores/FarmContext';
import './CostCenterWizardModal.css';

// ─── Static template data ──────────────────────────────────────────────────

interface CcTemplate {
  codePrefix: string;
  label: string;
  Icon: LucideIcon;
  examples: string[];
  description: string;
}

const CC_TEMPLATES: Record<string, CcTemplate> = {
  MAQUINA: {
    codePrefix: 'MAQ',
    label: 'Maquina',
    Icon: Tractor,
    examples: ['MAQ-TRATOR-01', 'MAQ-COLHEITADEIRA-01', 'MAQ-PULVERIZADOR-01'],
    description: 'Tratores, colheitadeiras, pulverizadores e outras maquinas agricolas',
  },
  VEICULO: {
    codePrefix: 'VEI',
    label: 'Veiculo',
    Icon: Truck,
    examples: ['VEI-CAMINHONETE-01', 'VEI-CAMINHAO-01'],
    description: 'Caminhonetes, caminhoes e veiculos utilitarios',
  },
  IMPLEMENTO: {
    codePrefix: 'IMP',
    label: 'Implemento',
    Icon: Wrench,
    examples: ['IMP-GRADE-01', 'IMP-PLANTADEIRA-01', 'IMP-BALANCA-01'],
    description: 'Grades, plantadeiras, balancas e implementos menores',
  },
  BENFEITORIA: {
    codePrefix: 'BEN',
    label: 'Benfeitoria',
    Icon: Building2,
    examples: ['BEN-SILO-01', 'BEN-CURRAL-01', 'BEN-GALPAO-01'],
    description: 'Silos, currais, galpoes e construcoes na propriedade',
  },
  TERRA: {
    codePrefix: 'TER',
    label: 'Terra',
    Icon: Mountain,
    examples: ['TER-TALHAO-SOJA-01', 'TER-PASTO-01'],
    description: 'Talhoes, pastos e areas de terra',
  },
};

const TEMPLATE_KEYS = Object.keys(CC_TEMPLATES) as Array<keyof typeof CC_TEMPLATES>;

// ─── Props ─────────────────────────────────────────────────────────────────

interface CostCenterWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Main component ────────────────────────────────────────────────────────

export default function CostCenterWizardModal({
  isOpen,
  onClose,
  onSuccess,
}: CostCenterWizardModalProps) {
  const { user } = useAuth();
  const { selectedFarm, farms } = useFarm();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [farmId, setFarmId] = useState<string>('');
  const [codeError, setCodeError] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasInput, setHasInput] = useState(false);

  const selectedFarmId = selectedFarm?.id ?? null;

  // Reset on open/close
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedType(null);
    setCode('');
    setName('');
    setDescription('');
    setCodeError('');
    setNameError('');
    setIsSubmitting(false);
    setSubmitError(null);
    setHasInput(false);
    setFarmId(selectedFarmId ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedFarmId]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hasInput) {
          // In step 3 with input, confirm before closing
          if (window.confirm('Deseja fechar sem salvar?')) onClose();
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, hasInput, onClose]);

  if (!isOpen) return null;

  const template = selectedType ? CC_TEMPLATES[selectedType] : null;
  const orgId = user?.organizationId ?? '';
  const activeFarmId = farmId || (selectedFarm?.id ?? '');
  const activeFarmName =
    (selectedFarm?.id === activeFarmId ? selectedFarm?.name : farms.find((f) => f.id === activeFarmId)?.name) ?? '';

  // ─── Step advancement ──────────────────────────────────────────────────

  function goNext() {
    if (step === 1) {
      if (!selectedType) return;
      setStep(2);
    } else if (step === 2) {
      // Pre-fill code when entering step 3
      if (!code && template) {
        setCode(`${template.codePrefix}-`);
      }
      setStep(3);
    } else if (step === 3) {
      let valid = true;
      if (!code.trim()) {
        setCodeError('Codigo e obrigatorio');
        valid = false;
      } else {
        setCodeError('');
      }
      if (!name.trim()) {
        setNameError('Nome e obrigatorio');
        valid = false;
      } else {
        setNameError('');
      }
      if (!valid) return;
      setStep(4);
    }
  }

  function goBack() {
    if (step > 1) {
      setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
    }
  }

  function canGoNext(): boolean {
    if (step === 1) return selectedType !== null;
    if (step === 3) return code.trim().length > 0 && name.trim().length > 0;
    return true;
  }

  // ─── Submit ────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!orgId || !activeFarmId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/farms/${activeFarmId}/cost-centers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error('Resposta nao ok');
      }
      onSuccess();
      onClose();
    } catch {
      setSubmitError('Nao foi possivel criar o centro de custo. Verifique sua conexao e tente novamente.');
      setIsSubmitting(false);
    }
  }

  // ─── Stepper dot helper ────────────────────────────────────────────────

  function dotClass(dotStep: number): string {
    if (dotStep < step) return 'cc-wizard__step-dot cc-wizard__step-dot--completed';
    if (dotStep === step) return 'cc-wizard__step-dot cc-wizard__step-dot--active';
    return 'cc-wizard__step-dot cc-wizard__step-dot--inactive';
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className="cc-wizard__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cc-wizard-title"
    >
      <div className="cc-wizard__modal">
        {/* Header */}
        <header className="cc-wizard__header">
          <div className="cc-wizard__header-row">
            <h2 className="cc-wizard__title" id="cc-wizard-title">
              Novo Centro de Custo
            </h2>
            <button
              type="button"
              className="cc-wizard__close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {/* Stepper */}
          <div
            className="cc-wizard__stepper"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={4}
            aria-valuenow={step}
            aria-label={`Passo ${step} de 4`}
          >
            {[1, 2, 3, 4].map((s) => (
              <span key={s} className={dotClass(s)} aria-hidden="true">
                {s < step && <Check size={8} aria-hidden="true" />}
              </span>
            ))}
          </div>
        </header>

        {/* Body */}
        <div className="cc-wizard__body">

          {/* ─── Step 1: Tipo de Ativo ─────────────────────────── */}
          <div data-step="1" style={{ display: step === 1 ? 'block' : 'none' }}>
            <p className="cc-wizard__step-label">Passo 1 de 4 — Tipo de Ativo</p>
            <div
              className="cc-wizard__radio-grid"
              role="radiogroup"
              aria-label="Tipo de ativo"
            >
              {TEMPLATE_KEYS.map((key) => {
                const t = CC_TEMPLATES[key];
                const isSelected = selectedType === key;
                return (
                  <label
                    key={key}
                    className={`cc-wizard__radio-card${isSelected ? ' cc-wizard__radio-card--selected' : ''}`}
                    aria-label={t.label}
                  >
                    <input
                      type="radio"
                      name="asset-type"
                      value={key}
                      checked={isSelected}
                      onChange={() => setSelectedType(key)}
                    />
                    <div className="cc-wizard__radio-card-icon">
                      <t.Icon size={24} aria-hidden="true" />
                    </div>
                    <p className="cc-wizard__radio-card-title">{t.label}</p>
                    <p className="cc-wizard__radio-card-desc">{t.description}</p>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ─── Step 2: Sugestao de Codigo ───────────────────── */}
          <div data-step="2" style={{ display: step === 2 ? 'block' : 'none' }}>
            <p className="cc-wizard__step-label">Passo 2 de 4 — Sugestao de Codigo</p>
            {template && (
              <>
                <p className="cc-wizard__suggestion-subtitle">
                  Sugestao baseada no tipo selecionado
                </p>
                <div className="cc-wizard__code-badge-wrap">
                  <span className="cc-wizard__code-badge">{template.codePrefix}</span>
                </div>
                <p className="cc-wizard__examples-label">Exemplos:</p>
                <ul className="cc-wizard__examples-list">
                  {template.examples.map((ex) => (
                    <li key={ex} className="cc-wizard__example-item">
                      {ex}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* ─── Step 3: Configuracao ─────────────────────────── */}
          <div data-step="3" style={{ display: step === 3 ? 'block' : 'none' }}>
            <p className="cc-wizard__step-label">Passo 3 de 4 — Configuracao</p>
            <div className="cc-wizard__form">

              {/* Codigo */}
              <div className="cc-wizard__field">
                <label htmlFor="cc-code" className="cc-wizard__label">
                  Codigo <span aria-hidden="true">*</span>
                </label>
                <input
                  id="cc-code"
                  type="text"
                  className={`cc-wizard__input${codeError ? ' cc-wizard__input--error' : ''}`}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setHasInput(true);
                    if (e.target.value.trim()) setCodeError('');
                  }}
                  onBlur={() => {
                    if (!code.trim()) setCodeError('Codigo e obrigatorio');
                  }}
                  aria-required="true"
                  aria-describedby={codeError ? 'cc-code-error' : undefined}
                  placeholder={template ? `${template.codePrefix}-NOME-01` : 'Ex: MAQ-TRATOR-01'}
                />
                {codeError && (
                  <span id="cc-code-error" className="cc-wizard__field-error" role="alert">
                    {codeError}
                  </span>
                )}
              </div>

              {/* Nome */}
              <div className="cc-wizard__field">
                <label htmlFor="cc-name" className="cc-wizard__label">
                  Nome <span aria-hidden="true">*</span>
                </label>
                <input
                  id="cc-name"
                  type="text"
                  className={`cc-wizard__input${nameError ? ' cc-wizard__input--error' : ''}`}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setHasInput(true);
                    if (e.target.value.trim()) setNameError('');
                  }}
                  onBlur={() => {
                    if (!name.trim()) setNameError('Nome e obrigatorio');
                  }}
                  aria-required="true"
                  aria-describedby={nameError ? 'cc-name-error' : undefined}
                  placeholder="Ex: Trator Valtra"
                />
                {nameError && (
                  <span id="cc-name-error" className="cc-wizard__field-error" role="alert">
                    {nameError}
                  </span>
                )}
              </div>

              {/* Descricao */}
              <div className="cc-wizard__field">
                <label htmlFor="cc-description" className="cc-wizard__label">
                  Descricao
                </label>
                <textarea
                  id="cc-description"
                  className="cc-wizard__textarea"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setHasInput(true);
                  }}
                  rows={3}
                  placeholder="Descricao opcional"
                />
              </div>

              {/* Fazenda */}
              <div className="cc-wizard__field">
                <label htmlFor="cc-farm" className="cc-wizard__label">
                  Fazenda
                </label>
                {selectedFarm ? (
                  <p className="cc-wizard__farm-readonly" id="cc-farm">
                    {selectedFarm.name}
                  </p>
                ) : (
                  <select
                    id="cc-farm"
                    className="cc-wizard__select"
                    value={farmId}
                    onChange={(e) => setFarmId(e.target.value)}
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
          </div>

          {/* ─── Step 4: Confirmacao ──────────────────────────── */}
          <div data-step="4" style={{ display: step === 4 ? 'block' : 'none' }}>
            <p className="cc-wizard__step-label">Passo 4 de 4 — Confirmacao</p>
            <dl className="cc-wizard__summary">
              <dt>TIPO</dt>
              <dd>{template?.label ?? '—'}</dd>
              <dt>CODIGO</dt>
              <dd className="cc-wizard__summary-mono">{code || '—'}</dd>
              <dt>NOME</dt>
              <dd>{name || '—'}</dd>
              <dt>DESCRICAO</dt>
              <dd>{description || '—'}</dd>
              <dt>FAZENDA</dt>
              <dd>{activeFarmName || '—'}</dd>
            </dl>

            {submitError && (
              <div className="cc-wizard__error" role="alert">
                {submitError}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="cc-wizard__footer">
          <div>
            {step > 1 && (
              <button
                type="button"
                className="cc-wizard__btn-back"
                onClick={goBack}
                disabled={isSubmitting}
              >
                Voltar
              </button>
            )}
          </div>
          <div className="cc-wizard__footer-right">
            <button
              type="button"
              className="cc-wizard__btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>

            {step < 4 && (
              <button
                type="button"
                className="cc-wizard__btn-primary"
                onClick={goNext}
                disabled={!canGoNext()}
              >
                Proximo
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                className="cc-wizard__btn-primary"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Criando...' : 'Criar Centro de Custo'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
