import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

interface ContractAmendmentModalProps {
  isOpen: boolean;
  contractId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ContractAmendmentModal({
  isOpen,
  contractId,
  onClose,
  onSuccess,
}: ContractAmendmentModalProps) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [salaryFrom, setSalaryFrom] = useState('');
  const [salaryTo, setSalaryTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setEffectiveAt(new Date().toISOString().split('T')[0]);
      setSalaryFrom('');
      setSalaryTo('');
      setError(null);
      setTimeout(() => descRef.current?.focus(), 100);
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

  if (!isOpen || !contractId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = user?.organizationId;
    if (!orgId) return;
    if (!description.trim()) {
      setError('Descrição do aditivo é obrigatória.');
      return;
    }
    if (!effectiveAt) {
      setError('Data de vigência é obrigatória.');
      return;
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (salaryFrom || salaryTo) {
      changes['salary'] = {
        from: salaryFrom ? Number(salaryFrom) : null,
        to: salaryTo ? Number(salaryTo) : null,
      };
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.post(`/org/${orgId}/employee-contracts/${contractId}/amendments`, {
        description: description.trim(),
        effectiveAt,
        changes,
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
      aria-labelledby="amendment-modal-title"
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
          maxWidth: '480px',
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
            marginBottom: '20px',
          }}
        >
          <h2
            id="amendment-modal-title"
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '1.125rem',
              color: 'var(--color-neutral-800)',
              margin: 0,
            }}
          >
            Registrar aditivo contratual
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
            <div>
              <label htmlFor="amendment-description" style={labelStyle}>
                Descrição *
              </label>
              <input
                ref={descRef}
                type="text"
                id="amendment-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={inputStyle}
                required
                aria-required="true"
                placeholder="Ex: Reajuste salarial anual"
              />
            </div>

            <div>
              <label htmlFor="amendment-date" style={labelStyle}>
                Data de vigência *
              </label>
              <input
                type="date"
                id="amendment-date"
                value={effectiveAt}
                onChange={(e) => setEffectiveAt(e.target.value)}
                style={inputStyle}
                required
                aria-required="true"
              />
            </div>

            <fieldset
              style={{
                border: '1px solid var(--color-neutral-200)',
                borderRadius: '8px',
                padding: '16px',
                margin: 0,
              }}
            >
              <legend
                style={{
                  fontFamily: "'Source Sans 3', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: 'var(--color-neutral-600)',
                  padding: '0 4px',
                }}
              >
                Alteração salarial (opcional)
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="salary-from" style={labelStyle}>
                    Salário anterior (R$)
                  </label>
                  <input
                    type="number"
                    id="salary-from"
                    value={salaryFrom}
                    onChange={(e) => setSalaryFrom(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label htmlFor="salary-to" style={labelStyle}>
                    Novo salário (R$)
                  </label>
                  <input
                    type="number"
                    id="salary-to"
                    value={salaryTo}
                    onChange={(e) => setSalaryTo(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </fieldset>

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
                {isLoading ? 'Salvando...' : 'Registrar aditivo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
