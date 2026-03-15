import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  Syringe,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  FileText,
  Calendar,
  Clock,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useVaccinations } from '@/hooks/useVaccinations';
import type { VaccinationItem } from '@/types/vaccination';
import VaccinationModal from '@/components/vaccinations/VaccinationModal';
import BulkVaccinationModal from '@/components/vaccinations/BulkVaccinationModal';
import CampaignReportModal from '@/components/vaccinations/CampaignReportModal';
import { api } from '@/services/api';
import './VaccinationsPage.css';

export default function VaccinationsPage() {
  const { selectedFarm } = useFarmContext();

  // ─── State ──────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedVaccination, setSelectedVaccination] = useState<VaccinationItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [reportCampaignId, setReportCampaignId] = useState<string | null>(null);

  // ─── Debounced search ───────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Data ───────────────────────────────────────────────
  const { vaccinations, meta, isLoading, error, refetch } = useVaccinations({
    farmId: selectedFarm?.id ?? null,
    page,
    search: search || undefined,
  });

  // ─── Callbacks ──────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setShowBulkModal(false);
    setSelectedVaccination(null);
    setSuccessMsg(
      selectedVaccination ? 'Vacinação atualizada com sucesso' : 'Vacinação registrada com sucesso',
    );
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, selectedVaccination]);

  const handleEdit = useCallback((v: VaccinationItem) => {
    setSelectedVaccination(v);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (v: VaccinationItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm('Excluir este registro de vacinação? Esta ação não pode ser desfeita.'))
        return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/vaccinations/${v.id}`);
        setSuccessMsg('Vacinação excluída com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir vacinação.');
      }
    },
    [refetch, selectedFarm],
  );

  // ─── No farm selected ──────────────────────────────────
  if (!selectedFarm) {
    return (
      <section className="vaccinations-page">
        <div className="vaccinations-page__empty">
          <Syringe size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver as vacinações.</p>
        </div>
      </section>
    );
  }

  // Collect unique campaignIds for report access
  const campaignIds = [
    ...new Set(vaccinations.filter((v) => v.campaignId).map((v) => v.campaignId!)),
  ];

  return (
    <section className="vaccinations-page">
      {/* Header */}
      <header className="vaccinations-page__header">
        <div>
          <h1>Vacinações</h1>
          <p>Registros de vacinação do rebanho de {selectedFarm.name}</p>
        </div>
        <div className="vaccinations-page__actions">
          <button
            type="button"
            className="vaccinations-page__btn-secondary"
            onClick={() => setShowBulkModal(true)}
          >
            <Layers size={20} aria-hidden="true" />
            Vacinar lote
          </button>
          <button
            type="button"
            className="vaccinations-page__btn-primary"
            onClick={() => {
              setSelectedVaccination(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Nova vacinação
          </button>
        </div>
      </header>

      {/* Success */}
      {successMsg && (
        <div className="vaccinations-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Errors */}
      {(error || deleteError) && (
        <div className="vaccinations-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {/* Toolbar */}
      <div className="vaccinations-page__toolbar">
        <div className="vaccinations-page__search">
          <Search size={16} aria-hidden="true" className="vaccinations-page__search-icon" />
          <input
            type="text"
            placeholder="Buscar por animal, vacina ou responsável..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar vacinações"
          />
        </div>
        {campaignIds.length > 0 && (
          <div className="vaccinations-page__filter">
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

      {/* Loading */}
      {isLoading && <div className="vaccinations-page__loading">Carregando vacinações...</div>}

      {/* Empty */}
      {!isLoading && vaccinations.length === 0 && (
        <div className="vaccinations-page__empty">
          <Syringe size={48} aria-hidden="true" />
          <h2>Nenhuma vacinação registrada</h2>
          <p>Registre vacinações individualmente ou em lote usando os botões acima.</p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && vaccinations.length > 0 && (
        <div className="vaccinations-page__grid">
          {vaccinations.map((v) => (
            <div
              key={v.id}
              className="vaccinations-page__card"
              onClick={() => handleEdit(v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEdit(v);
                }
              }}
            >
              <div className="vaccinations-page__card-header">
                <div>
                  <h3 className="vaccinations-page__card-title">
                    {v.animalEarTag} — {v.animalName || 'Sem nome'}
                  </h3>
                  <p className="vaccinations-page__card-subtitle">{v.productName}</p>
                </div>
                <div className="vaccinations-page__card-actions">
                  <button
                    type="button"
                    className="vaccinations-page__card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(v);
                    }}
                    aria-label={`Editar vacinação de ${v.animalEarTag}`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="vaccinations-page__card-btn vaccinations-page__card-btn--delete"
                    onClick={(e) => void handleDelete(v, e)}
                    aria-label={`Excluir vacinação de ${v.animalEarTag}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="vaccinations-page__card-tags">
                <span className="vaccinations-page__tag vaccinations-page__tag--route">
                  {v.administrationRouteLabel}
                </span>
                <span className="vaccinations-page__tag vaccinations-page__tag--dose">
                  Dose {v.doseNumber}
                </span>
                {v.campaignId && (
                  <span className="vaccinations-page__tag vaccinations-page__tag--campaign">
                    <FileText size={12} aria-hidden="true" />
                    Campanha
                  </span>
                )}
              </div>

              <div className="vaccinations-page__card-details">
                <span className="vaccinations-page__detail">
                  <Calendar size={14} aria-hidden="true" />
                  {new Date(v.vaccinationDate).toLocaleDateString('pt-BR')}
                </span>
                <span className="vaccinations-page__detail vaccinations-page__detail--mono">
                  {v.dosageMl} mL
                </span>
                <span className="vaccinations-page__detail">{v.responsibleName}</span>
              </div>

              {v.nextDoseDate && (
                <div className="vaccinations-page__card-next">
                  <Clock size={14} aria-hidden="true" />
                  Próxima dose: {new Date(v.nextDoseDate).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="vaccinations-page__pagination" aria-label="Paginação">
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

      {/* Modals */}
      <VaccinationModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedVaccination(null);
        }}
        vaccination={selectedVaccination}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />

      <BulkVaccinationModal
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
