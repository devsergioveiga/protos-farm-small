import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { Employee, EmployeeStatus } from '@/types/employee';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface EmployeeStatusModalProps {
  isOpen: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess: () => void;
}

type ValidTransition = {
  label: string;
  to: EmployeeStatus;
  confirmVariant: 'danger' | 'warning';
  confirmTitle: string;
  confirmMessage: string;
  requiresName?: boolean;
  requiresReason?: boolean;
  requiresReturnDate?: boolean;
};

const TRANSITIONS: Record<EmployeeStatus, ValidTransition[]> = {
  ATIVO: [
    {
      label: 'Afastar',
      to: 'AFASTADO',
      confirmVariant: 'warning',
      confirmTitle: 'Afastar colaborador',
      confirmMessage: 'Informe o motivo e a data prevista de retorno.',
      requiresReason: true,
      requiresReturnDate: true,
    },
    {
      label: 'Colocar em férias',
      to: 'FERIAS',
      confirmVariant: 'warning',
      confirmTitle: 'Colocar em férias',
      confirmMessage: 'Informe o período de gozo de férias.',
      requiresReason: true,
      requiresReturnDate: true,
    },
    {
      label: 'Desligar',
      to: 'DESLIGADO',
      confirmVariant: 'danger',
      confirmTitle: 'Desligar colaborador',
      confirmMessage:
        'Esta ação é irreversível. O colaborador será marcado como DESLIGADO e não poderá ser reativado. Confirme digitando o nome completo.',
      requiresName: true,
      requiresReason: true,
    },
  ],
  AFASTADO: [
    {
      label: 'Registrar retorno',
      to: 'ATIVO',
      confirmVariant: 'warning',
      confirmTitle: 'Registrar retorno',
      confirmMessage: 'Confirma o retorno do colaborador?',
      requiresReason: false,
    },
    {
      label: 'Desligar',
      to: 'DESLIGADO',
      confirmVariant: 'danger',
      confirmTitle: 'Desligar colaborador',
      confirmMessage:
        'Esta ação é irreversível. O colaborador será marcado como DESLIGADO e não poderá ser reativado. Confirme digitando o nome completo.',
      requiresName: true,
      requiresReason: true,
    },
  ],
  FERIAS: [
    {
      label: 'Registrar retorno',
      to: 'ATIVO',
      confirmVariant: 'warning',
      confirmTitle: 'Registrar retorno',
      confirmMessage: 'Confirma que o colaborador retornou das férias?',
      requiresReason: false,
    },
  ],
  DESLIGADO: [],
};

export default function EmployeeStatusModal({
  isOpen,
  employee,
  onClose,
  onSuccess,
}: EmployeeStatusModalProps) {
  const { user } = useAuth();
  const [selectedTransition, setSelectedTransition] = useState<ValidTransition | null>(null);
  const [reason, setReason] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [nameConfirm, setNameConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTransition(null);
      setReason('');
      setReturnDate('');
      setNameConfirm('');
      setError(null);
      setTimeout(() => firstFocusRef.current?.focus(), 100);
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

  if (!isOpen || !employee) return null;

  const transitions = TRANSITIONS[employee.status] ?? [];

  const handleProceed = () => {
    if (!selectedTransition) return;
    setError(null);
    if (selectedTransition.requiresReason && !reason.trim()) {
      setError('O motivo é obrigatório.');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!selectedTransition || !employee) return;
    if (selectedTransition.requiresName && nameConfirm.trim() !== employee.name.trim()) {
      setError('O nome digitado não corresponde ao nome do colaborador.');
      setShowConfirm(false);
      return;
    }

    const orgId = user?.organizationId;
    if (!orgId) return;

    setIsLoading(true);
    setError(null);
    try {
      await api.patch(`/org/${orgId}/employees/${employee.id}/status`, {
        status: selectedTransition.to,
        reason: reason || undefined,
        returnDate: returnDate || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar. Verifique sua conexão e tente novamente.';
      setError(message);
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <div
        className="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-modal-title"
      >
        <div
          className="modal"
          style={{
            background: 'var(--color-neutral-0)',
            borderRadius: '12px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: 'var(--shadow-xl, 0 8px 32px rgba(0,0,0,0.18))',
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
              id="status-modal-title"
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--color-neutral-800)',
                margin: 0,
              }}
            >
              Mudar status — {employee.name}
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

          {transitions.length === 0 ? (
            <p
              style={{
                color: 'var(--color-neutral-500)',
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
              }}
            >
              Nenhuma transição disponível para o status atual ({employee.status}).
            </p>
          ) : (
            <>
              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
                <legend
                  style={{
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--color-neutral-700)',
                    marginBottom: '8px',
                  }}
                >
                  Selecionar nova situação *
                </legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {transitions.map((t) => (
                    <label
                      key={t.to}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        border: `2px solid ${selectedTransition?.to === t.to ? 'var(--color-primary-500)' : 'var(--color-neutral-200)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontFamily: "'Source Sans 3', system-ui, sans-serif",
                        fontSize: '0.9375rem',
                        color: 'var(--color-neutral-700)',
                        background:
                          selectedTransition?.to === t.to
                            ? 'var(--color-primary-50)'
                            : 'var(--color-neutral-0)',
                      }}
                    >
                      <input
                        type="radio"
                        name="transition"
                        value={t.to}
                        checked={selectedTransition?.to === t.to}
                        onChange={() => setSelectedTransition(t)}
                        ref={t === transitions[0] ? (firstFocusRef as React.RefObject<HTMLInputElement>) : undefined}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {selectedTransition?.requiresReason && (
                <div style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="status-reason"
                    style={{
                      display: 'block',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      color: 'var(--color-neutral-700)',
                      marginBottom: '4px',
                    }}
                  >
                    Motivo *
                  </label>
                  <textarea
                    id="status-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.9375rem',
                      border: '1px solid var(--color-neutral-300)',
                      borderRadius: '8px',
                      color: 'var(--color-neutral-700)',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                    placeholder="Descreva o motivo..."
                    aria-required="true"
                  />
                </div>
              )}

              {selectedTransition?.requiresReturnDate && (
                <div style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="return-date"
                    style={{
                      display: 'block',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      color: 'var(--color-neutral-700)',
                      marginBottom: '4px',
                    }}
                  >
                    Data prevista de retorno
                  </label>
                  <input
                    type="date"
                    id="return-date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.9375rem',
                      border: '1px solid var(--color-neutral-300)',
                      borderRadius: '8px',
                      color: 'var(--color-neutral-700)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {selectedTransition?.requiresName && (
                <div style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="name-confirm"
                    style={{
                      display: 'block',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      color: 'var(--color-error-600)',
                      marginBottom: '4px',
                    }}
                  >
                    Digite o nome completo para confirmar *
                  </label>
                  <input
                    type="text"
                    id="name-confirm"
                    value={nameConfirm}
                    onChange={(e) => setNameConfirm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.9375rem',
                      border: '1px solid var(--color-error-300, #EF9A9A)',
                      borderRadius: '8px',
                      color: 'var(--color-neutral-700)',
                      boxSizing: 'border-box',
                    }}
                    placeholder={employee.name}
                    aria-required="true"
                    aria-describedby="name-confirm-help"
                  />
                  <p
                    id="name-confirm-help"
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-neutral-500)',
                      marginTop: '4px',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    }}
                  >
                    Digite exatamente: <strong>{employee.name}</strong>
                  </p>
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
                  <AlertTriangle size={16} aria-hidden="true" />
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
                  type="button"
                  onClick={handleProceed}
                  disabled={!selectedTransition || isLoading}
                  style={{
                    padding: '10px 20px',
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: selectedTransition?.to === 'DESLIGADO'
                      ? 'var(--color-error-500)'
                      : 'var(--color-primary-600)',
                    color: '#fff',
                    cursor: selectedTransition ? 'pointer' : 'not-allowed',
                    opacity: !selectedTransition ? 0.5 : 1,
                    minHeight: '48px',
                  }}
                >
                  {isLoading ? 'Salvando...' : 'Continuar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showConfirm && selectedTransition && (
        <ConfirmModal
          isOpen={showConfirm}
          title={selectedTransition.confirmTitle}
          message={selectedTransition.confirmMessage}
          confirmLabel={selectedTransition.to === 'DESLIGADO' ? 'Desligar colaborador' : 'Confirmar'}
          variant={selectedTransition.confirmVariant}
          isLoading={isLoading}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
