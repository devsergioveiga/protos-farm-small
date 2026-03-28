import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import { WORK_SCHEDULE_TYPE_LABELS, DAY_LABELS } from '@/types/work-schedule';
import type { WorkScheduleType } from '@/types/work-schedule';

interface CreateWorkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SCHEDULE_TYPES: WorkScheduleType[] = ['FIXED', 'SHIFT', 'CUSTOM'];

export default function CreateWorkScheduleModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateWorkScheduleModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<WorkScheduleType>('FIXED');
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState('60');
  const [isTemplate, setIsTemplate] = useState(false);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setType('FIXED');
      setWorkDays([1, 2, 3, 4, 5]);
      setStartTime('07:00');
      setEndTime('17:00');
      setBreakMinutes('60');
      setIsTemplate(false);
      setNotes('');
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

  const toggleDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = user?.organizationId;
    if (!orgId || !name.trim()) {
      setError('Nome da escala é obrigatório.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Horário de início e término são obrigatórios.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.post(`/org/${orgId}/work-schedules`, {
        name: name.trim(),
        type,
        workDays,
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes) || 0,
        isTemplate,
        notes: notes.trim() || undefined,
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
      aria-labelledby="create-schedule-title"
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
            id="create-schedule-title"
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '1.125rem',
              color: 'var(--color-neutral-800)',
              margin: 0,
            }}
          >
            Cadastrar escala
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
              <label htmlFor="schedule-name" style={labelStyle}>
                Nome da escala *
              </label>
              <input
                ref={nameRef}
                type="text"
                id="schedule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                required
                aria-required="true"
                placeholder="Ex: Turno Rural Padrão"
              />
            </div>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={labelStyle}>Tipo de escala *</legend>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {SCHEDULE_TYPES.map((t) => (
                  <label
                    key={t}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px',
                      border: `2px solid ${type === t ? 'var(--color-primary-500)' : 'var(--color-neutral-200)'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.875rem',
                      fontWeight: type === t ? 700 : 400,
                      color: type === t ? 'var(--color-primary-700)' : 'var(--color-neutral-600)',
                      background: type === t ? 'var(--color-primary-50)' : 'var(--color-neutral-0)',
                      textAlign: 'center',
                      minHeight: '48px',
                    }}
                  >
                    <input
                      type="radio"
                      name="scheduleType"
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                    />
                    {WORK_SCHEDULE_TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={labelStyle}>Dias de trabalho</legend>
              <div
                style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}
                role="group"
                aria-label="Selecione os dias de trabalho"
              >
                {DAY_LABELS.map((label, dayIndex) => (
                  <label
                    key={dayIndex}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '44px',
                      height: '44px',
                      border: `2px solid ${workDays.includes(dayIndex) ? 'var(--color-primary-500)' : 'var(--color-neutral-200)'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: workDays.includes(dayIndex)
                        ? 'var(--color-primary-700)'
                        : 'var(--color-neutral-500)',
                      background: workDays.includes(dayIndex)
                        ? 'var(--color-primary-50)'
                        : 'var(--color-neutral-0)',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={workDays.includes(dayIndex)}
                      onChange={() => toggleDay(dayIndex)}
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                      aria-label={label}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="schedule-start" style={labelStyle}>
                  Início *
                </label>
                <input
                  type="time"
                  id="schedule-start"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={inputStyle}
                  required
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="schedule-end" style={labelStyle}>
                  Término *
                </label>
                <input
                  type="time"
                  id="schedule-end"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={inputStyle}
                  required
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="schedule-break" style={labelStyle}>
                  Intervalo (min)
                </label>
                <input
                  type="number"
                  id="schedule-break"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  style={inputStyle}
                  min="0"
                  max="480"
                />
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontSize: '0.9375rem',
                color: 'var(--color-neutral-700)',
                minHeight: '48px',
              }}
            >
              <input
                type="checkbox"
                checked={isTemplate}
                onChange={(e) => setIsTemplate(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              Marcar como template
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-neutral-500)',
                  fontStyle: 'italic',
                }}
              >
                (disponível como modelo para outras escalas)
              </span>
            </label>

            <div>
              <label htmlFor="schedule-notes" style={labelStyle}>
                Observações
              </label>
              <textarea
                id="schedule-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{
                  ...inputStyle,
                  minHeight: 'auto',
                  resize: 'vertical',
                  height: 'auto',
                }}
                placeholder="Observações sobre a escala..."
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
                {isLoading ? 'Salvando...' : 'Cadastrar escala'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
