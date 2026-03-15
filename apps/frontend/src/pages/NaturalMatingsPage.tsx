import { useState, useCallback, useRef } from 'react';
import {
  Plus,
  AlertCircle,
  AlertTriangle,
  Pencil,
  Trash2,
  Eye,
  Beef,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Calendar,
  Clock,
  Users,
  BarChart3,
  Heart,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import {
  useNaturalMatings,
  useOverstayAlerts,
  useMatingIndicators,
  useMatingDetail,
} from '@/hooks/useNaturalMatings';
import type { NaturalMatingItem } from '@/types/natural-mating';
import NaturalMatingModal from '@/components/natural-matings/NaturalMatingModal';
import { api } from '@/services/api';
import './NaturalMatingsPage.css';

type Tab = 'montas' | 'indicadores';

function getDaysInLot(entryDate: string, exitDate: string | null): number {
  const entry = new Date(entryDate);
  const end = exitDate ? new Date(exitDate) : new Date();
  return Math.floor((end.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
}

function formatBullDisplay(m: NaturalMatingItem): { text: string; isUnknown: boolean } {
  if (m.bullName) {
    return { text: m.bullName, isUnknown: false };
  }
  if (m.bullBreedName) {
    return { text: `Touro desconhecido \u2014 ${m.bullBreedName}`, isUnknown: true };
  }
  return { text: 'Touro desconhecido', isUnknown: true };
}

export default function NaturalMatingsPage() {
  const { selectedFarm } = useFarmContext();

  // ─── State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('montas');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editMating, setEditMating] = useState<NaturalMatingItem | null>(null);
  const [detailMatingId, setDetailMatingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const farmId = selectedFarm?.id ?? null;

  // ─── Data ───────────────────────────────────────────────
  const { matings, total, isLoading, error, refetch } = useNaturalMatings({
    farmId,
    page,
    limit: 20,
  });
  const { alerts, refetch: refetchAlerts } = useOverstayAlerts(farmId);
  const { indicators, refetch: refetchIndicators } = useMatingIndicators(farmId);
  const { detail } = useMatingDetail(farmId, detailMatingId);

  const totalPages = Math.ceil(total / 20) || 1;

  // ─── Reset page on farm change ────────────────────────────
  const prevFarmIdRef = useRef(farmId);
  if (prevFarmIdRef.current !== farmId) {
    prevFarmIdRef.current = farmId;
    if (page !== 1) setPage(1);
    if (detailMatingId) setDetailMatingId(null);
  }

  // ─── Callbacks ──────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setEditMating(null);
    setSuccessMsg(editMating ? 'Monta atualizada com sucesso' : 'Monta registrada com sucesso');
    void refetch();
    void refetchAlerts();
    void refetchIndicators();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, refetchAlerts, refetchIndicators, editMating]);

  const handleEdit = useCallback((m: NaturalMatingItem) => {
    setEditMating(m);
    setShowModal(true);
  }, []);

  const handleViewDetail = useCallback((m: NaturalMatingItem) => {
    setDetailMatingId((prev) => (prev === m.id ? null : m.id));
  }, []);

  const handleDelete = useCallback(
    async (m: NaturalMatingItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (
        !window.confirm('Excluir este registro de monta natural? Esta acao nao pode ser desfeita.')
      )
        return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/natural-matings/${m.id}`);
        setSuccessMsg('Monta excluida com sucesso');
        setDetailMatingId(null);
        void refetch();
        void refetchAlerts();
        void refetchIndicators();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir monta.');
      }
    },
    [refetch, refetchAlerts, refetchIndicators, selectedFarm],
  );

  // ─── No farm selected ──────────────────────────────────
  if (!selectedFarm) {
    return (
      <section className="natural-matings-page">
        <div className="natural-matings-page__empty">
          <Beef size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver as montas naturais.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="natural-matings-page">
      {/* Header */}
      <header className="natural-matings-page__header">
        <div>
          <h1>Monta natural</h1>
          <p>Registros de monta natural do rebanho de {selectedFarm.name}</p>
        </div>
        {activeTab === 'montas' && (
          <div className="natural-matings-page__actions">
            <button
              type="button"
              className="natural-matings-page__btn-primary"
              onClick={() => {
                setEditMating(null);
                setShowModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" />
              Nova monta
            </button>
          </div>
        )}
      </header>

      {/* Success */}
      {successMsg && (
        <div className="natural-matings-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Errors */}
      {(error || deleteError) && (
        <div className="natural-matings-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {/* Tabs */}
      <div className="natural-matings-page__tabs" role="tablist" aria-label="Abas de monta natural">
        <button
          type="button"
          role="tab"
          className={`natural-matings-page__tab ${activeTab === 'montas' ? 'natural-matings-page__tab--active' : ''}`}
          aria-selected={activeTab === 'montas'}
          onClick={() => setActiveTab('montas')}
        >
          <Heart size={16} aria-hidden="true" />
          Montas
        </button>
        <button
          type="button"
          role="tab"
          className={`natural-matings-page__tab ${activeTab === 'indicadores' ? 'natural-matings-page__tab--active' : ''}`}
          aria-selected={activeTab === 'indicadores'}
          onClick={() => setActiveTab('indicadores')}
        >
          <BarChart3 size={16} aria-hidden="true" />
          Indicadores
        </button>
      </div>

      {/* ═══ TAB: Montas ═══ */}
      {activeTab === 'montas' && (
        <>
          {/* Overstay Alerts */}
          {alerts.length > 0 && (
            <div
              className="natural-matings-page__alerts"
              role="region"
              aria-label="Alertas de permanencia"
            >
              {alerts.map((alert) => (
                <div key={alert.matingId} className="natural-matings-page__alert-card">
                  <AlertTriangle
                    size={20}
                    aria-hidden="true"
                    className="natural-matings-page__alert-icon"
                  />
                  <span className="natural-matings-page__alert-text">
                    <strong>{alert.bullName || 'Touro desconhecido'}</strong> excedeu o tempo maximo
                    de permanencia ({alert.animalCount}{' '}
                    {alert.animalCount === 1 ? 'femea' : 'femeas'})
                  </span>
                  <span className="natural-matings-page__alert-days">
                    {alert.daysInLot}/{alert.maxStayDays} dias
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="natural-matings-page__loading">Carregando montas naturais...</div>
          )}

          {/* Empty */}
          {!isLoading && matings.length === 0 && (
            <div className="natural-matings-page__empty">
              <Beef size={48} aria-hidden="true" />
              <h2>Nenhuma monta natural registrada</h2>
              <p>Registre montas naturais usando o botao acima.</p>
            </div>
          )}

          {/* Cards */}
          {!isLoading && matings.length > 0 && (
            <div className="natural-matings-page__grid">
              {matings.map((m) => {
                const bull = formatBullDisplay(m);
                const daysInLot = getDaysInLot(m.entryDate, m.exitDate);
                const isExpanded = detailMatingId === m.id;

                return (
                  <div
                    key={m.id}
                    className={`natural-matings-page__card ${m.isOverstay ? 'natural-matings-page__card--overstay' : ''}`}
                  >
                    <div className="natural-matings-page__card-header">
                      <div>
                        <h3
                          className={`natural-matings-page__card-title ${bull.isUnknown ? 'natural-matings-page__card-title--unknown' : ''}`}
                        >
                          {bull.text}
                        </h3>
                        <p className="natural-matings-page__card-subtitle">
                          {m.paternityTypeLabel}
                        </p>
                      </div>
                      <div className="natural-matings-page__card-actions">
                        <button
                          type="button"
                          className="natural-matings-page__card-btn"
                          onClick={() => handleViewDetail(m)}
                          aria-label={`Ver detalhes da monta de ${bull.text}`}
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="natural-matings-page__card-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(m);
                          }}
                          aria-label={`Editar monta de ${bull.text}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="natural-matings-page__card-btn natural-matings-page__card-btn--delete"
                          onClick={(e) => void handleDelete(m, e)}
                          aria-label={`Excluir monta de ${bull.text}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="natural-matings-page__card-tags">
                      <span
                        className={`natural-matings-page__tag ${
                          m.reason === 'POST_IATF_REPASSE'
                            ? 'natural-matings-page__tag--repasse'
                            : 'natural-matings-page__tag--direct'
                        }`}
                      >
                        {m.reasonLabel}
                      </span>
                      {m.isOverstay && (
                        <span className="natural-matings-page__tag natural-matings-page__tag--overstay">
                          <AlertTriangle size={12} aria-hidden="true" />
                          Permanencia excedida
                        </span>
                      )}
                      <span className="natural-matings-page__tag natural-matings-page__tag--animals">
                        <Users size={12} aria-hidden="true" />
                        {m.animalCount} {m.animalCount === 1 ? 'femea' : 'femeas'}
                      </span>
                    </div>

                    <div className="natural-matings-page__card-details">
                      <span className="natural-matings-page__detail">
                        <Calendar size={14} aria-hidden="true" />
                        {new Date(m.entryDate).toLocaleDateString('pt-BR')}
                      </span>
                      {m.exitDate && (
                        <span className="natural-matings-page__detail">
                          <Calendar size={14} aria-hidden="true" />
                          Saida: {new Date(m.exitDate).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      <span className="natural-matings-page__detail natural-matings-page__detail--mono">
                        <Clock size={14} aria-hidden="true" />
                        {daysInLot} {daysInLot === 1 ? 'dia' : 'dias'}
                        {m.maxStayDays ? ` / ${m.maxStayDays}` : ''}
                      </span>
                    </div>

                    {m.notes && (
                      <p className="natural-matings-page__card-subtitle" style={{ marginTop: 8 }}>
                        {m.notes}
                      </p>
                    )}

                    {/* Expandable detail panel */}
                    {isExpanded && detail && detail.id === m.id && (
                      <div className="natural-matings-page__detail-panel">
                        <h4>Femeas no lote ({detail.animals.length})</h4>
                        <ul className="natural-matings-page__animal-list">
                          {detail.animals.map((a) => (
                            <li key={a.id} className="natural-matings-page__animal-item">
                              {a.earTag} {a.animalName ? `\u2014 ${a.animalName}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="natural-matings-page__pagination" aria-label="Paginacao">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Pagina anterior"
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
                aria-label="Proxima pagina"
              >
                Proxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* ═══ TAB: Indicadores ═══ */}
      {activeTab === 'indicadores' && (
        <div className="natural-matings-page__indicators">
          <div className="natural-matings-page__indicator-card">
            <div className="natural-matings-page__indicator-icon">
              <Heart size={24} aria-hidden="true" />
            </div>
            <p className="natural-matings-page__indicator-value">
              {indicators?.totalNaturalMatings ?? 0}
            </p>
            <p className="natural-matings-page__indicator-label">Total de montas naturais</p>
          </div>

          <div className="natural-matings-page__indicator-card">
            <div className="natural-matings-page__indicator-icon">
              <Beef size={24} aria-hidden="true" />
            </div>
            <p className="natural-matings-page__indicator-value">
              {indicators?.activeBullsInLot ?? 0}
            </p>
            <p className="natural-matings-page__indicator-label">Touros ativos no lote</p>
          </div>

          <div className="natural-matings-page__indicator-card">
            <div className="natural-matings-page__indicator-icon">
              <Clock size={24} aria-hidden="true" />
            </div>
            <p className="natural-matings-page__indicator-value">
              {indicators?.avgStayDays != null ? `${indicators.avgStayDays.toFixed(1)}` : '\u2014'}
            </p>
            <p className="natural-matings-page__indicator-label">Media de permanencia (dias)</p>
          </div>
        </div>
      )}

      {/* Modal */}
      <NaturalMatingModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditMating(null);
        }}
        mating={editMating}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />
    </section>
  );
}
