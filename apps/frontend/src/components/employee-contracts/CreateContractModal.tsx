import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import { usePositions } from '@/hooks/usePositions';
import { useWorkSchedules } from '@/hooks/useWorkSchedules';
import { CONTRACT_TYPE_LABELS } from '@/types/employee-contract';
import type { ContractType } from '@/types/employee-contract';

interface CreateContractModalProps {
  isOpen: boolean;
  employeeId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CONTRACT_TYPES: ContractType[] = [
  'CLT_INDETERMINATE',
  'CLT_DETERMINATE',
  'SEASONAL',
  'INTERMITTENT',
  'TRIAL',
  'APPRENTICE',
];

// Types that require an end date
const REQUIRES_END_DATE: ContractType[] = [
  'CLT_DETERMINATE',
  'SEASONAL',
  'TRIAL',
  'APPRENTICE',
];

export default function CreateContractModal({
  isOpen,
  employeeId,
  onClose,
  onSuccess,
}: CreateContractModalProps) {
  const { user } = useAuth();
  const { positions } = usePositions({ limit: 200 });
  const { workSchedules } = useWorkSchedules({ limit: 200 });

  const [contractType, setContractType] = useState<ContractType>('CLT_INDETERMINATE');
  const [positionId, setPositionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salary, setSalary] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('44');
  const [workScheduleId, setWorkScheduleId] = useState('');
  const [union, setUnion] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLSelectElement>(null);

  const requiresEndDate = REQUIRES_END_DATE.includes(contractType);

  useEffect(() => {
    if (isOpen) {
      setContractType('CLT_INDETERMINATE');
      setPositionId('');
      setStartDate('');
      setEndDate('');
      setSalary('');
      setWeeklyHours('44');
      setWorkScheduleId('');
      setUnion('');
      setNotes('');
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

  if (!isOpen || !employeeId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = user?.organizationId;
    if (!orgId) return;

    if (!startDate) {
      setError('Data de início é obrigatória.');
      return;
    }
    if (!salary) {
      setError('Salário é obrigatório.');
      return;
    }
    if (requiresEndDate && !endDate) {
      setError('Data de término é obrigatória para este tipo de contrato.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.post(`/org/${orgId}/employee-contracts`, {
        employeeId,
        positionId: positionId || undefined,
        workScheduleId: workScheduleId || undefined,
        contractType,
        startDate,
        endDate: endDate || undefined,
        salary: Number(salary),
        weeklyHours: Number(weeklyHours),
        union: union || undefined,
        notes: notes || undefined,
      });
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

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-contract-title"
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
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <h2
            id="create-contract-title"
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '1.125rem',
              color: 'var(--color-neutral-800)',
              margin: 0,
            }}
          >
            Novo contrato
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
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
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
                      border: `2px solid ${contractType === ct ? 'var(--color-primary-500)' : 'var(--color-neutral-200)'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.875rem',
                      color: 'var(--color-neutral-700)',
                      background:
                        contractType === ct ? 'var(--color-primary-50)' : 'var(--color-neutral-0)',
                    }}
                  >
                    <input
                      type="radio"
                      name="contractType"
                      value={ct}
                      checked={contractType === ct}
                      onChange={() => {
                        setContractType(ct);
                        if (!REQUIRES_END_DATE.includes(ct)) setEndDate('');
                      }}
                    />
                    {CONTRACT_TYPE_LABELS[ct]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="contract-position" style={labelStyle}>
                Cargo
              </label>
              <select
                ref={firstRef}
                id="contract-position"
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="contract-start" style={labelStyle}>
                  Data de início *
                </label>
                <input
                  type="date"
                  id="contract-start"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                  required
                  aria-required="true"
                />
              </div>
              {requiresEndDate && (
                <div>
                  <label htmlFor="contract-end" style={labelStyle}>
                    Data de término *
                  </label>
                  <input
                    type="date"
                    id="contract-end"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={inputStyle}
                    required
                    aria-required="true"
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="contract-salary" style={labelStyle}>
                  Salário (R$) *
                </label>
                <input
                  type="number"
                  id="contract-salary"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                  required
                  aria-required="true"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label htmlFor="contract-hours" style={labelStyle}>
                  Horas semanais
                </label>
                <input
                  type="number"
                  id="contract-hours"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(e.target.value)}
                  style={inputStyle}
                  min="1"
                  max="168"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contract-schedule" style={labelStyle}>
                Escala de trabalho
              </label>
              <select
                id="contract-schedule"
                value={workScheduleId}
                onChange={(e) => setWorkScheduleId(e.target.value)}
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

            <div>
              <label htmlFor="contract-union" style={labelStyle}>
                Sindicato
              </label>
              <input
                type="text"
                id="contract-union"
                value={union}
                onChange={(e) => setUnion(e.target.value)}
                style={inputStyle}
                placeholder="Nome do sindicato (opcional)"
              />
            </div>

            <div>
              <label htmlFor="contract-notes" style={labelStyle}>
                Observações
              </label>
              <textarea
                id="contract-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{
                  ...inputStyle,
                  minHeight: 'auto',
                  resize: 'vertical',
                  height: 'auto',
                }}
                placeholder="Observações sobre o contrato..."
              />
            </div>

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
                  color: 'var(--color-error-700, #B71C1C)',
                  fontFamily: "'Source Sans 3', system-ui, sans-serif",
                  fontSize: '0.875rem',
                }}
              >
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
              <button
                type="submit"
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
                {isLoading ? 'Salvando...' : 'Salvar contrato'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
