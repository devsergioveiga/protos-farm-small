import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CalendarClock,
  Bell,
  Syringe,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { useSanitaryAlerts } from '@/hooks/useSanitaryAlerts';
import type { SanitaryAlertItem, AlertUrgency } from '@/types/sanitary-protocol';
import { PROCEDURE_TYPES, TARGET_CATEGORIES } from '@/types/sanitary-protocol';
import './SanitaryAlertsView.css';

export default function SanitaryAlertsView() {
  const [urgencyFilter, setUrgencyFilter] = useState<AlertUrgency | ''>('');
  const [procedureFilter, setProcedureFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const { alerts, summary, isLoading, error } = useSanitaryAlerts({
    daysAhead: 30,
    urgency: urgencyFilter || undefined,
    procedureType: procedureFilter || undefined,
    targetCategory: categoryFilter || undefined,
  });

  const toggleExpand = (alertId: string) => {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  if (isLoading) {
    return <div className="sa-view__loading">Analisando pendências sanitárias...</div>;
  }

  if (error) {
    return (
      <div className="sa-view__error" role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        {error}
      </div>
    );
  }

  return (
    <div className="sa-view">
      {/* Summary Cards */}
      {summary && (
        <div className="sa-view__summary">
          <button
            type="button"
            className={`sa-view__summary-card sa-view__summary-card--overdue ${urgencyFilter === 'OVERDUE' ? 'sa-view__summary-card--selected' : ''}`}
            onClick={() => setUrgencyFilter(urgencyFilter === 'OVERDUE' ? '' : 'OVERDUE')}
          >
            <AlertTriangle size={24} aria-hidden="true" />
            <span className="sa-view__summary-count">{summary.overdue}</span>
            <span className="sa-view__summary-label">Atrasados</span>
          </button>
          <button
            type="button"
            className={`sa-view__summary-card sa-view__summary-card--due7 ${urgencyFilter === 'DUE_7_DAYS' ? 'sa-view__summary-card--selected' : ''}`}
            onClick={() => setUrgencyFilter(urgencyFilter === 'DUE_7_DAYS' ? '' : 'DUE_7_DAYS')}
          >
            <Clock size={24} aria-hidden="true" />
            <span className="sa-view__summary-count">{summary.due7Days}</span>
            <span className="sa-view__summary-label">Em 7 dias</span>
          </button>
          <button
            type="button"
            className={`sa-view__summary-card sa-view__summary-card--due15 ${urgencyFilter === 'DUE_15_DAYS' ? 'sa-view__summary-card--selected' : ''}`}
            onClick={() => setUrgencyFilter(urgencyFilter === 'DUE_15_DAYS' ? '' : 'DUE_15_DAYS')}
          >
            <CalendarClock size={24} aria-hidden="true" />
            <span className="sa-view__summary-count">{summary.due15Days}</span>
            <span className="sa-view__summary-label">Em 15 dias</span>
          </button>
          <button
            type="button"
            className={`sa-view__summary-card sa-view__summary-card--due30 ${urgencyFilter === 'DUE_30_DAYS' ? 'sa-view__summary-card--selected' : ''}`}
            onClick={() => setUrgencyFilter(urgencyFilter === 'DUE_30_DAYS' ? '' : 'DUE_30_DAYS')}
          >
            <Bell size={24} aria-hidden="true" />
            <span className="sa-view__summary-count">{summary.due30Days}</span>
            <span className="sa-view__summary-label">Em 30 dias</span>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="sa-view__filters">
        <div className="sa-view__filter">
          <select
            value={procedureFilter}
            onChange={(e) => setProcedureFilter(e.target.value)}
            aria-label="Filtrar por tipo de procedimento"
          >
            <option value="">Todos os procedimentos</option>
            {PROCEDURE_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sa-view__filter">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por categoria animal"
          >
            <option value="">Todas as categorias</option>
            {TARGET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State */}
      {alerts.length === 0 && (
        <div className="sa-view__empty">
          <ShieldAlert size={48} aria-hidden="true" />
          <h2>Nenhum alerta sanitário no momento</h2>
          <p>
            {urgencyFilter || procedureFilter || categoryFilter
              ? 'Nenhuma pendência encontrada com os filtros selecionados.'
              : 'Todos os protocolos sanitários estão em dia para os próximos 30 dias.'}
          </p>
        </div>
      )}

      {/* Alert List */}
      {alerts.length > 0 && (
        <ul className="sa-view__list" role="list">
          {alerts.map((alert) => (
            <AlertCard
              key={`${alert.protocolItemId}-${alert.urgency}`}
              alert={alert}
              isExpanded={expandedAlerts.has(alert.protocolItemId)}
              onToggle={() => toggleExpand(alert.protocolItemId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AlertCard({
  alert,
  isExpanded,
  onToggle,
}: {
  alert: SanitaryAlertItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const urgencyClass = `sa-alert--${alert.urgency.toLowerCase().replace(/_/g, '-')}`;

  return (
    <li className={`sa-alert ${urgencyClass}`}>
      <button
        type="button"
        className="sa-alert__header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="sa-alert__header-left">
          <span className={`sa-alert__urgency-badge ${urgencyClass}`}>
            {alert.urgency === 'OVERDUE' && <AlertTriangle size={14} aria-hidden="true" />}
            {alert.urgency === 'DUE_7_DAYS' && <Clock size={14} aria-hidden="true" />}
            {alert.urgency === 'DUE_15_DAYS' && <CalendarClock size={14} aria-hidden="true" />}
            {alert.urgency === 'DUE_30_DAYS' && <Bell size={14} aria-hidden="true" />}
            {alert.urgencyLabel}
          </span>
          {alert.isObligatory && (
            <span className="sa-alert__obligatory-badge">
              <AlertTriangle size={12} aria-hidden="true" />
              Obrigatório
            </span>
          )}
        </div>
        <div className="sa-alert__header-right">
          {isExpanded ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </div>
      </button>

      <div className="sa-alert__body">
        <div className="sa-alert__title-row">
          <Syringe size={16} aria-hidden="true" />
          <span className="sa-alert__product">{alert.productName}</span>
          <span className="sa-alert__procedure-type">{alert.procedureTypeLabel}</span>
        </div>
        <p className="sa-alert__protocol-name">{alert.protocolName}</p>
        <p className="sa-alert__due-description">{alert.dueDescription}</p>

        {/* Categories */}
        <div className="sa-alert__categories">
          {alert.targetCategoryLabels.map((label, idx) => (
            <span key={idx} className="sa-alert__category-badge">
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="sa-alert__details">
          {/* Dosage info */}
          {alert.dosage != null && (
            <div className="sa-alert__detail-row">
              <span className="sa-alert__detail-label">Dose:</span>
              <span>
                {alert.dosage} {alert.dosageUnitLabel ?? ''}
              </span>
              {alert.administrationRouteLabel && (
                <span className="sa-alert__detail-route">via {alert.administrationRouteLabel}</span>
              )}
            </div>
          )}

          {/* Trigger info */}
          <div className="sa-alert__detail-row">
            <span className="sa-alert__detail-label">Gatilho:</span>
            <span>{alert.triggerTypeLabel}</span>
          </div>

          {/* Sample animals (AGE triggers) */}
          {alert.sampleAnimals.length > 0 && (
            <div className="sa-alert__animals">
              <span className="sa-alert__detail-label">Animais ({alert.animalCount} total):</span>
              <ul className="sa-alert__animal-list">
                {alert.sampleAnimals.map((animal) => (
                  <li key={animal.id} className="sa-alert__animal-item">
                    <span className="sa-alert__animal-tag">{animal.earTag}</span>
                    {animal.name && <span className="sa-alert__animal-name">{animal.name}</span>}
                    <span className="sa-alert__animal-farm">{animal.farmName}</span>
                    <span className="sa-alert__animal-age">{animal.ageDays} dias</span>
                  </li>
                ))}
                {alert.animalCount > 5 && (
                  <li className="sa-alert__animal-more">
                    e mais {alert.animalCount - 5} animal(is)...
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Notes */}
          {alert.notes && (
            <div className="sa-alert__detail-row">
              <span className="sa-alert__detail-label">Obs:</span>
              <span>{alert.notes}</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
