import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import { usePositions } from '@/hooks/usePositions';
import { useWorkSchedules } from '@/hooks/useWorkSchedules';
import { CONTRACT_TYPE_LABELS } from '@/types/employee-contract';
import type { ContractType } from '@/types/employee-contract';
import type { CreateEmployeeInput } from '@/types/employee';

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// CPF validation
function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(digits[10]);
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// PIS validation (simplified — sum mod 11)
function isValidPIS(pis: string): boolean {
  const digits = pis.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * weights[i];
  const remainder = sum % 11;
  const check = remainder < 2 ? 0 : 11 - remainder;
  return check === parseInt(digits[10]);
}

const STEPS = [
  { label: 'Dados Pessoais', number: 1 },
  { label: 'Contrato', number: 2 },
  { label: 'Banco e Saúde', number: 3 },
  { label: 'Revisão', number: 4 },
];

const CONTRACT_TYPES: ContractType[] = [
  'CLT_INDETERMINATE',
  'CLT_DETERMINATE',
  'SEASONAL',
  'INTERMITTENT',
  'TRIAL',
  'APPRENTICE',
];

type FormData = {
  // Step 1
  name: string;
  cpf: string;
  birthDate: string;
  sexo: string;
  pisPassep: string;
  rg: string;
  rgIssuer: string;
  rgUf: string;
  ctpsNumber: string;
  ctpsSeries: string;
  ctpsUf: string;
  // Step 2
  contractType: ContractType;
  admissionDate: string;
  positionId: string;
  salary: string;
  weeklyHours: string;
  workScheduleId: string;
  // Step 3
  bankCode: string;
  bankAgency: string;
  bankAccount: string;
  bankAccountType: string;
  bloodType: string;
};

const INITIAL_FORM: FormData = {
  name: '',
  cpf: '',
  birthDate: '',
  sexo: '',
  pisPassep: '',
  rg: '',
  rgIssuer: '',
  rgUf: '',
  ctpsNumber: '',
  ctpsSeries: '',
  ctpsUf: '',
  contractType: 'CLT_INDETERMINATE',
  admissionDate: '',
  positionId: '',
  salary: '',
  weeklyHours: '44',
  workScheduleId: '',
  bankCode: '',
  bankAgency: '',
  bankAccount: '',
  bankAccountType: '',
  bloodType: '',
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function CreateEmployeeModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateEmployeeModalProps) {
  const { user } = useAuth();
  const { positions } = usePositions({ limit: 200 });
  const { workSchedules } = useWorkSchedules({ limit: 200 });

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [cpfTouched, setCpfTouched] = useState(false);
  const [pisWarning, setPisWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setForm(INITIAL_FORM);
      setCpfError(null);
      setCpfTouched(false);
      setPisWarning(null);
      setError(null);
      setTimeout(() => firstRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const updateForm = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCpfBlur = () => {
    setCpfTouched(true);
    const digits = form.cpf.replace(/\D/g, '');
    if (!digits) {
      setCpfError('CPF é obrigatório.');
    } else if (!isValidCPF(digits)) {
      setCpfError('CPF inválido. Verifique os dígitos e tente novamente.');
    } else {
      setCpfError(null);
    }
  };

  const handlePisBlur = () => {
    const digits = form.pisPassep.replace(/\D/g, '');
    if (digits && !isValidPIS(digits)) {
      setPisWarning('PIS/PASEP parece inválido. Você pode salvar e corrigir depois.');
    } else {
      setPisWarning(null);
    }
  };

  const validateStep1 = (): boolean => {
    if (!form.name.trim()) {
      setError('Nome é obrigatório.');
      return false;
    }
    const digits = form.cpf.replace(/\D/g, '');
    if (!digits || !isValidCPF(digits)) {
      setCpfError('CPF inválido. Verifique os dígitos e tente novamente.');
      setCpfTouched(true);
      setError('Corrija o CPF antes de continuar.');
      return false;
    }
    if (!form.birthDate) {
      setError('Data de nascimento é obrigatória.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!form.admissionDate) {
      setError('Data de admissão é obrigatória.');
      return false;
    }
    if (!form.salary) {
      setError('Salário é obrigatório.');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    setError(null);
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    const orgId = user?.organizationId;
    if (!orgId) return;

    setIsLoading(true);
    setError(null);
    try {
      const payload: CreateEmployeeInput = {
        name: form.name,
        cpf: form.cpf.replace(/\D/g, ''),
        birthDate: form.birthDate,
        admissionDate: form.admissionDate,
        rg: form.rg || undefined,
        rgIssuer: form.rgIssuer || undefined,
        rgUf: form.rgUf || undefined,
        pisPassep: form.pisPassep || undefined,
        ctpsNumber: form.ctpsNumber || undefined,
        ctpsSeries: form.ctpsSeries || undefined,
        ctpsUf: form.ctpsUf || undefined,
        positionId: form.positionId || undefined,
        bankCode: form.bankCode || undefined,
        bankAgency: form.bankAgency || undefined,
        bankAccount: form.bankAccount || undefined,
        bankAccountType: form.bankAccountType as 'CORRENTE' | 'POUPANCA' | undefined,
        bloodType: form.bloodType || undefined,
      };

      await api.post(`/org/${orgId}/employees`, payload);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar. Verifique sua conexão e tente novamente.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontFamily: "'Source Sans 3', system-ui, sans-serif",
    fontSize: '0.9375rem',
    border: '1px solid var(--color-neutral-300)',
    borderRadius: '8px',
    color: 'var(--color-neutral-700)',
    background: 'var(--color-neutral-0)',
    boxSizing: 'border-box',
    minHeight: '48px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: "'Source Sans 3', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: '0.875rem',
    color: 'var(--color-neutral-700)',
    marginBottom: '4px',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  };

  const selectedPosition = positions.find((p) => p.id === form.positionId);
  const selectedSchedule = workSchedules.find((w) => w.id === form.workScheduleId);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-employee-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--color-neutral-0)',
          borderRadius: '12px',
          maxWidth: '640px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-neutral-200)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h2
              id="create-employee-title"
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: '1.25rem',
                color: 'var(--color-neutral-800)',
                margin: 0,
              }}
            >
              Cadastrar colaborador
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: 'var(--color-neutral-500)',
                borderRadius: '4px',
              }}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Stepper */}
          <nav aria-label="Etapas do cadastro">
            <ol
              style={{
                display: 'flex',
                gap: '4px',
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}
            >
              {STEPS.map((s, idx) => {
                const isActive = s.number === step;
                const isCompleted = s.number < step;
                return (
                  <li
                    key={s.number}
                    aria-current={isActive ? 'step' : undefined}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      position: 'relative',
                    }}
                  >
                    {idx > 0 && (
                      <div
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: '14px',
                          left: '-50%',
                          width: '100%',
                          height: '2px',
                          background: isCompleted
                            ? 'var(--color-primary-500)'
                            : 'var(--color-neutral-200)',
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                        background: isActive
                          ? 'var(--color-primary-600)'
                          : isCompleted
                            ? 'var(--color-primary-100, #C8E6C9)'
                            : 'var(--color-neutral-100)',
                        color: isActive
                          ? '#fff'
                          : isCompleted
                            ? 'var(--color-primary-700)'
                            : 'var(--color-neutral-500)',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      {s.number}
                    </div>
                    <span
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: isActive ? 700 : 400,
                        color: isActive ? 'var(--color-primary-700)' : 'var(--color-neutral-500)',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        {/* Body — scrollable */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Step 1 — Dados Pessoais */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="emp-name" style={labelStyle}>
                  Nome completo *
                </label>
                <input
                  ref={firstRef}
                  type="text"
                  id="emp-name"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  style={inputStyle}
                  required
                  aria-required="true"
                  placeholder="Nome completo do colaborador"
                />
              </div>

              <div>
                <label htmlFor="emp-cpf" style={labelStyle}>
                  CPF *
                </label>
                <input
                  type="text"
                  id="emp-cpf"
                  value={form.cpf}
                  onChange={(e) => updateForm('cpf', formatCPF(e.target.value))}
                  onBlur={handleCpfBlur}
                  style={{
                    ...inputStyle,
                    fontFamily: "'JetBrains Mono', monospace",
                    borderColor: cpfTouched && cpfError ? 'var(--color-error-500)' : undefined,
                  }}
                  required
                  aria-required="true"
                  aria-describedby={cpfError ? 'cpf-error' : undefined}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {cpfTouched && cpfError && (
                  <p
                    id="cpf-error"
                    role="alert"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '4px',
                      color: 'var(--color-error-600)',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.8125rem',
                    }}
                  >
                    <AlertCircle size={14} aria-hidden="true" />
                    {cpfError}
                  </p>
                )}
                {cpfTouched && !cpfError && form.cpf.replace(/\D/g, '').length === 11 && (
                  <p
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '4px',
                      color: 'var(--color-success-700, #1B5E20)',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.8125rem',
                    }}
                  >
                    <CheckCircle size={14} aria-hidden="true" />
                    CPF válido
                  </p>
                )}
              </div>

              <div style={gridStyle}>
                <div>
                  <label htmlFor="emp-birthdate" style={labelStyle}>
                    Data de nascimento *
                  </label>
                  <input
                    type="date"
                    id="emp-birthdate"
                    value={form.birthDate}
                    onChange={(e) => updateForm('birthDate', e.target.value)}
                    style={inputStyle}
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="emp-sexo" style={labelStyle}>
                    Sexo
                  </label>
                  <select
                    id="emp-sexo"
                    value={form.sexo}
                    onChange={(e) => updateForm('sexo', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Selecionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="emp-pis" style={labelStyle}>
                  PIS/PASEP
                </label>
                <input
                  type="text"
                  id="emp-pis"
                  value={form.pisPassep}
                  onChange={(e) => updateForm('pisPassep', e.target.value)}
                  onBlur={handlePisBlur}
                  style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                  placeholder="000.00000.00-0"
                  aria-describedby={pisWarning ? 'pis-warning' : undefined}
                />
                {pisWarning && (
                  <p
                    id="pis-warning"
                    role="alert"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '4px',
                      color: 'var(--color-warning-700, #E65100)',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.8125rem',
                    }}
                  >
                    <AlertTriangle size={14} aria-hidden="true" />
                    {pisWarning}
                  </p>
                )}
              </div>

              <div style={gridStyle}>
                <div>
                  <label htmlFor="emp-rg" style={labelStyle}>
                    RG
                  </label>
                  <input
                    type="text"
                    id="emp-rg"
                    value={form.rg}
                    onChange={(e) => updateForm('rg', e.target.value)}
                    style={inputStyle}
                    placeholder="Número do RG"
                  />
                </div>
                <div>
                  <label htmlFor="emp-rg-issuer" style={labelStyle}>
                    Órgão emissor
                  </label>
                  <input
                    type="text"
                    id="emp-rg-issuer"
                    value={form.rgIssuer}
                    onChange={(e) => updateForm('rgIssuer', e.target.value)}
                    style={inputStyle}
                    placeholder="Ex: SSP"
                  />
                </div>
              </div>

              <div style={gridStyle}>
                <div>
                  <label htmlFor="emp-ctps" style={labelStyle}>
                    Nº CTPS
                  </label>
                  <input
                    type="text"
                    id="emp-ctps"
                    value={form.ctpsNumber}
                    onChange={(e) => updateForm('ctpsNumber', e.target.value)}
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                    placeholder="Número da CTPS"
                  />
                </div>
                <div>
                  <label htmlFor="emp-ctps-series" style={labelStyle}>
                    Série CTPS
                  </label>
                  <input
                    type="text"
                    id="emp-ctps-series"
                    value={form.ctpsSeries}
                    onChange={(e) => updateForm('ctpsSeries', e.target.value)}
                    style={inputStyle}
                    placeholder="Série"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Contrato */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend style={labelStyle}>Tipo de contrato *</legend>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginTop: '8px',
                  }}
                >
                  {CONTRACT_TYPES.map((ct) => (
                    <label
                      key={ct}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        border: `2px solid ${form.contractType === ct ? 'var(--color-primary-500)' : 'var(--color-neutral-200)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.875rem',
                        color: 'var(--color-neutral-700)',
                        background:
                          form.contractType === ct
                            ? 'var(--color-primary-50)'
                            : 'var(--color-neutral-0)',
                      }}
                    >
                      <input
                        type="radio"
                        name="contractType"
                        value={ct}
                        checked={form.contractType === ct}
                        onChange={() => updateForm('contractType', ct)}
                      />
                      {CONTRACT_TYPE_LABELS[ct]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div style={gridStyle}>
                <div>
                  <label htmlFor="emp-admission" style={labelStyle}>
                    Data de admissão *
                  </label>
                  <input
                    type="date"
                    id="emp-admission"
                    value={form.admissionDate}
                    onChange={(e) => updateForm('admissionDate', e.target.value)}
                    style={inputStyle}
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="emp-salary" style={labelStyle}>
                    Salário (R$) *
                  </label>
                  <input
                    type="number"
                    id="emp-salary"
                    value={form.salary}
                    onChange={(e) => updateForm('salary', e.target.value)}
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                    required
                    aria-required="true"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="emp-position" style={labelStyle}>
                  Cargo
                </label>
                <select
                  id="emp-position"
                  value={form.positionId}
                  onChange={(e) => updateForm('positionId', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Selecione um cargo</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={gridStyle}>
                <div>
                  <label htmlFor="emp-hours" style={labelStyle}>
                    Horas semanais
                  </label>
                  <input
                    type="number"
                    id="emp-hours"
                    value={form.weeklyHours}
                    onChange={(e) => updateForm('weeklyHours', e.target.value)}
                    style={inputStyle}
                    min="1"
                    max="168"
                  />
                </div>
                <div>
                  <label htmlFor="emp-schedule" style={labelStyle}>
                    Escala de trabalho
                  </label>
                  <select
                    id="emp-schedule"
                    value={form.workScheduleId}
                    onChange={(e) => updateForm('workScheduleId', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Selecione uma escala</option>
                    {workSchedules.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Banco e Saúde */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={gridStyle}>
                <div>
                  <label htmlFor="emp-bank-code" style={labelStyle}>
                    Código do banco
                  </label>
                  <input
                    type="text"
                    id="emp-bank-code"
                    value={form.bankCode}
                    onChange={(e) => updateForm('bankCode', e.target.value)}
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                    placeholder="Ex: 001"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label htmlFor="emp-bank-type" style={labelStyle}>
                    Tipo de conta
                  </label>
                  <select
                    id="emp-bank-type"
                    value={form.bankAccountType}
                    onChange={(e) => updateForm('bankAccountType', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Selecione</option>
                    <option value="CORRENTE">Corrente</option>
                    <option value="POUPANCA">Poupança</option>
                  </select>
                </div>
              </div>

              <div style={gridStyle}>
                <div>
                  <label htmlFor="emp-bank-agency" style={labelStyle}>
                    Agência
                  </label>
                  <input
                    type="text"
                    id="emp-bank-agency"
                    value={form.bankAgency}
                    onChange={(e) => updateForm('bankAgency', e.target.value)}
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                    placeholder="0000"
                  />
                </div>
                <div>
                  <label htmlFor="emp-bank-account" style={labelStyle}>
                    Conta
                  </label>
                  <input
                    type="text"
                    id="emp-bank-account"
                    value={form.bankAccount}
                    onChange={(e) => updateForm('bankAccount', e.target.value)}
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                    placeholder="00000-0"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="emp-blood-type" style={labelStyle}>
                  Tipo sanguíneo
                </label>
                <select
                  id="emp-blood-type"
                  value={form.bloodType}
                  onChange={(e) => updateForm('bloodType', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Selecione</option>
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 4 — Revisão */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'var(--color-neutral-50)',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <h3
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'var(--color-neutral-800)',
                    margin: '0 0 12px',
                  }}
                >
                  Dados Pessoais
                </h3>
                <dl
                  style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}
                >
                  <div>
                    <dt
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-neutral-500)',
                        textTransform: 'uppercase',
                      }}
                    >
                      NOME
                    </dt>
                    <dd
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.9375rem',
                        color: 'var(--color-neutral-700)',
                        margin: 0,
                      }}
                    >
                      {form.name || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-neutral-500)',
                        textTransform: 'uppercase',
                      }}
                    >
                      CPF
                    </dt>
                    <dd
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.9375rem',
                        color: 'var(--color-neutral-700)',
                        margin: 0,
                      }}
                    >
                      {form.cpf || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-neutral-500)',
                        textTransform: 'uppercase',
                      }}
                    >
                      NASCIMENTO
                    </dt>
                    <dd
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.9375rem',
                        color: 'var(--color-neutral-700)',
                        margin: 0,
                      }}
                    >
                      {form.birthDate ? new Date(form.birthDate).toLocaleDateString('pt-BR') : '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div
                style={{
                  background: 'var(--color-neutral-50)',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <h3
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'var(--color-neutral-800)',
                    margin: '0 0 12px',
                  }}
                >
                  Contrato
                </h3>
                <dl
                  style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}
                >
                  <div>
                    <dt
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-neutral-500)',
                        textTransform: 'uppercase',
                      }}
                    >
                      TIPO
                    </dt>
                    <dd
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.9375rem',
                        color: 'var(--color-neutral-700)',
                        margin: 0,
                      }}
                    >
                      {CONTRACT_TYPE_LABELS[form.contractType]}
                    </dd>
                  </div>
                  <div>
                    <dt
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-neutral-500)',
                        textTransform: 'uppercase',
                      }}
                    >
                      ADMISSÃO
                    </dt>
                    <dd
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.9375rem',
                        color: 'var(--color-neutral-700)',
                        margin: 0,
                      }}
                    >
                      {form.admissionDate
                        ? new Date(form.admissionDate).toLocaleDateString('pt-BR')
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-neutral-500)',
                        textTransform: 'uppercase',
                      }}
                    >
                      SALÁRIO
                    </dt>
                    <dd
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.9375rem',
                        color: 'var(--color-neutral-700)',
                        margin: 0,
                      }}
                    >
                      {form.salary
                        ? new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(Number(form.salary))
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-neutral-500)',
                        textTransform: 'uppercase',
                      }}
                    >
                      CARGO
                    </dt>
                    <dd
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.9375rem',
                        color: 'var(--color-neutral-700)',
                        margin: 0,
                      }}
                    >
                      {selectedPosition?.name || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-neutral-500)',
                        textTransform: 'uppercase',
                      }}
                    >
                      ESCALA
                    </dt>
                    <dd
                      style={{
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.9375rem',
                        color: 'var(--color-neutral-700)',
                        margin: 0,
                      }}
                    >
                      {selectedSchedule?.name || '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'var(--color-error-50, #FFEBEE)',
                border: '1px solid var(--color-error-200, #EF9A9A)',
                borderRadius: '8px',
                marginTop: '16px',
                color: 'var(--color-error-700, #B71C1C)',
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontSize: '0.875rem',
              }}
            >
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-neutral-200)',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={isLoading}
              style={{
                padding: '10px 20px',
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: '0.9375rem',
                border: '1px solid var(--color-neutral-300)',
                borderRadius: '8px',
                background: 'var(--color-neutral-0)',
                color: 'var(--color-neutral-700)',
                cursor: 'pointer',
                minHeight: '48px',
              }}
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: '10px 20px',
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '0.9375rem',
              border: '1px solid var(--color-neutral-300)',
              borderRadius: '8px',
              background: 'var(--color-neutral-0)',
              color: 'var(--color-neutral-700)',
              cursor: 'pointer',
              minHeight: '48px',
            }}
          >
            Cancelar
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNextStep}
              style={{
                padding: '10px 24px',
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: '0.9375rem',
                border: 'none',
                borderRadius: '8px',
                background: 'var(--color-primary-600)',
                color: '#fff',
                cursor: 'pointer',
                minHeight: '48px',
              }}
            >
              Próximo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isLoading}
              style={{
                padding: '10px 24px',
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: '0.9375rem',
                border: 'none',
                borderRadius: '8px',
                background: 'var(--color-primary-600)',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                minHeight: '48px',
              }}
            >
              {isLoading ? 'Salvando...' : 'Cadastrar colaborador'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
