import { Bell, Mail, Check, AlertCircle } from 'lucide-react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import type { NotificationPreference } from '@/hooks/useNotificationPreferences';
import './NotificationPreferencesPage.css';

/* ── Event type groups ──────────────────────────────────── */

interface EventDef {
  eventType: string;
  label: string;
  badgeEnabled?: boolean;
}

interface EventGroup {
  groupLabel: string;
  events: EventDef[];
}

const EVENT_GROUPS: EventGroup[] = [
  {
    groupLabel: 'Requisicoes',
    events: [
      { eventType: 'RC_APPROVED', label: 'Requisicao aprovada' },
      { eventType: 'RC_REJECTED', label: 'Requisicao rejeitada' },
      { eventType: 'RC_RETURNED', label: 'Requisicao devolvida' },
      { eventType: 'RC_PENDING', label: 'Requisicao pendente' },
      { eventType: 'SLA_REMINDER', label: 'Lembrete de SLA' },
    ],
  },
  {
    groupLabel: 'Cotacoes',
    events: [
      { eventType: 'QUOTATION_PENDING_APPROVAL', label: 'Cotacao aguardando aprovacao' },
      { eventType: 'QUOTATION_APPROVED', label: 'Cotacao aprovada' },
      { eventType: 'QUOTATION_RECEIVED', label: 'Proposta recebida' },
      { eventType: 'QUOTATION_DEADLINE_NEAR', label: 'Prazo de cotacao proximo' },
    ],
  },
  {
    groupLabel: 'Pedidos',
    events: [
      { eventType: 'PO_OVERDUE', label: 'Pedido em atraso' },
      { eventType: 'PO_GOODS_RECEIVED', label: 'Recebimento confirmado' },
    ],
  },
  {
    groupLabel: 'Orcamento e Devolucoes',
    events: [
      { eventType: 'BUDGET_EXCEEDED', label: 'Orcamento excedido' },
      { eventType: 'RETURN_REGISTERED', label: 'Devolucao registrada' },
      { eventType: 'RETURN_RESOLVED', label: 'Devolucao resolvida' },
    ],
  },
  {
    groupLabel: 'Resumo',
    events: [
      {
        eventType: 'DAILY_DIGEST',
        label: 'Resumo diario',
        badgeEnabled: false,
      },
    ],
  },
];

/* ── Toggle switch component ────────────────────────────── */

interface ToggleSwitchProps {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onToggle: () => void;
  saving?: boolean;
}

function ToggleSwitch({
  checked,
  disabled = false,
  ariaLabel,
  onToggle,
  saving,
}: ToggleSwitchProps) {
  return (
    <div className="notif-prefs__toggle-wrapper">
      <div className="notif-prefs__touch-target">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel}
          aria-disabled={disabled ? 'true' : undefined}
          disabled={disabled}
          className={[
            'notif-prefs__toggle',
            checked ? 'notif-prefs__toggle--on' : 'notif-prefs__toggle--off',
            disabled ? 'notif-prefs__toggle--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={disabled ? undefined : onToggle}
        >
          <span aria-hidden="true" className="notif-prefs__toggle-knob" />
        </button>
      </div>
      {saving && (
        <span className="notif-prefs__save-indicator" aria-label="Preferencia salva" role="status">
          <Check size={16} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

/* ── Skeleton loading ───────────────────────────────────── */

function SkeletonRows() {
  return (
    <table
      className="notif-prefs__skeleton-table"
      aria-busy="true"
      aria-label="Carregando preferencias"
    >
      <tbody>
        {Array.from({ length: 8 }, (_, i) => (
          <tr key={i} className="notif-prefs__skeleton-row">
            <td>
              <div
                className="notif-prefs__skeleton-bar"
                style={{ width: `${50 + (i % 3) * 15}%` }}
              />
            </td>
            <td>
              <div className="notif-prefs__skeleton-circle" />
            </td>
            <td>
              <div className="notif-prefs__skeleton-circle" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Main page ──────────────────────────────────────────── */

export default function NotificationPreferencesPage() {
  const { preferences, loading, error, savingKey, errorToast, togglePreference, retry } =
    useNotificationPreferences();

  function getPref(eventType: string): NotificationPreference {
    return (
      preferences.find((p) => p.eventType === eventType) ?? {
        eventType,
        badge: true,
        email: false,
      }
    );
  }

  function handleToggle(eventType: string, channel: 'badge' | 'email', currentValue: boolean) {
    void togglePreference(eventType, channel, !currentValue);
  }

  return (
    <main className="notif-prefs" id="main-content">
      <h1 className="notif-prefs__title">Preferencias de Notificacao</h1>

      {loading && <SkeletonRows />}

      {!loading && error && (
        <div className="notif-prefs__error" role="alert">
          <AlertCircle size={40} aria-hidden="true" color="var(--color-error-500)" />
          <p className="notif-prefs__error-text">{error}</p>
          <button type="button" className="notif-prefs__retry-btn" onClick={retry}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && (
        <table className="notif-prefs__table" aria-label="Preferencias de notificacao por canal">
          <thead>
            <tr>
              <th scope="col">Tipo de notificacao</th>
              <th scope="col">
                <div className="notif-prefs__col-icon">
                  <Bell size={20} aria-hidden="true" />
                  <span>Badge</span>
                </div>
              </th>
              <th scope="col">
                <div className="notif-prefs__col-icon">
                  <Mail size={20} aria-hidden="true" />
                  <span>Email</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {EVENT_GROUPS.map((group) => (
              <>
                <tr key={`group-${group.groupLabel}`} className="notif-prefs__group-header">
                  <th colSpan={3} scope="colgroup">
                    {group.groupLabel}
                  </th>
                </tr>
                {group.events.map((ev) => {
                  const pref = getPref(ev.eventType);
                  const badgeDisabled = ev.badgeEnabled === false;
                  const badgeSaving = savingKey === `${ev.eventType}:badge`;
                  const emailSaving = savingKey === `${ev.eventType}:email`;

                  return (
                    <tr key={ev.eventType} className="notif-prefs__row">
                      <td className="notif-prefs__event-label">{ev.label}</td>
                      <td className="notif-prefs__toggle-cell" data-label="Badge">
                        {badgeDisabled ? (
                          <span
                            className="notif-prefs__touch-target"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <span
                              aria-disabled="true"
                              role="switch"
                              aria-checked={false}
                              aria-label={`${ev.label} por badge (indisponivel)`}
                              style={{
                                color: 'var(--color-neutral-400)',
                                fontSize: '1.25rem',
                                lineHeight: 1,
                              }}
                            >
                              —
                            </span>
                          </span>
                        ) : (
                          <ToggleSwitch
                            checked={pref.badge}
                            ariaLabel={`${ev.label} por badge`}
                            onToggle={() => handleToggle(ev.eventType, 'badge', pref.badge)}
                            saving={badgeSaving}
                          />
                        )}
                      </td>
                      <td className="notif-prefs__toggle-cell" data-label="Email">
                        <ToggleSwitch
                          checked={pref.email}
                          ariaLabel={`${ev.label} por email`}
                          onToggle={() => handleToggle(ev.eventType, 'email', pref.email)}
                          saving={emailSaving}
                        />
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      )}

      {errorToast && (
        <div className="notif-prefs__toast" role="alert" aria-live="assertive">
          {errorToast}
        </div>
      )}
    </main>
  );
}
