import { useMemo, useState } from 'react';
import {
  Syringe,
  Bug,
  Microscope,
  Pill,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  CalendarDays,
  ShieldPlus,
} from 'lucide-react';
import type { SanitaryProtocol, SanitaryProtocolItem } from '@/types/sanitary-protocol';
import { MONTH_NAMES } from '@/types/sanitary-protocol';
import './SanitaryCalendarView.css';

interface SanitaryCalendarViewProps {
  protocols: SanitaryProtocol[];
}

interface CalendarEntry {
  protocol: SanitaryProtocol;
  item: SanitaryProtocolItem;
}

interface AgeEntry {
  protocol: SanitaryProtocol;
  item: SanitaryProtocolItem;
  ageDays: number;
  ageMaxDays: number | null;
}

interface EventEntry {
  protocol: SanitaryProtocol;
  item: SanitaryProtocolItem;
  event: string;
  eventLabel: string;
  offsetDays: number | null;
}

const PROCEDURE_ICONS: Record<string, typeof Syringe> = {
  VACCINATION: Syringe,
  DEWORMING: Bug,
  EXAM: Microscope,
  MEDICATION: Pill,
  OTHER: MoreHorizontal,
};

const PROCEDURE_COLORS: Record<string, string> = {
  VACCINATION: 'cal-entry--vaccination',
  DEWORMING: 'cal-entry--deworming',
  EXAM: 'cal-entry--exam',
  MEDICATION: 'cal-entry--medication',
  OTHER: 'cal-entry--other',
};

function formatAgeDays(days: number): string {
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  const remaining = days % 30;
  if (remaining === 0) return `${months}m`;
  return `${months}m ${remaining}d`;
}

export default function SanitaryCalendarView({ protocols }: SanitaryCalendarViewProps) {
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [showAgeTimeline, setShowAgeTimeline] = useState(true);
  const [showEventTimeline, setShowEventTimeline] = useState(true);

  const activeProtocols = useMemo(
    () => protocols.filter((p) => p.status === 'ACTIVE'),
    [protocols],
  );

  // Group CALENDAR items by month
  const calendarByMonth = useMemo(() => {
    const months: CalendarEntry[][] = Array.from({ length: 12 }, () => []);

    for (const protocol of activeProtocols) {
      for (const item of protocol.items) {
        if (item.triggerType !== 'CALENDAR') continue;

        if (item.calendarMonths.length > 0) {
          for (const month of item.calendarMonths) {
            if (month >= 1 && month <= 12) {
              months[month - 1].push({ protocol, item });
            }
          }
        } else {
          // No specific months — distribute based on frequency
          const freq = item.calendarFrequency;
          if (freq === 'MONTHLY') {
            for (let m = 0; m < 12; m++) months[m].push({ protocol, item });
          } else if (freq === 'QUARTERLY') {
            for (const m of [0, 3, 6, 9]) months[m].push({ protocol, item });
          } else if (freq === 'BIANNUAL') {
            for (const m of [0, 6]) months[m].push({ protocol, item });
          } else if (freq === 'ANNUAL') {
            months[0].push({ protocol, item });
          }
        }
      }
    }

    return months;
  }, [activeProtocols]);

  // Group AGE items sorted by trigger age
  const ageEntries = useMemo(() => {
    const entries: AgeEntry[] = [];

    for (const protocol of activeProtocols) {
      for (const item of protocol.items) {
        if (item.triggerType !== 'AGE' || item.triggerAgeDays == null) continue;
        entries.push({
          protocol,
          item,
          ageDays: item.triggerAgeDays,
          ageMaxDays: item.triggerAgeMaxDays,
        });
      }
    }

    return entries.sort((a, b) => a.ageDays - b.ageDays);
  }, [activeProtocols]);

  // Group EVENT items by event type
  const eventEntries = useMemo(() => {
    const byEvent = new Map<string, EventEntry[]>();

    for (const protocol of activeProtocols) {
      for (const item of protocol.items) {
        if (item.triggerType !== 'EVENT' || !item.triggerEvent) continue;
        const key = item.triggerEvent;
        if (!byEvent.has(key)) byEvent.set(key, []);
        byEvent.get(key)!.push({
          protocol,
          item,
          event: item.triggerEvent,
          eventLabel: item.triggerEventLabel ?? item.triggerEvent,
          offsetDays: item.triggerEventOffsetDays,
        });
      }
    }

    // Sort entries within each event by offset
    for (const entries of byEvent.values()) {
      entries.sort((a, b) => (a.offsetDays ?? 0) - (b.offsetDays ?? 0));
    }

    return byEvent;
  }, [activeProtocols]);

  const hasCalendarItems = calendarByMonth.some((m) => m.length > 0);
  const hasAgeItems = ageEntries.length > 0;
  const hasEventItems = eventEntries.size > 0;

  if (!hasCalendarItems && !hasAgeItems && !hasEventItems) {
    return (
      <div className="cal-view__empty">
        <ShieldPlus size={48} aria-hidden="true" />
        <h2>Nenhum procedimento para exibir</h2>
        <p>
          Cadastre protocolos sanitários ativos com gatilhos de calendário, idade ou evento para
          visualizar a timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="cal-view">
      {/* ─── Calendar Grid (12 months) ──────────────────────── */}
      {hasCalendarItems && (
        <section className="cal-view__section">
          <h2 className="cal-view__section-title">
            <CalendarDays size={20} aria-hidden="true" />
            Calendário anual
          </h2>
          <p className="cal-view__section-desc">
            Procedimentos agendados por mês — baseados nos gatilhos de calendário dos protocolos
            ativos.
          </p>

          <div className="cal-grid">
            {MONTH_NAMES.map((monthName, idx) => {
              const entries = calendarByMonth[idx];
              const isExpanded = expandedMonth === idx;
              const hasEntries = entries.length > 0;
              const currentMonth = new Date().getMonth();

              return (
                <div
                  key={idx}
                  className={`cal-grid__month ${idx === currentMonth ? 'cal-grid__month--current' : ''} ${!hasEntries ? 'cal-grid__month--empty' : ''}`}
                >
                  <button
                    type="button"
                    className="cal-grid__month-header"
                    onClick={() => setExpandedMonth(isExpanded ? null : idx)}
                    disabled={!hasEntries}
                    aria-expanded={isExpanded}
                    aria-label={`${monthName}: ${entries.length} procedimento${entries.length !== 1 ? 's' : ''}`}
                  >
                    <span className="cal-grid__month-name">{monthName.slice(0, 3)}</span>
                    {hasEntries && <span className="cal-grid__month-count">{entries.length}</span>}
                  </button>

                  {/* Compact badges */}
                  {hasEntries && !isExpanded && (
                    <div className="cal-grid__month-badges">
                      {entries.slice(0, 3).map((entry, i) => {
                        const Icon = PROCEDURE_ICONS[entry.item.procedureType] ?? MoreHorizontal;
                        return (
                          <span
                            key={i}
                            className={`cal-entry__badge ${PROCEDURE_COLORS[entry.item.procedureType] ?? ''}`}
                            title={`${entry.item.productName} (${entry.protocol.name})`}
                          >
                            <Icon size={12} aria-hidden="true" />
                          </span>
                        );
                      })}
                      {entries.length > 3 && (
                        <span className="cal-entry__badge cal-entry__badge--more">
                          +{entries.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded detail */}
                  {isExpanded && (
                    <ul className="cal-grid__month-detail">
                      {entries.map((entry, i) => {
                        const Icon = PROCEDURE_ICONS[entry.item.procedureType] ?? MoreHorizontal;
                        return (
                          <li
                            key={i}
                            className={`cal-detail__item ${PROCEDURE_COLORS[entry.item.procedureType] ?? ''}`}
                          >
                            <Icon size={14} aria-hidden="true" />
                            <div className="cal-detail__info">
                              <span className="cal-detail__product">{entry.item.productName}</span>
                              <span className="cal-detail__protocol">
                                {entry.protocol.name}
                                {entry.protocol.isObligatory && (
                                  <AlertTriangle
                                    size={10}
                                    aria-label="Obrigatório"
                                    className="cal-detail__obligatory"
                                  />
                                )}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="cal-view__legend">
            <span className="cal-legend__item">
              <span className="cal-legend__dot cal-entry--vaccination" />
              Vacinação
            </span>
            <span className="cal-legend__item">
              <span className="cal-legend__dot cal-entry--deworming" />
              Vermifugação
            </span>
            <span className="cal-legend__item">
              <span className="cal-legend__dot cal-entry--exam" />
              Exame
            </span>
            <span className="cal-legend__item">
              <span className="cal-legend__dot cal-entry--medication" />
              Medicamento
            </span>
          </div>
        </section>
      )}

      {/* ─── Age-based Timeline ────────────────────────────── */}
      {hasAgeItems && (
        <section className="cal-view__section">
          <button
            type="button"
            className="cal-view__section-toggle"
            onClick={() => setShowAgeTimeline(!showAgeTimeline)}
            aria-expanded={showAgeTimeline}
          >
            <Clock size={20} aria-hidden="true" />
            <h2 className="cal-view__section-title cal-view__section-title--inline">
              Timeline por idade
            </h2>
            <span className="cal-view__section-count">{ageEntries.length}</span>
            {showAgeTimeline ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </button>

          {showAgeTimeline && (
            <div className="cal-age">
              <div className="cal-age__line" aria-hidden="true" />
              {ageEntries.map((entry, idx) => {
                const Icon = PROCEDURE_ICONS[entry.item.procedureType] ?? MoreHorizontal;
                return (
                  <div key={idx} className="cal-age__entry">
                    <div
                      className={`cal-age__marker ${PROCEDURE_COLORS[entry.item.procedureType] ?? ''}`}
                    >
                      <Icon size={14} aria-hidden="true" />
                    </div>
                    <div className="cal-age__content">
                      <div className="cal-age__timing">
                        <span className="cal-age__days">
                          {formatAgeDays(entry.ageDays)}
                          {entry.ageMaxDays != null && ` – ${formatAgeDays(entry.ageMaxDays)}`}
                        </span>
                        {entry.item.isReinforcement && (
                          <span className="cal-age__reinforcement">
                            Reforço (dose {entry.item.reinforcementDoseNumber})
                          </span>
                        )}
                      </div>
                      <span className="cal-age__product">{entry.item.productName}</span>
                      <span className="cal-age__protocol">
                        {entry.protocol.name}
                        {entry.protocol.isObligatory && (
                          <AlertTriangle
                            size={10}
                            aria-label="Obrigatório"
                            className="cal-detail__obligatory"
                          />
                        )}
                      </span>
                      {(entry.item.withdrawalMeatDays || entry.item.withdrawalMilkDays) && (
                        <span className="cal-age__withdrawal">
                          Carência:
                          {entry.item.withdrawalMeatDays
                            ? ` carne ${entry.item.withdrawalMeatDays}d`
                            : ''}
                          {entry.item.withdrawalMilkDays
                            ? ` leite ${entry.item.withdrawalMilkDays}d`
                            : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ─── Event-based Timeline ──────────────────────────── */}
      {hasEventItems && (
        <section className="cal-view__section">
          <button
            type="button"
            className="cal-view__section-toggle"
            onClick={() => setShowEventTimeline(!showEventTimeline)}
            aria-expanded={showEventTimeline}
          >
            <CalendarDays size={20} aria-hidden="true" />
            <h2 className="cal-view__section-title cal-view__section-title--inline">
              Procedimentos por evento
            </h2>
            <span className="cal-view__section-count">
              {Array.from(eventEntries.values()).reduce((sum, e) => sum + e.length, 0)}
            </span>
            {showEventTimeline ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </button>

          {showEventTimeline && (
            <div className="cal-events">
              {Array.from(eventEntries.entries()).map(([event, entries]) => (
                <div key={event} className="cal-events__group">
                  <h3 className="cal-events__event-label">{entries[0].eventLabel}</h3>
                  <ul className="cal-events__list">
                    {entries.map((entry, idx) => {
                      const Icon = PROCEDURE_ICONS[entry.item.procedureType] ?? MoreHorizontal;
                      return (
                        <li
                          key={idx}
                          className={`cal-events__item ${PROCEDURE_COLORS[entry.item.procedureType] ?? ''}`}
                        >
                          <Icon size={14} aria-hidden="true" />
                          <div className="cal-events__info">
                            <span className="cal-events__product">{entry.item.productName}</span>
                            {entry.offsetDays != null && entry.offsetDays !== 0 && (
                              <span className="cal-events__offset">
                                {entry.offsetDays > 0
                                  ? `+${entry.offsetDays} dias após`
                                  : `${Math.abs(entry.offsetDays)} dias antes`}
                              </span>
                            )}
                            <span className="cal-events__protocol">{entry.protocol.name}</span>
                          </div>
                          {(entry.item.withdrawalMeatDays || entry.item.withdrawalMilkDays) && (
                            <span className="cal-events__withdrawal">
                              {entry.item.withdrawalMeatDays
                                ? `Carne: ${entry.item.withdrawalMeatDays}d`
                                : ''}
                              {entry.item.withdrawalMeatDays && entry.item.withdrawalMilkDays
                                ? ' | '
                                : ''}
                              {entry.item.withdrawalMilkDays
                                ? `Leite: ${entry.item.withdrawalMilkDays}d`
                                : ''}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
