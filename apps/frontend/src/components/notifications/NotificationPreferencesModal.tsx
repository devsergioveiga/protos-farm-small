import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  useNotificationPreferences,
  NOTIFICATION_EVENT_GROUPS,
  EVENT_TYPE_LABELS,
  ROLE_GROUP_LABELS,
} from '@/hooks/useNotificationPreferences';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Toggle component ─────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
  label: string;
}

function Toggle({ checked, onChange, ariaLabel, label }: ToggleProps) {
  return (
    <label className="np-modal__toggle-wrapper">
      <input
        type="checkbox"
        role="switch"
        className="np-modal__toggle-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
        aria-checked={checked}
      />
      <span className="np-modal__toggle-track" aria-hidden="true">
        <span className="np-modal__toggle-thumb" />
      </span>
      <span className="np-modal__toggle-label">{label}</span>
    </label>
  );
}

// ─── Helper to look up pref ───────────────────────────────────────────────────

function getEnabled(
  preferences: Array<{ eventType: string; channel: string; enabled: boolean }>,
  eventType: string,
  channel: string,
): boolean {
  const pref = preferences.find((p) => p.eventType === eventType && p.channel === channel);
  return pref?.enabled ?? true;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function NotificationPreferencesModal({ isOpen, onClose }: Props) {
  const { preferences, isLoading, error, updatePreference, savePreferences, isDirty } =
    useNotificationPreferences();

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isSavingRef = useRef(false);

  // Focus trap and Escape
  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSave() {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await savePreferences();
      onClose();
    } catch {
      // error will show via error state in hook
    } finally {
      isSavingRef.current = false;
    }
  }

  return (
    <div
      className="np-modal__overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="np-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="np-modal-title"
      >
        {/* Header */}
        <div className="np-modal__header">
          <h2 id="np-modal-title" className="np-modal__title">
            Preferencias de Notificacao
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="np-modal__close"
            onClick={onClose}
            aria-label="Fechar preferencias de notificacao"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="np-modal__body">
          {isLoading && (
            <div
              className="np-modal__loading"
              aria-busy="true"
              aria-label="Carregando preferencias"
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="np-modal__skeleton" />
              ))}
            </div>
          )}

          {error && (
            <div className="np-modal__error" role="alert">
              Nao foi possivel carregar as preferencias. Tente novamente.
            </div>
          )}

          {!isLoading && !error && (
            <div className="np-modal__groups">
              {(
                Object.entries(NOTIFICATION_EVENT_GROUPS) as [
                  keyof typeof NOTIFICATION_EVENT_GROUPS,
                  readonly string[],
                ][]
              ).map(([role, eventTypes]) => (
                <section key={role} className="np-modal__group">
                  <h3 className="np-modal__group-title">{ROLE_GROUP_LABELS[role] ?? role}</h3>

                  <div className="np-modal__rows">
                    <div className="np-modal__row np-modal__row--header">
                      <span className="np-modal__event-label">Notificacao</span>
                      <div className="np-modal__channels-header">
                        <span>App</span>
                        <span>Push</span>
                      </div>
                    </div>

                    {eventTypes.map((eventType) => {
                      const eventLabel = EVENT_TYPE_LABELS[eventType] ?? eventType;
                      const inAppEnabled = getEnabled(preferences, eventType, 'IN_APP');
                      const pushEnabled = getEnabled(preferences, eventType, 'PUSH');
                      const digestEnabled = getEnabled(preferences, eventType, 'DIGEST');
                      const showDigest = eventType === 'DAILY_DIGEST';

                      return (
                        <div key={eventType} className="np-modal__row">
                          <span className="np-modal__event-label">{eventLabel}</span>
                          <div className="np-modal__channels">
                            <Toggle
                              checked={inAppEnabled}
                              onChange={(v) => updatePreference(eventType, 'IN_APP', v)}
                              ariaLabel={`Notificacao App para ${eventLabel}`}
                              label="App"
                            />
                            <Toggle
                              checked={pushEnabled}
                              onChange={(v) => updatePreference(eventType, 'PUSH', v)}
                              ariaLabel={`Notificacao Push para ${eventLabel}`}
                              label="Push"
                            />
                            {showDigest && (
                              <Toggle
                                checked={digestEnabled}
                                onChange={(v) => updatePreference(eventType, 'DIGEST', v)}
                                ariaLabel={`Notificacao Digest para ${eventLabel}`}
                                label="Digest"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="np-modal__footer">
          <button type="button" className="np-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="np-modal__btn-save"
            onClick={() => void handleSave()}
            disabled={!isDirty || isLoading}
          >
            Salvar
          </button>
        </div>
      </div>

      <style>{`
        .np-modal__overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .np-modal {
          background: var(--color-neutral-0);
          border-radius: 12px;
          width: 100%;
          max-width: 560px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .np-modal__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--color-neutral-200);
          flex-shrink: 0;
        }
        .np-modal__title {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 700;
          font-size: 1.125rem;
          color: var(--color-neutral-800);
          margin: 0;
        }
        .np-modal__close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 8px;
          color: var(--color-neutral-500);
          transition: background 150ms ease-out;
        }
        .np-modal__close:hover {
          background: var(--color-neutral-100);
          color: var(--color-neutral-700);
        }
        .np-modal__close:focus-visible {
          outline: 2px solid var(--color-primary-500);
          outline-offset: 2px;
        }
        .np-modal__body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }
        .np-modal__loading {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .np-modal__skeleton {
          height: 48px;
          background: var(--color-neutral-100);
          border-radius: 8px;
          animation: np-pulse 1.5s infinite;
        }
        @keyframes np-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .np-modal__error {
          padding: 16px;
          background: var(--color-error-50, #ffebee);
          color: var(--color-error-700, #c62828);
          border-radius: 8px;
          font-family: 'Source Sans 3', system-ui, sans-serif;
          font-size: 0.9375rem;
        }
        .np-modal__groups {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .np-modal__group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .np-modal__group-title {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 700;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-neutral-500);
          margin: 0 0 4px;
        }
        .np-modal__rows {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .np-modal__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--color-neutral-100);
        }
        .np-modal__row:last-child {
          border-bottom: none;
        }
        .np-modal__row--header {
          padding-bottom: 4px;
        }
        .np-modal__channels-header {
          display: flex;
          gap: 16px;
          min-width: 140px;
          justify-content: flex-end;
          font-family: 'Source Sans 3', system-ui, sans-serif;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .np-modal__channels-header span {
          min-width: 48px;
          text-align: center;
        }
        .np-modal__event-label {
          font-family: 'Source Sans 3', system-ui, sans-serif;
          font-size: 0.9375rem;
          color: var(--color-neutral-700);
          flex: 1;
          padding-right: 16px;
        }
        .np-modal__channels {
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .np-modal__toggle-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          cursor: pointer;
          min-width: 48px;
        }
        .np-modal__toggle-input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
          pointer-events: none;
        }
        .np-modal__toggle-input:focus-visible + .np-modal__toggle-track {
          outline: 2px solid var(--color-primary-500);
          outline-offset: 2px;
        }
        .np-modal__toggle-track {
          position: relative;
          width: 36px;
          height: 20px;
          background: var(--color-neutral-300);
          border-radius: 100px;
          transition: background 150ms ease-out;
          cursor: pointer;
          display: block;
        }
        .np-modal__toggle-input:checked + .np-modal__toggle-track {
          background: var(--color-primary-600);
        }
        .np-modal__toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          transition: transform 150ms ease-out;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .np-modal__toggle-input:checked + .np-modal__toggle-track .np-modal__toggle-thumb {
          transform: translateX(16px);
        }
        .np-modal__toggle-label {
          font-family: 'Source Sans 3', system-ui, sans-serif;
          font-size: 0.6875rem;
          color: var(--color-neutral-500);
          text-align: center;
        }
        .np-modal__footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--color-neutral-200);
          flex-shrink: 0;
        }
        .np-modal__btn-cancel {
          padding: 8px 16px;
          border: 1px solid var(--color-neutral-300);
          border-radius: 8px;
          background: none;
          cursor: pointer;
          font-family: 'Source Sans 3', system-ui, sans-serif;
          font-size: 0.9375rem;
          color: var(--color-neutral-700);
          min-height: 40px;
          transition: background 150ms ease-out;
        }
        .np-modal__btn-cancel:hover {
          background: var(--color-neutral-50);
        }
        .np-modal__btn-cancel:focus-visible {
          outline: 2px solid var(--color-primary-500);
          outline-offset: 2px;
        }
        .np-modal__btn-save {
          padding: 8px 20px;
          border: none;
          border-radius: 8px;
          background: var(--color-primary-600);
          color: white;
          cursor: pointer;
          font-family: 'Source Sans 3', system-ui, sans-serif;
          font-size: 0.9375rem;
          font-weight: 600;
          min-height: 40px;
          transition: background 150ms ease-out;
        }
        .np-modal__btn-save:hover:not(:disabled) {
          background: var(--color-primary-700);
        }
        .np-modal__btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .np-modal__btn-save:focus-visible {
          outline: 2px solid var(--color-primary-500);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
