import { useState, useRef, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Eye,
  Pencil,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { usePesticidePrescriptions } from '@/hooks/usePesticidePrescriptions';
import PermissionGate from '@/components/auth/PermissionGate';
import PrescriptionModal from '@/components/pesticide-prescriptions/PrescriptionModal';
import {
  PRESCRIPTION_STATUS_LABELS,
  TARGET_TYPE_LABELS,
  DOSE_UNIT_LABELS,
} from '@/types/pesticide-prescription';
import type { PrescriptionItem } from '@/types/pesticide-prescription';
import './PesticidePrescriptionsPage.css';

type ToastType = 'success' | 'error';

function PesticidePrescriptionsPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const {
    prescriptions,
    total,
    isLoading,
    error,
    refetch,
    createPrescription,
    updatePrescription,
    cancelPrescription,
    downloadPdf,
    downloadCsv,
  } = usePesticidePrescriptions({
    farmId: selectedFarmId,
    page,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const showToast = useCallback((msg: string, type: ToastType) => {
    setToast({ msg, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  }, []);

  const handleCreate = () => {
    setSelectedPrescription(null);
    setShowModal(true);
  };

  const handleEdit = (p: PrescriptionItem) => {
    setSelectedPrescription(p);
    setShowModal(true);
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelPrescription(id);
      showToast('Receituário cancelado com sucesso', 'success');
      setConfirmDelete(null);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao cancelar receituário', 'error');
    }
  };

  const handleDownloadPdf = async (p: PrescriptionItem) => {
    try {
      await downloadPdf(p.id, p.sequentialNumber);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao baixar PDF', 'error');
    }
  };

  const handleSuccess = () => {
    showToast(
      selectedPrescription
        ? 'Receituário atualizado com sucesso'
        : 'Receituário emitido com sucesso',
      'success',
    );
    refetch();
  };

  const totalPages = Math.ceil(total / 20);

  if (!selectedFarmId) {
    return (
      <main className="prescriptions-page">
        <div className="empty-state">
          <FileText size={48} aria-hidden="true" className="empty-icon" />
          <h2>Selecione uma fazenda</h2>
          <p>Para visualizar os receituários, selecione uma fazenda no menu superior.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="prescriptions-page">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="page-header">
        <div className="page-header-left">
          <FileText size={24} aria-hidden="true" className="page-icon" />
          <div>
            <h1>Receituários Agronômicos</h1>
            <p className="page-subtitle">
              {selectedFarm?.name} · {total} receituário{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={downloadCsv}
            aria-label="Exportar CSV"
          >
            <Download size={16} aria-hidden="true" /> CSV
          </button>
          <PermissionGate permission="farms:update">
            <button type="button" className="btn-primary" onClick={handleCreate}>
              <Plus size={16} aria-hidden="true" /> Novo receituário
            </button>
          </PermissionGate>
        </div>
      </header>

      {/* Filters */}
      <section className="filters-bar">
        <div className="search-wrapper">
          <Search size={16} aria-hidden="true" className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por agrônomo, cultura, alvo..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar receituários"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativa</option>
          <option value="CANCELLED">Cancelada</option>
          <option value="EXPIRED">Expirada</option>
        </select>
      </section>

      {/* Content */}
      {isLoading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : error ? (
        <div className="error-state" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <p>{error}</p>
          <button type="button" className="btn-secondary" onClick={refetch}>
            Tentar novamente
          </button>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} aria-hidden="true" className="empty-icon" />
          <h2>Nenhum receituário encontrado</h2>
          <p>
            {search
              ? 'Tente ajustar os filtros de busca.'
              : 'Emita o primeiro receituário agronômico para esta fazenda.'}
          </p>
          {!search && (
            <PermissionGate permission="farms:update">
              <button type="button" className="btn-primary" onClick={handleCreate}>
                <Plus size={16} aria-hidden="true" /> Novo receituário
              </button>
            </PermissionGate>
          )}
        </div>
      ) : (
        <>
          <ul className="prescriptions-list">
            {prescriptions.map((p) => (
              <li
                key={p.id}
                className={`prescription-card ${p.status === 'CANCELLED' ? 'cancelled' : ''}`}
              >
                <div
                  className="card-header"
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && setExpandedId(expandedId === p.id ? null : p.id)
                  }
                  aria-expanded={expandedId === p.id}
                  aria-label={`Receituário nº ${p.sequentialNumber}`}
                >
                  <div className="card-header-left">
                    <span className="prescription-number">
                      Nº {String(p.sequentialNumber).padStart(6, '0')}
                    </span>
                    <span className={`status-badge status-${p.status.toLowerCase()}`}>
                      {PRESCRIPTION_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  <div className="card-header-center">
                    <span className="card-field">{p.fieldPlotName}</span>
                    <span className="card-separator">·</span>
                    <span className="card-culture">{p.cultureName}</span>
                    <span className="card-separator">·</span>
                    <span className="card-target">{p.targetPest}</span>
                  </div>
                  <div className="card-header-right">
                    <span className="card-date">
                      {new Date(p.issuedAt).toLocaleDateString('pt-BR')}
                    </span>
                    <Eye
                      size={16}
                      aria-hidden="true"
                      className={`expand-icon ${expandedId === p.id ? 'expanded' : ''}`}
                    />
                  </div>
                </div>

                {expandedId === p.id && (
                  <div className="card-details">
                    <div className="details-grid">
                      <div className="detail-group">
                        <span className="detail-label">ÁREA</span>
                        <span className="detail-value">{p.areaHa.toFixed(2)} ha</span>
                      </div>
                      <div className="detail-group">
                        <span className="detail-label">TIPO ALVO</span>
                        <span className="detail-value">
                          {TARGET_TYPE_LABELS[p.targetType] ?? p.targetType}
                        </span>
                      </div>
                      <div className="detail-group">
                        <span className="detail-label">VOLUME CALDA</span>
                        <span className="detail-value">{p.sprayVolume} L/ha</span>
                      </div>
                      <div className="detail-group">
                        <span className="detail-label">Nº APLICAÇÕES</span>
                        <span className="detail-value">{p.numberOfApplications}</span>
                      </div>
                      {p.applicationInterval && (
                        <div className="detail-group">
                          <span className="detail-label">INTERVALO</span>
                          <span className="detail-value">{p.applicationInterval} dias</span>
                        </div>
                      )}
                    </div>

                    {/* Products */}
                    <h4 className="products-title">Produtos recomendados</h4>
                    <div className="products-list">
                      {p.products.map((prod) => (
                        <div key={prod.id} className="product-card">
                          <div className="product-name">{prod.productName}</div>
                          <div className="product-details">
                            <span>{prod.activeIngredient}</span>
                            <span>
                              {prod.dose} {DOSE_UNIT_LABELS[prod.doseUnit] ?? prod.doseUnit}
                            </span>
                            {prod.withdrawalPeriodDays != null && (
                              <span>Carência: {prod.withdrawalPeriodDays} dias</span>
                            )}
                            {prod.safetyIntervalDays != null && (
                              <span>Reentrada: {prod.safetyIntervalDays} dias</span>
                            )}
                            {prod.toxicityClass && <span>Tox: {prod.toxicityClass}</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Agronomist */}
                    <div className="agronomist-info">
                      <span className="detail-label">RESPONSÁVEL TÉCNICO</span>
                      <span className="detail-value">
                        {p.agronomistName} — CREA {p.agronomistCrea}
                      </span>
                    </div>

                    {p.technicalJustification && (
                      <div className="justification">
                        <span className="detail-label">JUSTIFICATIVA</span>
                        <p>{p.technicalJustification}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="card-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => handleDownloadPdf(p)}
                        aria-label="Baixar PDF"
                      >
                        <FileDown size={14} aria-hidden="true" /> PDF
                      </button>
                      <PermissionGate permission="farms:update">
                        {p.status === 'ACTIVE' && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => handleEdit(p)}
                              aria-label="Editar receituário"
                            >
                              <Pencil size={14} aria-hidden="true" /> Editar
                            </button>
                            {confirmDelete === p.id ? (
                              <div className="confirm-inline">
                                <span>Confirma cancelamento?</span>
                                <button
                                  type="button"
                                  className="btn-danger btn-sm"
                                  onClick={() => handleCancel(p.id)}
                                >
                                  Sim, cancelar
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  onClick={() => setConfirmDelete(null)}
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn-secondary btn-sm btn-cancel"
                                onClick={() => setConfirmDelete(p.id)}
                                aria-label="Cancelar receituário"
                              >
                                <Trash2 size={14} aria-hidden="true" /> Cancelar
                              </button>
                            )}
                          </>
                        )}
                      </PermissionGate>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="pagination" aria-label="Paginação de receituários">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="pagination-info">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* Modal */}
      <PrescriptionModal
        isOpen={showModal}
        prescription={selectedPrescription}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        onCreate={createPrescription}
        onUpdate={updatePrescription}
      />
    </main>
  );
}

export default PesticidePrescriptionsPage;
