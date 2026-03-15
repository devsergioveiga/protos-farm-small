import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  Milestone,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Calendar,
  Clock,
  AlertTriangle,
  BarChart3,
  List,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import {
  useCalvingEvents,
  useUpcomingBirths,
  useCalvingIndicators,
} from '@/hooks/useCalvingEvents';
import type { CalvingEventItem } from '@/types/calving-event';
import { EVENT_TYPE_CONFIG, BIRTH_TYPE_CONFIG, CALF_CONDITION_CONFIG } from '@/types/calving-event';
import CalvingModal from '@/components/calving-events/CalvingModal';
import { api } from '@/services/api';
import './CalvingEventsPage.css';

type TabId = 'events' | 'upcoming' | 'indicators';

export default function CalvingEventsPage() {
  const { selectedFarm } = useFarmContext();
  const farmId = selectedFarm?.id ?? null;

  // ─── State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('events');
  const [searchInput, setSearchInput] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalvingEventItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ─── Debounced search ──────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Hooks ─────────────────────────────────────────────
  const { events, total, isLoading, error, refetch } = useCalvingEvents({
    farmId,
    page,
    eventType: eventTypeFilter || undefined,
  });

  const {
    upcoming,
    isLoading: upcomingLoading,
    error: upcomingError,
  } = useUpcomingBirths(activeTab === 'upcoming' ? farmId : null);

  const {
    indicators,
    isLoading: indicatorsLoading,
    error: indicatorsError,
  } = useCalvingIndicators(activeTab === 'indicators' ? farmId : null);

  const totalPages = Math.ceil(total / 50) || 1;

  // ─── Handlers ──────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedEvent(null);
    setSuccessMsg(
      selectedEvent ? 'Evento atualizado com sucesso' : 'Evento registrado com sucesso',
    );
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, selectedEvent]);

  const handleEdit = useCallback(
    (evt: CalvingEventItem, e: React.MouseEvent) => {
      e.stopPropagation();
      // Fetch full detail first
      if (!farmId) return;
      api
        .get<CalvingEventItem>(`/org/farms/${farmId}/calving-events/${evt.id}`)
        .then((full) => {
          setSelectedEvent(full);
          setShowModal(true);
        })
        .catch(() => {
          setSelectedEvent(evt);
          setShowModal(true);
        });
    },
    [farmId],
  );

  const handleDelete = useCallback(
    async (evt: CalvingEventItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm('Excluir este evento? Os dados das crias registradas serão perdidos.'))
        return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/calving-events/${evt.id}`);
        setSuccessMsg('Evento excluído com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir evento.');
      }
    },
    [refetch, selectedFarm],
  );

  // ─── No farm selected ─────────────────────────────────
  if (!selectedFarm) {
    return (
      <section className="calving-page">
        <div className="calving-page__empty">
          <Milestone size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver os partos e crias.</p>
        </div>
      </section>
    );
  }

  // ─── Local search filter ──────────────────────────────
  const filtered = searchInput
    ? events.filter(
        (evt) =>
          evt.motherEarTag.toLowerCase().includes(searchInput.toLowerCase()) ||
          (evt.motherName ?? '').toLowerCase().includes(searchInput.toLowerCase()) ||
          evt.attendantName.toLowerCase().includes(searchInput.toLowerCase()) ||
          (evt.fatherName ?? '').toLowerCase().includes(searchInput.toLowerCase()),
      )
    : events;

  // ─── Upcoming urgency helper ──────────────────────────
  const getUrgencyClass = (daysUntil: number) => {
    if (daysUntil < 7) return 'calving-page__upcoming-row--critical';
    if (daysUntil < 15) return 'calving-page__upcoming-row--warning';
    if (daysUntil < 30) return 'calving-page__upcoming-row--attention';
    return '';
  };

  return (
    <section className="calving-page">
      <header className="calving-page__header">
        <div>
          <h1>Partos e crias</h1>
          <p>Registro de partos, abortos e crias de {selectedFarm.name}</p>
        </div>
        <div className="calving-page__actions">
          <button
            type="button"
            className="calving-page__btn-primary"
            onClick={() => {
              setSelectedEvent(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Novo evento
          </button>
        </div>
      </header>

      {/* Messages */}
      {successMsg && (
        <div className="calving-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}
      {(error || deleteError || upcomingError || indicatorsError) && (
        <div className="calving-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError || upcomingError || indicatorsError}
        </div>
      )}

      {/* Tabs */}
      <nav className="calving-page__tabs" role="tablist" aria-label="Abas de partos e crias">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'events'}
          className={activeTab === 'events' ? 'calving-page__tab--active' : 'calving-page__tab'}
          onClick={() => setActiveTab('events')}
        >
          <List size={16} aria-hidden="true" />
          Eventos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'upcoming'}
          className={activeTab === 'upcoming' ? 'calving-page__tab--active' : 'calving-page__tab'}
          onClick={() => setActiveTab('upcoming')}
        >
          <Calendar size={16} aria-hidden="true" />
          Próximos partos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'indicators'}
          className={activeTab === 'indicators' ? 'calving-page__tab--active' : 'calving-page__tab'}
          onClick={() => setActiveTab('indicators')}
        >
          <BarChart3 size={16} aria-hidden="true" />
          Indicadores
        </button>
      </nav>

      {/* ═══════════════════════════════════════════════════════
          TAB 1 — Eventos
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'events' && (
        <>
          <div className="calving-page__toolbar">
            <div className="calving-page__search">
              <Search size={16} aria-hidden="true" className="calving-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por animal, responsável..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar eventos"
              />
            </div>
            <select
              className="calving-page__type-filter"
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por tipo"
            >
              <option value="">Todos os tipos</option>
              <option value="BIRTH">Parto</option>
              <option value="ABORTION">Aborto</option>
            </select>
          </div>

          {isLoading && <div className="calving-page__loading">Carregando eventos...</div>}

          {!isLoading && filtered.length === 0 && (
            <div className="calving-page__empty">
              <Milestone size={48} aria-hidden="true" />
              <h2>Nenhum evento registrado</h2>
              <p>Registre o primeiro evento de parto ou aborto usando o botão acima.</p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="calving-page__grid">
              {filtered.map((evt) => {
                const typeConfig =
                  EVENT_TYPE_CONFIG[evt.eventType as keyof typeof EVENT_TYPE_CONFIG];
                const birthConfig = evt.birthType ? BIRTH_TYPE_CONFIG[evt.birthType] : null;

                return (
                  <div key={evt.id} className="calving-page__card">
                    <div className="calving-page__card-header">
                      <div>
                        <h3 className="calving-page__card-title">
                          {evt.motherEarTag} — {evt.motherName || 'Sem nome'}
                        </h3>
                        <p className="calving-page__card-subtitle">
                          <Calendar size={14} aria-hidden="true" />
                          {new Date(evt.eventDate).toLocaleDateString('pt-BR')}
                          {evt.eventTime && (
                            <>
                              {' '}
                              <Clock size={14} aria-hidden="true" />
                              {evt.eventTime}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="calving-page__card-actions">
                        <button
                          type="button"
                          className="calving-page__card-btn"
                          onClick={(e) => handleEdit(evt, e)}
                          aria-label={`Editar evento de ${evt.motherEarTag}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="calving-page__card-btn calving-page__card-btn--delete"
                          onClick={(e) => void handleDelete(evt, e)}
                          aria-label={`Excluir evento de ${evt.motherEarTag}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="calving-page__card-tags">
                      {typeConfig && (
                        <span className={`calving-page__tag ${typeConfig.className}`}>
                          {typeConfig.label}
                        </span>
                      )}
                      {birthConfig && (
                        <span className={`calving-page__tag ${birthConfig.className}`}>
                          {birthConfig.label}
                        </span>
                      )}
                      {evt.placentaRetention && (
                        <span className="calving-page__tag calving-page__tag--retention">
                          <AlertTriangle size={12} aria-hidden="true" />
                          Retenção placenta
                        </span>
                      )}
                    </div>

                    {/* Father info */}
                    {(evt.fatherName || evt.fatherBreedName) && (
                      <p className="calving-page__card-father">
                        Pai: {evt.fatherName || evt.fatherBreedName}
                      </p>
                    )}

                    {/* Calves summary */}
                    {evt.eventType === 'BIRTH' && evt.calves.length > 0 && (
                      <div className="calving-page__calves-summary">
                        <span className="calving-page__calves-label">
                          {evt.calvesCount} cria{evt.calvesCount !== 1 ? 's' : ''}
                          {evt.liveCalvesCount > 0 && (
                            <span className="calving-page__calves-alive">
                              {' '}
                              ({evt.liveCalvesCount} vivo{evt.liveCalvesCount !== 1 ? 's' : ''})
                            </span>
                          )}
                          {evt.calvesCount - evt.liveCalvesCount > 0 && (
                            <span className="calving-page__calves-stillborn">
                              {' '}
                              ({evt.calvesCount - evt.liveCalvesCount} natimorto
                              {evt.calvesCount - evt.liveCalvesCount !== 1 ? 's' : ''})
                            </span>
                          )}
                        </span>
                        <div className="calving-page__calves-list">
                          {evt.calves.map((calf) => {
                            const condConfig = CALF_CONDITION_CONFIG[calf.condition];
                            return (
                              <div
                                key={calf.id}
                                className={`calving-page__calf-chip ${condConfig?.className ?? ''}`}
                              >
                                <span>{calf.sexLabel}</span>
                                {calf.birthWeightKg != null && (
                                  <span className="calving-page__calf-weight">
                                    {calf.birthWeightKg} kg
                                  </span>
                                )}
                                <span
                                  className={`calving-page__calf-cond ${condConfig?.className ?? ''}`}
                                >
                                  {condConfig?.label ?? calf.conditionLabel}
                                </span>
                                {calf.earTag && (
                                  <span className="calving-page__calf-tag">{calf.earTag}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Abortion details */}
                    {evt.eventType === 'ABORTION' && (
                      <div className="calving-page__abortion-details">
                        {evt.abortionGestationDays != null && (
                          <span>{evt.abortionGestationDays} dias de gestação</span>
                        )}
                        {evt.abortionCauseLabel && <span>Causa: {evt.abortionCauseLabel}</span>}
                      </div>
                    )}

                    <div className="calving-page__card-footer">
                      <span className="calving-page__detail">{evt.attendantName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="calving-page__pagination" aria-label="Paginação">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span>
                {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 2 — Próximos partos
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'upcoming' && (
        <>
          {upcomingLoading && (
            <div className="calving-page__loading">Carregando próximos partos...</div>
          )}

          {!upcomingLoading && upcoming.length === 0 && (
            <div className="calving-page__empty">
              <Calendar size={48} aria-hidden="true" />
              <h2>Nenhum parto previsto</h2>
              <p>Não há fêmeas com diagnóstico de gestação com data de parto prevista.</p>
            </div>
          )}

          {!upcomingLoading && upcoming.length > 0 && (
            <div className="calving-page__table-wrap">
              <table className="calving-page__table">
                <caption className="sr-only">Próximos partos previstos</caption>
                <thead>
                  <tr>
                    <th scope="col">Animal</th>
                    <th scope="col">Data prevista</th>
                    <th scope="col">Dias restantes</th>
                    <th scope="col">Touro</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((item) => (
                    <tr key={item.animalId} className={getUrgencyClass(item.daysUntil)}>
                      <td>
                        <span className="calving-page__upcoming-animal">{item.earTag}</span>
                        {item.animalName && (
                          <span className="calving-page__upcoming-name">{item.animalName}</span>
                        )}
                      </td>
                      <td>{new Date(item.expectedDate).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <span
                          className={`calving-page__days-badge ${
                            item.daysUntil < 7
                              ? 'calving-page__days-badge--critical'
                              : item.daysUntil < 15
                                ? 'calving-page__days-badge--warning'
                                : item.daysUntil < 30
                                  ? 'calving-page__days-badge--attention'
                                  : ''
                          }`}
                        >
                          {item.daysUntil} dia{item.daysUntil !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>{item.bullName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile cards for upcoming */}
          {!upcomingLoading && upcoming.length > 0 && (
            <div className="calving-page__upcoming-cards">
              {upcoming.map((item) => (
                <div
                  key={item.animalId}
                  className={`calving-page__upcoming-card ${getUrgencyClass(item.daysUntil)}`}
                >
                  <div className="calving-page__upcoming-card-header">
                    <span className="calving-page__upcoming-animal">{item.earTag}</span>
                    <span
                      className={`calving-page__days-badge ${
                        item.daysUntil < 7
                          ? 'calving-page__days-badge--critical'
                          : item.daysUntil < 15
                            ? 'calving-page__days-badge--warning'
                            : item.daysUntil < 30
                              ? 'calving-page__days-badge--attention'
                              : ''
                      }`}
                    >
                      {item.daysUntil} dia{item.daysUntil !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {item.animalName && (
                    <p className="calving-page__upcoming-name">{item.animalName}</p>
                  )}
                  <div className="calving-page__upcoming-card-details">
                    <span>
                      <Calendar size={14} aria-hidden="true" />
                      {new Date(item.expectedDate).toLocaleDateString('pt-BR')}
                    </span>
                    {item.bullName && <span>Touro: {item.bullName}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 3 — Indicadores
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'indicators' && (
        <>
          {indicatorsLoading && (
            <div className="calving-page__loading">Carregando indicadores...</div>
          )}

          {!indicatorsLoading && !indicators && (
            <div className="calving-page__empty">
              <BarChart3 size={48} aria-hidden="true" />
              <h2>Sem dados suficientes</h2>
              <p>Registre eventos de parto para visualizar os indicadores.</p>
            </div>
          )}

          {!indicatorsLoading && indicators && (
            <div className="calving-page__indicators">
              <div className="calving-page__stat-card">
                <span className="calving-page__stat-label">Total de partos</span>
                <span className="calving-page__stat-value calving-page__stat-value--primary">
                  {indicators.totalBirths}
                </span>
              </div>
              <div className="calving-page__stat-card">
                <span className="calving-page__stat-label">Total de abortos</span>
                <span className="calving-page__stat-value calving-page__stat-value--error">
                  {indicators.totalAbortions}
                </span>
              </div>
              <div className="calving-page__stat-card">
                <span className="calving-page__stat-label">Taxa de natimortos</span>
                <span className="calving-page__stat-value">
                  {(indicators.stillbornRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="calving-page__stat-card">
                <span className="calving-page__stat-label">Peso médio ao nascer</span>
                <span className="calving-page__stat-value calving-page__stat-value--mono">
                  {indicators.avgBirthWeightKg != null
                    ? `${indicators.avgBirthWeightKg.toFixed(1)} kg`
                    : '—'}
                </span>
              </div>
              <div className="calving-page__stat-card">
                <span className="calving-page__stat-label">Taxa de gêmeos</span>
                <span className="calving-page__stat-value">
                  {(indicators.twinRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <CalvingModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />
    </section>
  );
}
