import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Trash2,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Calendar,
  Clock,
  Download,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useTherapeuticTreatments } from '@/hooks/useTherapeuticTreatments';
import type { TreatmentListItem } from '@/types/therapeutic-treatment';
import { STATUS_CONFIG } from '@/types/therapeutic-treatment';
import TreatmentModal from '@/components/therapeutic-treatments/TreatmentModal';
import TreatmentDetailModal from '@/components/therapeutic-treatments/TreatmentDetailModal';
import { api } from '@/services/api';
import './TherapeuticTreatmentsPage.css';

export default function TherapeuticTreatmentsPage() {
  const { selectedFarm } = useFarmContext();

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [detailTreatmentId, setDetailTreatmentId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { treatments, total, isLoading, error, refetch } = useTherapeuticTreatments({
    farmId: selectedFarm?.id ?? null,
    page,
    status: statusFilter || undefined,
  });

  const totalPages = Math.ceil(total / 50) || 1;

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSuccessMsg('Tratamento registrado com sucesso');
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch]);

  const handleDetailSuccess = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleDelete = useCallback(
    async (t: TreatmentListItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (
        !window.confirm('Excluir este tratamento? Todas as aplicações e evoluções serão perdidas.')
      )
        return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/therapeutic-treatments/${t.id}`);
        setSuccessMsg('Tratamento excluído com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir tratamento.');
      }
    },
    [refetch, selectedFarm],
  );

  const handleExport = useCallback(async () => {
    if (!selectedFarm) return;
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const blob = await api.getBlob(
        `/org/farms/${selectedFarm.id}/therapeutic-treatments/export${qs}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tratamentos-terapeuticos.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDeleteError('Erro ao exportar CSV');
    }
  }, [selectedFarm, statusFilter]);

  if (!selectedFarm) {
    return (
      <section className="tt-page">
        <div className="tt-page__empty">
          <Stethoscope size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver os tratamentos.</p>
        </div>
      </section>
    );
  }

  // Filter by search locally
  const filtered = searchInput
    ? treatments.filter(
        (t) =>
          t.animalEarTag.toLowerCase().includes(searchInput.toLowerCase()) ||
          (t.animalName ?? '').toLowerCase().includes(searchInput.toLowerCase()) ||
          t.diseaseName.toLowerCase().includes(searchInput.toLowerCase()) ||
          t.veterinaryName.toLowerCase().includes(searchInput.toLowerCase()),
      )
    : treatments;

  return (
    <section className="tt-page">
      <header className="tt-page__header">
        <div>
          <h1>Tratamentos terapêuticos</h1>
          <p>Tratamentos individuais do rebanho de {selectedFarm.name}</p>
        </div>
        <div className="tt-page__actions">
          <button type="button" className="tt-page__btn-secondary" onClick={handleExport}>
            <Download size={20} aria-hidden="true" />
            Exportar CSV
          </button>
          <button type="button" className="tt-page__btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} aria-hidden="true" />
            Novo tratamento
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="tt-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {(error || deleteError) && (
        <div className="tt-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      <div className="tt-page__toolbar">
        <div className="tt-page__search">
          <Search size={16} aria-hidden="true" className="tt-page__search-icon" />
          <input
            type="text"
            placeholder="Buscar por animal, doença ou veterinário..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar tratamentos"
          />
        </div>
        <select
          className="tt-page__status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="OPEN">Aberto</option>
          <option value="IN_PROGRESS">Em andamento</option>
          <option value="CLOSED">Encerrado</option>
        </select>
      </div>

      {isLoading && <div className="tt-page__loading">Carregando tratamentos...</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="tt-page__empty">
          <Stethoscope size={48} aria-hidden="true" />
          <h2>Nenhum tratamento registrado</h2>
          <p>Abra um novo tratamento usando o botão acima.</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="tt-page__grid">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="tt-page__card"
              onClick={() => setDetailTreatmentId(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailTreatmentId(t.id);
                }
              }}
            >
              <div className="tt-page__card-header">
                <div>
                  <h3 className="tt-page__card-title">
                    {t.animalEarTag} — {t.animalName || 'Sem nome'}
                  </h3>
                  <p className="tt-page__card-subtitle">{t.diseaseName}</p>
                </div>
                <div className="tt-page__card-actions">
                  <button
                    type="button"
                    className="tt-page__card-btn tt-page__card-btn--delete"
                    onClick={(e) => void handleDelete(t, e)}
                    aria-label={`Excluir tratamento de ${t.animalEarTag}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="tt-page__card-tags">
                <span className={`tt-page__tag ${STATUS_CONFIG[t.status].className}`}>
                  {t.statusLabel}
                </span>
                <span className="tt-page__tag tt-page__tag--severity">{t.severityLabel}</span>
                {t.outcomeLabel && (
                  <span className="tt-page__tag tt-page__tag--outcome">{t.outcomeLabel}</span>
                )}
              </div>

              <div className="tt-page__card-details">
                <span className="tt-page__detail">
                  <Calendar size={14} aria-hidden="true" />
                  {new Date(t.diagnosisDate).toLocaleDateString('pt-BR')}
                </span>
                <span className="tt-page__detail">{t.veterinaryName}</span>
                {t.totalCostCents > 0 && (
                  <span className="tt-page__detail tt-page__detail--mono">
                    R$ {(t.totalCostCents / 100).toFixed(2).replace('.', ',')}
                  </span>
                )}
              </div>

              {t.treatmentProtocolName && (
                <div className="tt-page__card-protocol">
                  <Clock size={14} aria-hidden="true" />
                  {t.treatmentProtocolName}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="tt-page__pagination" aria-label="Paginação">
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

      <TreatmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />

      <TreatmentDetailModal
        isOpen={!!detailTreatmentId}
        onClose={() => setDetailTreatmentId(null)}
        treatmentId={detailTreatmentId}
        farmId={selectedFarm.id}
        onSuccess={handleDetailSuccess}
      />
    </section>
  );
}
