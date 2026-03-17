import { useState, useCallback } from 'react';
import {
  Plus,
  AlertCircle,
  Pencil,
  Trash2,
  Container,
  CheckCircle,
  Calendar,
  Thermometer,
  Droplets,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Upload,
  FlaskConical,
  TrendingUp,
  DollarSign,
  FileText,
  MapPin,
  Hash,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import {
  useTanks,
  useCollections,
  useReconciliation,
  useMonthlyReport,
} from '@/hooks/useMilkTanks';
import type { TankItem, CollectionItem } from '@/types/milk-tank';
import TankModal from '@/components/milk-tanks/TankModal';
import CollectionModal from '@/components/milk-tanks/CollectionModal';
import { api } from '@/services/api';
import './MilkTanksPage.css';

type TabKey = 'tanks' | 'collections' | 'reconciliation' | 'report';

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: number | null, decimals = 1): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function MilkTanksPage() {
  const { selectedFarm } = useFarmContext();

  const [activeTab, setActiveTab] = useState<TabKey>('tanks');
  const [showTankModal, setShowTankModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [selectedTank, setSelectedTank] = useState<TankItem | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<CollectionItem | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [collectionsPage, setCollectionsPage] = useState(1);
  const [reportMonth, setReportMonth] = useState(getCurrentMonth());

  const farmId = selectedFarm?.id ?? null;

  const {
    tanks,
    isLoading: tanksLoading,
    error: tanksError,
    refetch: refetchTanks,
  } = useTanks({ farmId });
  const {
    collections,
    meta: collectionsMeta,
    isLoading: collectionsLoading,
    error: collectionsError,
    refetch: refetchCollections,
  } = useCollections({ farmId, page: collectionsPage });
  const {
    rows: reconciliationRows,
    isLoading: reconLoading,
    error: reconError,
    refetch: refetchRecon,
  } = useReconciliation({ farmId });
  const {
    report,
    isLoading: reportLoading,
    error: reportError,
  } = useMonthlyReport({ farmId, month: reportMonth });

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  const handleTankSuccess = useCallback(() => {
    setShowTankModal(false);
    setSelectedTank(null);
    showSuccess(selectedTank ? 'Tanque atualizado com sucesso' : 'Tanque cadastrado com sucesso');
    void refetchTanks();
  }, [refetchTanks, selectedTank, showSuccess]);

  const handleCollectionSuccess = useCallback(() => {
    setShowCollectionModal(false);
    setSelectedCollection(null);
    showSuccess(
      selectedCollection ? 'Coleta atualizada com sucesso' : 'Coleta registrada com sucesso',
    );
    void refetchCollections();
    void refetchRecon();
  }, [refetchCollections, refetchRecon, selectedCollection, showSuccess]);

  const handleEditTank = useCallback((t: TankItem) => {
    setSelectedTank(t);
    setShowTankModal(true);
  }, []);

  const handleDeleteTank = useCallback(
    async (t: TankItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm(`Excluir o tanque "${t.name}"? Esta ação não pode ser desfeita.`)) return;
      try {
        await api.delete(`/org/farms/${farmId}/milk-tanks/${t.id}`);
        showSuccess('Tanque excluído com sucesso');
        void refetchTanks();
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir tanque.');
      }
    },
    [farmId, refetchTanks, showSuccess],
  );

  const handleEditCollection = useCallback((c: CollectionItem) => {
    setSelectedCollection(c);
    setShowCollectionModal(true);
  }, []);

  const handleDeleteCollection = useCallback(
    async (c: CollectionItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm('Excluir esta coleta? Esta ação não pode ser desfeita.')) return;
      try {
        await api.delete(`/org/farms/${farmId}/milk-collections/${c.id}`);
        showSuccess('Coleta excluída com sucesso');
        void refetchCollections();
        void refetchRecon();
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir coleta.');
      }
    },
    [farmId, refetchCollections, refetchRecon, showSuccess],
  );

  const handleUploadTicket = useCallback(
    async (c: CollectionItem) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const fd = new FormData();
          fd.append('ticket', file);
          await api.postFormData(`/org/farms/${farmId}/milk-collections/${c.id}/ticket`, fd);
          showSuccess('Foto do ticket enviada com sucesso');
          void refetchCollections();
        } catch (err: unknown) {
          setDeleteError(err instanceof Error ? err.message : 'Erro ao enviar foto do ticket.');
        }
      };
      input.click();
    },
    [farmId, refetchCollections, showSuccess],
  );

  if (!selectedFarm) {
    return (
      <section className="milk-tanks-page">
        <div className="milk-tanks-page__empty">
          <Container size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para gerenciar tanques e entregas de leite.</p>
        </div>
      </section>
    );
  }

  const globalError = tanksError || collectionsError || reconError || reportError || deleteError;

  return (
    <section className="milk-tanks-page">
      <header className="milk-tanks-page__header">
        <div>
          <h1>Tanque e entregas</h1>
          <p>Gestão de tanque de resfriamento e coletas de leite de {selectedFarm.name}</p>
        </div>
        <div className="milk-tanks-page__actions">
          {activeTab === 'tanks' && (
            <button
              type="button"
              className="milk-tanks-page__btn-primary"
              onClick={() => {
                setSelectedTank(null);
                setShowTankModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" />
              Novo tanque
            </button>
          )}
          {activeTab === 'collections' && (
            <button
              type="button"
              className="milk-tanks-page__btn-primary"
              onClick={() => {
                setSelectedCollection(null);
                setShowCollectionModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" />
              Nova coleta
            </button>
          )}
        </div>
      </header>

      {successMsg && (
        <div className="milk-tanks-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}
      {globalError && (
        <div className="milk-tanks-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {globalError}
        </div>
      )}

      {/* Tabs */}
      <nav className="milk-tanks-page__tabs" aria-label="Abas de tanque e entregas">
        <button
          type="button"
          className={`milk-tanks-page__tab ${activeTab === 'tanks' ? 'milk-tanks-page__tab--active' : ''}`}
          onClick={() => setActiveTab('tanks')}
          aria-selected={activeTab === 'tanks'}
          role="tab"
        >
          <Container size={16} aria-hidden="true" />
          Tanques
        </button>
        <button
          type="button"
          className={`milk-tanks-page__tab ${activeTab === 'collections' ? 'milk-tanks-page__tab--active' : ''}`}
          onClick={() => setActiveTab('collections')}
          aria-selected={activeTab === 'collections'}
          role="tab"
        >
          <Droplets size={16} aria-hidden="true" />
          Coletas
        </button>
        <button
          type="button"
          className={`milk-tanks-page__tab ${activeTab === 'reconciliation' ? 'milk-tanks-page__tab--active' : ''}`}
          onClick={() => setActiveTab('reconciliation')}
          aria-selected={activeTab === 'reconciliation'}
          role="tab"
        >
          <TrendingUp size={16} aria-hidden="true" />
          Conciliação
        </button>
        <button
          type="button"
          className={`milk-tanks-page__tab ${activeTab === 'report' ? 'milk-tanks-page__tab--active' : ''}`}
          onClick={() => setActiveTab('report')}
          aria-selected={activeTab === 'report'}
          role="tab"
        >
          <FileText size={16} aria-hidden="true" />
          Relatório mensal
        </button>
      </nav>

      {/* ── Tab: Tanques ──────────────────────────────────────────── */}
      {activeTab === 'tanks' && (
        <div className="milk-tanks-page__tab-content">
          {tanksLoading && <div className="milk-tanks-page__loading">Carregando tanques...</div>}
          {!tanksLoading && tanks.length === 0 && (
            <div className="milk-tanks-page__empty">
              <Container size={48} aria-hidden="true" />
              <h2>Nenhum tanque cadastrado</h2>
              <p>Cadastre o primeiro tanque de resfriamento usando o botão acima.</p>
            </div>
          )}
          {!tanksLoading && tanks.length > 0 && (
            <div className="milk-tanks-page__grid">
              {tanks.map((t) => (
                <div
                  key={t.id}
                  className={`milk-tanks-page__card ${!t.isActive ? 'milk-tanks-page__card--inactive' : ''}`}
                  onClick={() => handleEditTank(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEditTank(t);
                    }
                  }}
                >
                  <div className="milk-tanks-page__card-header">
                    <div>
                      <h3 className="milk-tanks-page__card-title">{t.name}</h3>
                      {!t.isActive && (
                        <span className="milk-tanks-page__tag milk-tanks-page__tag--inactive">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="milk-tanks-page__card-actions">
                      <button
                        type="button"
                        className="milk-tanks-page__card-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTank(t);
                        }}
                        aria-label={`Editar tanque ${t.name}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="milk-tanks-page__card-btn milk-tanks-page__card-btn--delete"
                        onClick={(e) => void handleDeleteTank(t, e)}
                        aria-label={`Excluir tanque ${t.name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="milk-tanks-page__tank-capacity">
                    <div className="milk-tanks-page__capacity-label">
                      <span>Capacidade</span>
                      <span className="milk-tanks-page__capacity-value">
                        {formatNumber(t.capacityLiters, 0)} L
                      </span>
                    </div>
                    <div
                      className="milk-tanks-page__capacity-bar"
                      role="progressbar"
                      aria-valuenow={0}
                      aria-valuemin={0}
                      aria-valuemax={t.capacityLiters}
                      aria-label={`Capacidade do tanque: ${t.capacityLiters} litros`}
                    >
                      <div className="milk-tanks-page__capacity-fill" style={{ width: '0%' }} />
                    </div>
                  </div>

                  <div className="milk-tanks-page__card-details">
                    {t.location && (
                      <span className="milk-tanks-page__detail">
                        <MapPin size={14} aria-hidden="true" />
                        {t.location}
                      </span>
                    )}
                    {t.serialNumber && (
                      <span className="milk-tanks-page__detail">
                        <Hash size={14} aria-hidden="true" />
                        {t.serialNumber}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Coletas ──────────────────────────────────────────── */}
      {activeTab === 'collections' && (
        <div className="milk-tanks-page__tab-content">
          {collectionsLoading && (
            <div className="milk-tanks-page__loading">Carregando coletas...</div>
          )}
          {!collectionsLoading && collections.length === 0 && (
            <div className="milk-tanks-page__empty">
              <Droplets size={48} aria-hidden="true" />
              <h2>Nenhuma coleta registrada</h2>
              <p>Registre a primeira coleta de leite usando o botão acima.</p>
            </div>
          )}
          {!collectionsLoading && collections.length > 0 && (
            <div className="milk-tanks-page__grid">
              {collections.map((c) => (
                <div
                  key={c.id}
                  className="milk-tanks-page__card"
                  onClick={() => handleEditCollection(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEditCollection(c);
                    }
                  }}
                >
                  <div className="milk-tanks-page__card-header">
                    <div>
                      <h3 className="milk-tanks-page__card-title">{c.dairyCompany}</h3>
                      <p className="milk-tanks-page__card-subtitle">
                        {new Date(c.collectionDate).toLocaleDateString('pt-BR')}
                        {c.collectionTime ? ` às ${c.collectionTime}` : ''}
                      </p>
                    </div>
                    <div className="milk-tanks-page__card-actions">
                      <button
                        type="button"
                        className="milk-tanks-page__card-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleUploadTicket(c);
                        }}
                        aria-label="Enviar foto do ticket"
                      >
                        <Upload size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="milk-tanks-page__card-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCollection(c);
                        }}
                        aria-label={`Editar coleta de ${c.dairyCompany}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="milk-tanks-page__card-btn milk-tanks-page__card-btn--delete"
                        onClick={(e) => void handleDeleteCollection(c, e)}
                        aria-label={`Excluir coleta de ${c.dairyCompany}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Volume - large mono */}
                  <div className="milk-tanks-page__collection-volume">
                    <Droplets size={20} aria-hidden="true" />
                    <span className="milk-tanks-page__volume-value">
                      {formatNumber(c.volumeLiters, 1)} L
                    </span>
                  </div>

                  {/* Tags row */}
                  <div className="milk-tanks-page__card-tags">
                    {c.tankName && (
                      <span className="milk-tanks-page__tag milk-tanks-page__tag--tank">
                        <Container size={12} aria-hidden="true" />
                        {c.tankName}
                      </span>
                    )}
                    {c.sampleCollected && (
                      <span className="milk-tanks-page__tag milk-tanks-page__tag--sample">
                        <FlaskConical size={12} aria-hidden="true" />
                        Amostra
                      </span>
                    )}
                    {c.divergenceAlert && (
                      <span className="milk-tanks-page__tag milk-tanks-page__tag--divergence">
                        <AlertTriangle size={12} aria-hidden="true" />
                        Divergência{' '}
                        {c.divergencePercent !== null
                          ? `${formatNumber(c.divergencePercent, 1)}%`
                          : ''}
                      </span>
                    )}
                    {c.ticketPhotoUrl && (
                      <span className="milk-tanks-page__tag milk-tanks-page__tag--ticket">
                        <FileText size={12} aria-hidden="true" />
                        Ticket
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="milk-tanks-page__card-details">
                    {c.driverName && (
                      <span className="milk-tanks-page__detail">{c.driverName}</span>
                    )}
                    {c.milkTemperature !== null && (
                      <span className="milk-tanks-page__detail">
                        <Thermometer size={14} aria-hidden="true" />
                        {formatNumber(c.milkTemperature, 1)} °C
                      </span>
                    )}
                    {c.ticketNumber && (
                      <span className="milk-tanks-page__detail">
                        <Hash size={14} aria-hidden="true" />
                        {c.ticketNumber}
                      </span>
                    )}
                  </div>

                  {/* Financial */}
                  {(c.pricePerLiter !== null || c.grossValue !== null || c.netValue !== null) && (
                    <div className="milk-tanks-page__card-financial">
                      {c.pricePerLiter !== null && (
                        <span className="milk-tanks-page__financial-item">
                          Preço/L: <strong>{formatCurrency(c.pricePerLiter)}</strong>
                        </span>
                      )}
                      {c.grossValue !== null && (
                        <span className="milk-tanks-page__financial-item">
                          Bruto: <strong>{formatCurrency(c.grossValue)}</strong>
                        </span>
                      )}
                      {c.netValue !== null && (
                        <span className="milk-tanks-page__financial-item milk-tanks-page__financial-item--net">
                          Líquido: <strong>{formatCurrency(c.netValue)}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {collectionsMeta && collectionsMeta.totalPages > 1 && (
            <nav className="milk-tanks-page__pagination" aria-label="Paginação de coletas">
              <button
                type="button"
                onClick={() => setCollectionsPage((p) => Math.max(1, p - 1))}
                disabled={collectionsPage <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span>
                {collectionsPage} de {collectionsMeta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCollectionsPage((p) => p + 1)}
                disabled={collectionsPage >= collectionsMeta.totalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      )}

      {/* ── Tab: Conciliação ──────────────────────────────────────── */}
      {activeTab === 'reconciliation' && (
        <div className="milk-tanks-page__tab-content">
          {reconLoading && (
            <div className="milk-tanks-page__loading">Carregando conciliação...</div>
          )}
          {!reconLoading && reconciliationRows.length === 0 && (
            <div className="milk-tanks-page__empty">
              <TrendingUp size={48} aria-hidden="true" />
              <h2>Sem dados de conciliação</h2>
              <p>Registre ordenhas e coletas para comparar a produção com o volume coletado.</p>
            </div>
          )}
          {!reconLoading && reconciliationRows.length > 0 && (
            <div className="milk-tanks-page__table-wrapper">
              <table className="milk-tanks-page__table">
                <caption className="sr-only">Conciliação produção vs coleta de leite</caption>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Produção (L)</th>
                    <th scope="col">Volume tanque (L)</th>
                    <th scope="col">Coletado (L)</th>
                    <th scope="col">Divergência</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationRows.map((r) => (
                    <tr
                      key={r.date}
                      className={
                        r.alert ? 'milk-tanks-page__row--alert' : 'milk-tanks-page__row--ok'
                      }
                    >
                      <td>{new Date(r.date).toLocaleDateString('pt-BR')}</td>
                      <td className="milk-tanks-page__td-mono">
                        {formatNumber(r.productionLiters, 1)}
                      </td>
                      <td className="milk-tanks-page__td-mono">
                        {r.tankVolume !== null ? formatNumber(r.tankVolume, 1) : '—'}
                      </td>
                      <td className="milk-tanks-page__td-mono">
                        {formatNumber(r.collectedLiters, 1)}
                      </td>
                      <td>
                        <span
                          className={`milk-tanks-page__divergence-badge ${r.alert ? 'milk-tanks-page__divergence-badge--alert' : 'milk-tanks-page__divergence-badge--ok'}`}
                        >
                          {r.alert && <AlertTriangle size={14} aria-hidden="true" />}
                          {formatNumber(r.divergencePercent, 1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile cards for reconciliation */}
          {!reconLoading && reconciliationRows.length > 0 && (
            <div className="milk-tanks-page__recon-cards">
              {reconciliationRows.map((r) => (
                <div
                  key={r.date}
                  className={`milk-tanks-page__recon-card ${r.alert ? 'milk-tanks-page__recon-card--alert' : 'milk-tanks-page__recon-card--ok'}`}
                >
                  <div className="milk-tanks-page__recon-card-header">
                    <span className="milk-tanks-page__recon-date">
                      <Calendar size={14} aria-hidden="true" />
                      {new Date(r.date).toLocaleDateString('pt-BR')}
                    </span>
                    <span
                      className={`milk-tanks-page__divergence-badge ${r.alert ? 'milk-tanks-page__divergence-badge--alert' : 'milk-tanks-page__divergence-badge--ok'}`}
                    >
                      {r.alert && <AlertTriangle size={14} aria-hidden="true" />}
                      {formatNumber(r.divergencePercent, 1)}%
                    </span>
                  </div>
                  <div className="milk-tanks-page__recon-card-values">
                    <div>
                      <span className="milk-tanks-page__recon-label">Produção</span>
                      <span className="milk-tanks-page__recon-value">
                        {formatNumber(r.productionLiters, 1)} L
                      </span>
                    </div>
                    <div>
                      <span className="milk-tanks-page__recon-label">Tanque</span>
                      <span className="milk-tanks-page__recon-value">
                        {r.tankVolume !== null ? `${formatNumber(r.tankVolume, 1)} L` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="milk-tanks-page__recon-label">Coletado</span>
                      <span className="milk-tanks-page__recon-value">
                        {formatNumber(r.collectedLiters, 1)} L
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Relatório mensal ─────────────────────────────────── */}
      {activeTab === 'report' && (
        <div className="milk-tanks-page__tab-content">
          <div className="milk-tanks-page__report-controls">
            <label htmlFor="report-month" className="milk-tanks-page__month-label">
              Mês de referência
            </label>
            <input
              id="report-month"
              type="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="milk-tanks-page__month-input"
            />
          </div>

          {reportLoading && <div className="milk-tanks-page__loading">Carregando relatório...</div>}

          {!reportLoading && !report && (
            <div className="milk-tanks-page__empty">
              <FileText size={48} aria-hidden="true" />
              <h2>Sem dados para {getMonthLabel(reportMonth)}</h2>
              <p>Nenhuma coleta registrada neste mês. Selecione outro período.</p>
            </div>
          )}

          {!reportLoading && report && (
            <>
              {/* Summary cards */}
              <div className="milk-tanks-page__summary-grid">
                <div className="milk-tanks-page__summary-card">
                  <Droplets
                    size={24}
                    aria-hidden="true"
                    className="milk-tanks-page__summary-icon"
                  />
                  <div>
                    <span className="milk-tanks-page__summary-label">Volume total</span>
                    <span className="milk-tanks-page__summary-value">
                      {formatNumber(report.totalVolume, 0)} L
                    </span>
                  </div>
                </div>
                <div className="milk-tanks-page__summary-card">
                  <Calendar
                    size={24}
                    aria-hidden="true"
                    className="milk-tanks-page__summary-icon"
                  />
                  <div>
                    <span className="milk-tanks-page__summary-label">Total de coletas</span>
                    <span className="milk-tanks-page__summary-value">
                      {report.totalCollections}
                    </span>
                  </div>
                </div>
                <div className="milk-tanks-page__summary-card">
                  <DollarSign
                    size={24}
                    aria-hidden="true"
                    className="milk-tanks-page__summary-icon"
                  />
                  <div>
                    <span className="milk-tanks-page__summary-label">Preço médio/L</span>
                    <span className="milk-tanks-page__summary-value">
                      {report.avgPricePerLiter !== null
                        ? formatCurrency(report.avgPricePerLiter)
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="milk-tanks-page__summary-card">
                  <TrendingUp
                    size={24}
                    aria-hidden="true"
                    className="milk-tanks-page__summary-icon"
                  />
                  <div>
                    <span className="milk-tanks-page__summary-label">Receita bruta</span>
                    <span className="milk-tanks-page__summary-value">
                      {formatCurrency(report.grossTotal)}
                    </span>
                  </div>
                </div>
                <div className="milk-tanks-page__summary-card">
                  <AlertTriangle
                    size={24}
                    aria-hidden="true"
                    className="milk-tanks-page__summary-icon milk-tanks-page__summary-icon--warn"
                  />
                  <div>
                    <span className="milk-tanks-page__summary-label">Descontos</span>
                    <span className="milk-tanks-page__summary-value milk-tanks-page__summary-value--discount">
                      {formatCurrency(report.discountsTotal)}
                    </span>
                  </div>
                </div>
                <div className="milk-tanks-page__summary-card milk-tanks-page__summary-card--highlight">
                  <DollarSign
                    size={24}
                    aria-hidden="true"
                    className="milk-tanks-page__summary-icon milk-tanks-page__summary-icon--primary"
                  />
                  <div>
                    <span className="milk-tanks-page__summary-label">Receita líquida</span>
                    <span className="milk-tanks-page__summary-value milk-tanks-page__summary-value--net">
                      {formatCurrency(report.netTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Collections breakdown table */}
              {report.collections.length > 0 && (
                <div className="milk-tanks-page__table-wrapper">
                  <table className="milk-tanks-page__table">
                    <caption className="sr-only">
                      Detalhamento de coletas em {getMonthLabel(reportMonth)}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Laticínio</th>
                        <th scope="col">Volume (L)</th>
                        <th scope="col">Preço/L</th>
                        <th scope="col">Bruto</th>
                        <th scope="col">Descontos</th>
                        <th scope="col">Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.collections.map((c) => {
                        const totalDisc = (c.qualityDiscount ?? 0) + (c.freightDiscount ?? 0);
                        return (
                          <tr key={c.id}>
                            <td>{new Date(c.collectionDate).toLocaleDateString('pt-BR')}</td>
                            <td>{c.dairyCompany}</td>
                            <td className="milk-tanks-page__td-mono">
                              {formatNumber(c.volumeLiters, 1)}
                            </td>
                            <td className="milk-tanks-page__td-mono">
                              {c.pricePerLiter !== null ? formatCurrency(c.pricePerLiter) : '—'}
                            </td>
                            <td className="milk-tanks-page__td-mono">
                              {c.grossValue !== null ? formatCurrency(c.grossValue) : '—'}
                            </td>
                            <td className="milk-tanks-page__td-mono">
                              {totalDisc > 0 ? formatCurrency(totalDisc) : '—'}
                            </td>
                            <td className="milk-tanks-page__td-mono milk-tanks-page__td-bold">
                              {c.netValue !== null ? formatCurrency(c.netValue) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mobile cards for report collections */}
              {report.collections.length > 0 && (
                <div className="milk-tanks-page__report-cards">
                  {report.collections.map((c) => {
                    const totalDisc = (c.qualityDiscount ?? 0) + (c.freightDiscount ?? 0);
                    return (
                      <div key={c.id} className="milk-tanks-page__report-card">
                        <div className="milk-tanks-page__report-card-header">
                          <span>{new Date(c.collectionDate).toLocaleDateString('pt-BR')}</span>
                          <span className="milk-tanks-page__report-card-dairy">
                            {c.dairyCompany}
                          </span>
                        </div>
                        <div className="milk-tanks-page__report-card-values">
                          <div>
                            <span className="milk-tanks-page__recon-label">Volume</span>
                            <span className="milk-tanks-page__recon-value">
                              {formatNumber(c.volumeLiters, 1)} L
                            </span>
                          </div>
                          <div>
                            <span className="milk-tanks-page__recon-label">Bruto</span>
                            <span className="milk-tanks-page__recon-value">
                              {c.grossValue !== null ? formatCurrency(c.grossValue) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="milk-tanks-page__recon-label">Desc.</span>
                            <span className="milk-tanks-page__recon-value">
                              {totalDisc > 0 ? formatCurrency(totalDisc) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="milk-tanks-page__recon-label">Líquido</span>
                            <span className="milk-tanks-page__recon-value milk-tanks-page__td-bold">
                              {c.netValue !== null ? formatCurrency(c.netValue) : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <TankModal
        isOpen={showTankModal}
        onClose={() => {
          setShowTankModal(false);
          setSelectedTank(null);
        }}
        tank={selectedTank}
        farmId={selectedFarm.id}
        onSuccess={handleTankSuccess}
      />
      <CollectionModal
        isOpen={showCollectionModal}
        onClose={() => {
          setShowCollectionModal(false);
          setSelectedCollection(null);
        }}
        collection={selectedCollection}
        farmId={selectedFarm.id}
        tanks={tanks}
        onSuccess={handleCollectionSuccess}
      />
    </section>
  );
}
