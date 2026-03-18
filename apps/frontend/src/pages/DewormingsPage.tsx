import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  Droplet,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  FileText,
  Calendar,
  Clock,
  Activity,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useDewormings } from '@/hooks/useDewormings';
import type { DewormingItem } from '@/types/deworming';
import { ROTATION_STATUS_CONFIG } from '@/types/deworming';
import DewormingModal from '@/components/dewormings/DewormingModal';
import BulkDewormingModal from '@/components/dewormings/BulkDewormingModal';
import CampaignReportModal from '@/components/dewormings/CampaignReportModal';
import { api } from '@/services/api';
import './DewormingsPage.css';

export default function DewormingsPage() {
  const { selectedFarm } = useFarmContext();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedDeworming, setSelectedDeworming] = useState<DewormingItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reportCampaignId, setReportCampaignId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { dewormings, meta, isLoading, error, refetch } = useDewormings({
    farmId: selectedFarm?.id ?? null,
    page,
    search: search || undefined,
  });

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setShowBulkModal(false);
    setSelectedDeworming(null);
    setSuccessMsg(
      selectedDeworming
        ? 'Vermifugação atualizada com sucesso'
        : 'Vermifugação registrada com sucesso',
    );
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, selectedDeworming]);

  const handleEdit = useCallback((d: DewormingItem) => {
    setSelectedDeworming(d);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (d: DewormingItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (
        !window.confirm('Excluir este registro de vermifugação? Esta ação não pode ser desfeita.')
      )
        return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/dewormings/${d.id}`);
        setSuccessMsg('Vermifugação excluída com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir vermifugação.');
      }
    },
    [refetch, selectedFarm],
  );

  if (!selectedFarm) {
    return (
      <section className="dewormings-page">
        <div className="dewormings-page__empty">
          <Droplet size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver as vermifugações.</p>
        </div>
      </section>
    );
  }

  const campaignIds = [
    ...new Set(dewormings.filter((d) => d.campaignId).map((d) => d.campaignId!)),
  ];

  return (
    <section className="dewormings-page">
      <header className="dewormings-page__header">
        <div>
          <h1>Vermifugações</h1>
          <p>Registros de vermifugação do rebanho de {selectedFarm.name}</p>
        </div>
        <div className="dewormings-page__actions">
          <button
            type="button"
            className="dewormings-page__btn-secondary"
            onClick={() => setShowBulkModal(true)}
          >
            <Layers size={20} aria-hidden="true" />
            Vermifugar lote
          </button>
          <button
            type="button"
            className="dewormings-page__btn-primary"
            onClick={() => {
              setSelectedDeworming(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Nova vermifugação
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="dewormings-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}
      {(error || deleteError) && (
        <div className="dewormings-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      <div className="dewormings-page__toolbar">
        <div className="dewormings-page__search">
          <Search size={16} aria-hidden="true" className="dewormings-page__search-icon" />
          <input
            type="text"
            placeholder="Buscar por animal, vermífugo ou responsável..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar vermifugações"
          />
        </div>
        {campaignIds.length > 0 && (
          <div className="dewormings-page__filter">
            <select
              onChange={(e) => {
                if (e.target.value) setReportCampaignId(e.target.value);
              }}
              value=""
              aria-label="Ver relatório de campanha"
            >
              <option value="">Relatórios de campanha</option>
              {campaignIds.map((cid) => (
                <option key={cid} value={cid}>
                  Campanha {cid.slice(0, 8)}...
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading && <div className="dewormings-page__loading">Carregando vermifugações...</div>}

      {!isLoading && dewormings.length === 0 && (
        <div className="dewormings-page__empty">
          <Droplet size={48} aria-hidden="true" />
          <h2>Nenhuma vermifugação registrada</h2>
          <p>Registre vermifugações individualmente ou em lote usando os botões acima.</p>
        </div>
      )}

      {!isLoading && dewormings.length > 0 && (
        <div className="dewormings-page__grid">
          {dewormings.map((d) => (
            <div
              key={d.id}
              className="dewormings-page__card"
              onClick={() => handleEdit(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEdit(d);
                }
              }}
            >
              <div className="dewormings-page__card-header">
                <div>
                  <h3 className="dewormings-page__card-title">
                    {d.animalEarTag} — {d.animalName || 'Sem nome'}
                  </h3>
                  <p className="dewormings-page__card-subtitle">{d.productName}</p>
                </div>
                <div className="dewormings-page__card-actions">
                  <button
                    type="button"
                    className="dewormings-page__card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(d);
                    }}
                    aria-label={`Editar vermifugação de ${d.animalEarTag}`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="dewormings-page__card-btn dewormings-page__card-btn--delete"
                    onClick={(e) => void handleDelete(d, e)}
                    aria-label={`Excluir vermifugação de ${d.animalEarTag}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="dewormings-page__card-tags">
                <span className="dewormings-page__tag dewormings-page__tag--route">
                  {d.administrationRouteLabel}
                </span>
                {d.chemicalGroup && (
                  <span className="dewormings-page__tag dewormings-page__tag--group">
                    {d.chemicalGroup}
                  </span>
                )}
                {d.rotationStatus && (
                  <span
                    className={`dewormings-page__tag dewormings-page__tag--${ROTATION_STATUS_CONFIG[d.rotationStatus].className}`}
                  >
                    <Activity size={12} aria-hidden="true" />
                    {ROTATION_STATUS_CONFIG[d.rotationStatus].label}
                  </span>
                )}
                {d.campaignId && (
                  <span className="dewormings-page__tag dewormings-page__tag--campaign">
                    <FileText size={12} aria-hidden="true" />
                    Campanha
                  </span>
                )}
              </div>

              <div className="dewormings-page__card-details">
                <span className="dewormings-page__detail">
                  <Calendar size={14} aria-hidden="true" />
                  {new Date(d.dewormingDate).toLocaleDateString('pt-BR')}
                </span>
                <span className="dewormings-page__detail dewormings-page__detail--mono">
                  {d.dosageMl} mL
                </span>
                <span className="dewormings-page__detail">{d.responsibleName}</span>
              </div>

              {(d.opgPre !== null || d.efficacyPercentage !== null) && (
                <div className="dewormings-page__card-opg">
                  {d.opgPre !== null && (
                    <span>
                      OPG pré: <strong>{d.opgPre}</strong>
                    </span>
                  )}
                  {d.opgPost !== null && (
                    <span>
                      OPG pós: <strong>{d.opgPost}</strong>
                    </span>
                  )}
                  {d.efficacyPercentage !== null && (
                    <span
                      className={`dewormings-page__efficacy ${d.efficacyPercentage >= 95 ? 'dewormings-page__efficacy--good' : d.efficacyPercentage >= 80 ? 'dewormings-page__efficacy--moderate' : 'dewormings-page__efficacy--poor'}`}
                    >
                      Eficácia: <strong>{d.efficacyPercentage}%</strong>
                    </span>
                  )}
                </div>
              )}

              {d.nextDewormingDate && (
                <div className="dewormings-page__card-next">
                  <Clock size={14} aria-hidden="true" />
                  Próxima: {new Date(d.nextDewormingDate).toLocaleDateString('pt-BR')}
                </div>
              )}

              {d.withdrawalEndDate && (
                <div className="dewormings-page__card-withdrawal">
                  Carência até: {new Date(d.withdrawalEndDate).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <nav className="dewormings-page__pagination" aria-label="Paginação">
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
            {page} de {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= meta.totalPages}
            aria-label="Próxima página"
          >
            Próxima
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}

      <DewormingModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDeworming(null);
        }}
        deworming={selectedDeworming}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />
      <BulkDewormingModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />
      {reportCampaignId && (
        <CampaignReportModal
          isOpen={!!reportCampaignId}
          onClose={() => setReportCampaignId(null)}
          farmId={selectedFarm.id}
          campaignId={reportCampaignId}
        />
      )}
    </section>
  );
}
