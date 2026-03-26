import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Download,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { useTrainingRecords } from '@/hooks/useTrainingRecords';
import { useTrainingTypes } from '@/hooks/useTrainingTypes';
import { ComplianceStatusBadge } from '@/components/shared/ComplianceStatusBadge';
import TrainingRecordModal from '@/components/training-records/TrainingRecordModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { INSTRUCTOR_TYPE_LABELS } from '@/types/training';
import type { TrainingRecord, CreateTrainingRecordInput } from '@/types/training';
import './TrainingRecordsPage.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function getExpiryStatus(expiresAt: string): 'OK' | 'YELLOW' | 'RED' | 'EXPIRED' {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 15) return 'RED';
  if (diffDays <= 30) return 'YELLOW';
  return 'OK';
}

// Placeholder employees — in real app, fetched from API
const MOCK_EMPLOYEES: Array<{ id: string; name: string; positionName: string | null }> = [];

export default function TrainingRecordsPage() {
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    trainingTypeId: '',
    instructorType: '',
    dateFrom: '',
    dateTo: '',
  });

  const {
    trainingRecords,
    loading,
    error,
    successMessage,
    fetchTrainingRecords,
    createTrainingRecord,
    deleteTrainingRecord,
    downloadCertificatePdf,
  } = useTrainingRecords();

  const { trainingTypes, fetchTrainingTypes } = useTrainingTypes();

  const load = useCallback(() => {
    void fetchTrainingRecords({
      trainingTypeId: filters.trainingTypeId || undefined,
      instructorType: filters.instructorType || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    });
  }, [fetchTrainingRecords, filters]);

  useEffect(() => {
    void fetchTrainingTypes();
  }, [fetchTrainingTypes]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (successMessage) {
      setToast(successMessage);
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  const handleSave = async (input: CreateTrainingRecordInput): Promise<boolean> => {
    const ok = await createTrainingRecord(input);
    if (ok) {
      setShowModal(false);
      load();
    }
    return ok;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const ok = await deleteTrainingRecord(deleteId);
    setDeleting(false);
    if (ok) {
      setDeleteId(null);
      load();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const items: TrainingRecord[] = trainingRecords?.data ?? [];
  const isEmpty = !loading && items.length === 0;

  return (
    <main className="training-records-page">
      {/* Toast */}
      {toast && (
        <div className="training-records-page__toast" role="status">
          {toast}
        </div>
      )}

      <header className="training-records-page__header">
        <h1 className="training-records-page__title">
          <ClipboardList size={24} aria-hidden="true" />
          Registros de Treinamento
        </h1>
        <button
          type="button"
          className="training-records-page__cta"
          onClick={() => setShowModal(true)}
        >
          Registrar Treinamento
        </button>
      </header>

      {/* Filter bar */}
      <div className="training-records-page__filters">
        <div className="training-records-page__filter-field">
          <label htmlFor="tr-filter-type" className="training-records-page__filter-label">
            Tipo de treinamento
          </label>
          <select
            id="tr-filter-type"
            className="training-records-page__select"
            value={filters.trainingTypeId}
            onChange={(e) => setFilters((f) => ({ ...f, trainingTypeId: e.target.value }))}
          >
            <option value="">Todos</option>
            {trainingTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="training-records-page__fieldset">
          <legend className="training-records-page__filter-label">Tipo de instrutor</legend>
          <div className="training-records-page__radio-group">
            {[
              { value: '', label: 'Todos' },
              { value: 'INTERNO', label: 'Interno' },
              { value: 'EXTERNO', label: 'Externo' },
            ].map((opt) => (
              <label key={opt.value} className="training-records-page__radio-label">
                <input
                  type="radio"
                  name="instructorType"
                  value={opt.value}
                  checked={filters.instructorType === opt.value}
                  onChange={() => setFilters((f) => ({ ...f, instructorType: opt.value }))}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="training-records-page__filter-field">
          <label htmlFor="tr-filter-from" className="training-records-page__filter-label">
            Data início
          </label>
          <input
            id="tr-filter-from"
            type="date"
            className="training-records-page__input"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          />
        </div>

        <div className="training-records-page__filter-field">
          <label htmlFor="tr-filter-to" className="training-records-page__filter-label">
            Data fim
          </label>
          <input
            id="tr-filter-to"
            type="date"
            className="training-records-page__input"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="training-records-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          Não foi possível carregar os dados. Verifique sua conexão e tente novamente.
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="training-records-page__skeleton" aria-busy="true" aria-label="Carregando">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="training-records-page__skeleton-row" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="training-records-page__empty">
          <ClipboardList
            size={48}
            aria-hidden="true"
            className="training-records-page__empty-icon"
          />
          <p className="training-records-page__empty-title">Nenhum treinamento registrado</p>
          <p className="training-records-page__empty-body">
            Registre o primeiro treinamento realizado para acompanhar a conformidade.
          </p>
          <button
            type="button"
            className="training-records-page__cta"
            onClick={() => setShowModal(true)}
          >
            Registrar Treinamento
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !isEmpty && (
        <div className="training-records-page__table-wrap">
          <table className="training-records-page__table">
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">DATA</th>
                <th scope="col">TIPO DE TREINAMENTO</th>
                <th scope="col">INSTRUTOR</th>
                <th scope="col">TIPO</th>
                <th scope="col">CH REALIZADA</th>
                <th scope="col">LOCAL</th>
                <th scope="col">PARTICIPANTES</th>
                <th scope="col">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <>
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        className="training-records-page__expand-btn"
                        onClick={() => toggleExpand(item.id)}
                        aria-expanded={expandedId === item.id}
                        aria-label={
                          expandedId === item.id ? 'Recolher participantes' : 'Expandir participantes'
                        }
                      >
                        {expandedId === item.id ? (
                          <ChevronDown size={16} aria-hidden="true" />
                        ) : (
                          <ChevronRight size={16} aria-hidden="true" />
                        )}
                      </button>
                    </td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.trainingTypeName}</td>
                    <td>{item.instructorName}</td>
                    <td>{INSTRUCTOR_TYPE_LABELS[item.instructorType] ?? item.instructorType}</td>
                    <td>{item.effectiveHours}h</td>
                    <td>{item.location ?? '—'}</td>
                    <td>
                      <span className="training-records-page__count-chip">
                        {item.participantCount}
                      </span>
                    </td>
                    <td className="training-records-page__actions">
                      <button
                        type="button"
                        aria-label="Excluir registro de treinamento"
                        className="training-records-page__action-btn training-records-page__action-btn--danger"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded participants */}
                  {expandedId === item.id && (
                    <tr key={`${item.id}-participants`} className="training-records-page__expanded-row">
                      <td colSpan={9}>
                        <div className="training-records-page__participants">
                          <p className="training-records-page__participants-title">Participantes</p>
                          {item.participants.length === 0 ? (
                            <p className="training-records-page__participants-empty">
                              Nenhum participante registrado.
                            </p>
                          ) : (
                            <ul className="training-records-page__participants-list">
                              {item.participants.map((p) => (
                                <li
                                  key={p.id}
                                  className="training-records-page__participant-item"
                                >
                                  <span className="training-records-page__participant-name">
                                    {p.employeeName}
                                  </span>
                                  <ComplianceStatusBadge status={getExpiryStatus(p.expiresAt)} />
                                  <button
                                    type="button"
                                    className="training-records-page__cert-btn"
                                    onClick={() => downloadCertificatePdf(item.id, p.employeeId)}
                                    aria-label={`Baixar certificado de ${p.employeeName}`}
                                  >
                                    <Download size={14} aria-hidden="true" />
                                    Baixar Certificado
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TrainingRecordModal
        isOpen={showModal}
        trainingTypes={trainingTypes}
        employees={MOCK_EMPLOYEES}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir registro de treinamento"
        message="Excluir registro: Os certificados dos participantes serão removidos. Confirmar exclusão?"
        variant="danger"
        confirmLabel="Excluir"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </main>
  );
}
