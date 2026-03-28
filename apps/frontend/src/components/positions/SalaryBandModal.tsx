import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { Position, SalaryBandLevel } from '@/types/position';
import { SALARY_BAND_LABELS } from '@/types/position';

interface SalaryBandModalProps {
  isOpen: boolean;
  position: Position | null;
  onClose: () => void;
  onSuccess: () => void;
}

const LEVELS: SalaryBandLevel[] = ['JUNIOR', 'PLENO', 'SENIOR'];

type BandForm = {
  min: string;
  max: string;
};

export default function SalaryBandModal({
  isOpen,
  position,
  onClose,
  onSuccess,
}: SalaryBandModalProps) {
  const { user } = useAuth();
  const [bands, setBands] = useState<Record<SalaryBandLevel, BandForm>>({
    JUNIOR: { min: '', max: '' },
    PLENO: { min: '', max: '' },
    SENIOR: { min: '', max: '' },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && position) {
      const existing = position.salaryBands ?? [];
      const newBands: Record<SalaryBandLevel, BandForm> = {
        JUNIOR: { min: '', max: '' },
        PLENO: { min: '', max: '' },
        SENIOR: { min: '', max: '' },
      };
      for (const band of existing) {
        newBands[band.level] = {
          min: String(band.minSalary),
          max: String(band.maxSalary),
        };
      }
      setBands(newBands);
      setError(null);
      setValidationErrors([]);
    }
  }, [isOpen, position]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  const updateBand = (level: SalaryBandLevel, field: 'min' | 'max', value: string) => {
    setBands((prev) => ({
      ...prev,
      [level]: { ...prev[level], [field]: value },
    }));
  };

  const validate = (): string[] => {
    const errors: string[] = [];
    for (const level of LEVELS) {
      const min = Number(bands[level].min);
      const max = Number(bands[level].max);
      if (bands[level].min && bands[level].max && min > max) {
        errors.push(`${SALARY_BAND_LABELS[level]}: mínimo não pode ser maior que o máximo.`);
      }
    }
    const junMax = Number(bands.JUNIOR.max);
    const pleMin = Number(bands.PLENO.min);
    if (bands.JUNIOR.max && bands.PLENO.min && junMax > pleMin) {
      errors.push('O máximo de Junior deve ser menor ou igual ao mínimo de Pleno.');
    }
    const pleMax = Number(bands.PLENO.max);
    const senMin = Number(bands.SENIOR.min);
    if (bands.PLENO.max && bands.SENIOR.min && pleMax > senMin) {
      errors.push('O máximo de Pleno deve ser menor ou igual ao mínimo de Senior.');
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = user?.organizationId;
    if (!orgId) return;

    const errs = validate();
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);

    const payload: Array<{ level: SalaryBandLevel; minSalary: number; maxSalary: number }> = [];
    for (const level of LEVELS) {
      if (bands[level].min || bands[level].max) {
        payload.push({
          level,
          minSalary: Number(bands[level].min) || 0,
          maxSalary: Number(bands[level].max) || 0,
        });
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.put(`/org/${orgId}/positions/${position.id}/salary-bands`, payload);
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
    padding: '10px 12px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.875rem',
    border: '1px solid var(--color-neutral-300)',
    borderRadius: '6px',
    color: 'var(--color-neutral-700)',
    background: 'var(--color-neutral-0)',
    boxSizing: 'border-box',
    width: '100%',
    minHeight: '44px',
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="salary-band-modal-title"
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
          maxWidth: '520px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <h2
            id="salary-band-modal-title"
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '1.125rem',
              color: 'var(--color-neutral-800)',
              margin: 0,
            }}
          >
            Faixas salariais — {position.name}
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
        <p
          style={{
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: '0.875rem',
            color: 'var(--color-neutral-500)',
            marginBottom: '20px',
          }}
        >
          Defina os valores mínimo e máximo para cada nível.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th
                  scope="col"
                  style={{
                    textAlign: 'left',
                    padding: '8px 0',
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--color-neutral-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    width: '30%',
                  }}
                >
                  Nível
                </th>
                <th
                  scope="col"
                  style={{
                    textAlign: 'left',
                    padding: '8px 8px',
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--color-neutral-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    width: '35%',
                  }}
                >
                  Mínimo (R$)
                </th>
                <th
                  scope="col"
                  style={{
                    textAlign: 'left',
                    padding: '8px 8px',
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--color-neutral-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    width: '35%',
                  }}
                >
                  Máximo (R$)
                </th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((level) => (
                <tr key={level}>
                  <td
                    style={{
                      padding: '8px 0',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      color: 'var(--color-neutral-700)',
                    }}
                  >
                    {SALARY_BAND_LABELS[level]}
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <label
                      htmlFor={`band-${level}-min`}
                      style={{
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        overflow: 'hidden',
                        clip: 'rect(0,0,0,0)',
                      }}
                    >
                      Salário mínimo {SALARY_BAND_LABELS[level]}
                    </label>
                    <input
                      type="number"
                      id={`band-${level}-min`}
                      value={bands[level].min}
                      onChange={(e) => updateBand(level, 'min', e.target.value)}
                      style={inputStyle}
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                    />
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <label
                      htmlFor={`band-${level}-max`}
                      style={{
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        overflow: 'hidden',
                        clip: 'rect(0,0,0,0)',
                      }}
                    >
                      Salário máximo {SALARY_BAND_LABELS[level]}
                    </label>
                    <input
                      type="number"
                      id={`band-${level}-max`}
                      value={bands[level].max}
                      onChange={(e) => updateBand(level, 'max', e.target.value)}
                      style={inputStyle}
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {validationErrors.length > 0 && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                background: 'var(--color-error-50, #FFEBEE)',
                border: '1px solid var(--color-error-200, #EF9A9A)',
                borderRadius: '8px',
                marginBottom: '16px',
                color: 'var(--color-error-700, #B71C1C)',
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontSize: '0.875rem',
              }}
            >
              {validationErrors.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} aria-hidden="true" />
                  {e}
                </div>
              ))}
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
                marginBottom: '16px',
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
              {isLoading ? 'Salvando...' : 'Salvar faixas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
