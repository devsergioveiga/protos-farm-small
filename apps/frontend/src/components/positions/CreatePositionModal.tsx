import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

interface CreatePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ADDITIONAL_TYPES = ['INSALUBRIDADE', 'PERICULOSIDADE', 'NOTURNO'];

export default function CreatePositionModal({
  isOpen,
  onClose,
  onSuccess,
}: CreatePositionModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [cbo, setCbo] = useState('');
  const [cboError, setCboError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [additionalTypes, setAdditionalTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCbo('');
      setCboError(null);
      setDescription('');
      setAdditionalTypes([]);
      setError(null);
      setTimeout(() => nameRef.current?.focus(), 100);
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

  const validateCbo = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (value && digits.length !== 6) {
      setCboError('CBO deve ter 6 dígitos numéricos.');
    } else {
      setCboError(null);
    }
  };

  const toggleAdditional = (type: string) => {
    setAdditionalTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = user?.organizationId;
    if (!orgId || !name.trim()) {
      setError('Nome do cargo é obrigatório.');
      return;
    }
    const cboDigits = cbo.replace(/\D/g, '');
    if (cbo && cboDigits.length !== 6) {
      setCboError('CBO deve ter 6 dígitos numéricos.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.post(`/org/${orgId}/positions`, {
        name: name.trim(),
        cbo: cboDigits || undefined,
        description: description.trim() || undefined,
        additionalTypes,
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
      aria-labelledby="create-position-title"
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
            id="create-position-title"
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '1.125rem',
              color: 'var(--color-neutral-800)',
              margin: 0,
            }}
          >
            Cadastrar cargo
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
              <label htmlFor="position-name" style={labelStyle}>
                Nome do cargo *
              </label>
              <input
                ref={nameRef}
                type="text"
                id="position-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                required
                aria-required="true"
                placeholder="Ex: Operador de máquinas"
              />
            </div>

            <div>
              <label htmlFor="position-cbo" style={labelStyle}>
                CBO (Classificação Brasileira de Ocupações)
              </label>
              <input
                type="text"
                id="position-cbo"
                value={cbo}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCbo(val);
                }}
                onBlur={() => validateCbo(cbo)}
                style={{
                  ...inputStyle,
                  fontFamily: "'JetBrains Mono', monospace",
                  borderColor: cboError ? 'var(--color-error-500)' : undefined,
                }}
                placeholder="000000"
                maxLength={6}
                aria-describedby={cboError ? 'cbo-error' : undefined}
              />
              {cboError && (
                <p
                  id="cbo-error"
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
                  {cboError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="position-description" style={labelStyle}>
                Descrição
              </label>
              <textarea
                id="position-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  ...inputStyle,
                  minHeight: 'auto',
                  resize: 'vertical',
                  height: 'auto',
                }}
                placeholder="Descreva as responsabilidades do cargo..."
              />
            </div>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={labelStyle}>Adicionais</legend>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {ADDITIONAL_TYPES.map((type) => (
                  <label
                    key={type}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      border: `2px solid ${additionalTypes.includes(type) ? 'var(--color-primary-500)' : 'var(--color-neutral-200)'}`,
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: additionalTypes.includes(type)
                        ? 'var(--color-primary-700)'
                        : 'var(--color-neutral-600)',
                      background: additionalTypes.includes(type)
                        ? 'var(--color-primary-50)'
                        : 'var(--color-neutral-0)',
                      minHeight: '40px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={additionalTypes.includes(type)}
                      onChange={() => toggleAdditional(type)}
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                    />
                    {type}
                  </label>
                ))}
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
                {isLoading ? 'Salvando...' : 'Cadastrar cargo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
