import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import { useFarmContext } from '@/stores/FarmContext';
import { usePositions } from '@/hooks/usePositions';

interface EmployeeFarmAssocModalProps {
  isOpen: boolean;
  employeeId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EmployeeFarmAssocModal({
  isOpen,
  employeeId,
  onClose,
  onSuccess,
}: EmployeeFarmAssocModalProps) {
  const { user } = useAuth();
  const { farms } = useFarmContext();
  const { positions } = usePositions({ limit: 200 });

  const [farmId, setFarmId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFarmId('');
      setPositionId('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setError(null);
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
    if (!orgId || !farmId || !startDate) {
      setError('Fazenda e data de início são obrigatórios.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.post(`/org/${orgId}/employees/${employeeId}/farms`, {
        farmId,
        positionId: positionId || undefined,
        startDate,
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
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="farm-assoc-modal-title"
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
            id="farm-assoc-modal-title"
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '1.125rem',
              color: 'var(--color-neutral-800)',
              margin: 0,
            }}
          >
            Vincular a fazenda
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
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="farm-select" style={labelStyle}>
              Fazenda *
            </label>
            <select
              id="farm-select"
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              style={inputStyle}
              required
              aria-required="true"
            >
              <option value="">Selecione uma fazenda</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="position-select" style={labelStyle}>
              Cargo
            </label>
            <select
              id="position-select"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Selecione um cargo (opcional)</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="start-date" style={labelStyle}>
              Data de início *
            </label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
              required
              aria-required="true"
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
                padding: '10px 20px',
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
              {isLoading ? 'Salvando...' : 'Vincular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
