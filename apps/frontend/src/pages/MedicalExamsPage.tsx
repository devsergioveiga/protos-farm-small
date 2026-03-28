import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Stethoscope,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Download,
  AlertCircle,
} from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { useMedicalExams } from '@/hooks/useMedicalExams';
import { ComplianceStatusBadge } from '@/components/shared/ComplianceStatusBadge';
import MedicalExamModal from '@/components/medical-exams/MedicalExamModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { MedicalExam, CreateMedicalExamInput, AsoType, AsoResult } from '@/types/medical-exam';
import { ASO_TYPE_LABELS, ASO_RESULT_LABELS } from '@/types/medical-exam';
import './MedicalExamsPage.css';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ASO result badge
interface ResultBadgeProps {
  result: AsoResult;
}

function AsoResultBadge({ result }: ResultBadgeProps) {
  const CONFIG: Record<
    AsoResult,
    { label: string; icon: React.ElementType; bg: string; color: string }
  > = {
    APTO: {
      label: ASO_RESULT_LABELS.APTO,
      icon: CheckCircle,
      bg: 'var(--color-success-100)',
      color: 'var(--color-success-500)',
    },
    INAPTO: {
      label: ASO_RESULT_LABELS.INAPTO,
      icon: XCircle,
      bg: 'var(--color-error-100)',
      color: 'var(--color-error-500)',
    },
    APTO_COM_RESTRICAO: {
      label: ASO_RESULT_LABELS.APTO_COM_RESTRICAO,
      icon: AlertTriangle,
      bg: 'var(--color-warning-100)',
      color: 'var(--color-warning-500)',
    },
  };
  const { label, icon: Icon, bg, color } = CONFIG[result];
  return (
    <span
      className="medical-exams-page__result-badge"
      style={{ backgroundColor: bg, color }}
      aria-label={label}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

export default function MedicalExamsPage() {
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    employeeSearch: '',
    type: '' as AsoType | '',
    result: '' as AsoResult | '',
    expiryStatus: '',
  });

  const {
    medicalExams,
    loading,
    error,
    successMessage,
    fetchMedicalExams,
    createMedicalExam,
    deleteMedicalExam,
  } = useMedicalExams();

  const { employees } = useEmployees({ status: 'ATIVO', limit: 200 });

  const employeeOptions = useMemo(
    () =>
      employees.map((emp) => ({
        id: emp.id,
        name: emp.name,
        positionName: emp.farms?.[0]?.position?.name ?? null,
        asoPeriodicityMonths: emp.farms?.[0]?.position?.asoPeriodicityMonths ?? null,
      })),
    [employees],
  );

  const load = useCallback(() => {
    void fetchMedicalExams({
      type: filters.type || undefined,
      result: filters.result || undefined,
      expiryStatus: filters.expiryStatus || undefined,
    });
  }, [fetchMedicalExams, filters.type, filters.result, filters.expiryStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (successMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast(successMessage);
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  const handleSave = async (input: CreateMedicalExamInput): Promise<boolean> => {
    const ok = await createMedicalExam(input);
    if (ok) {
      setShowModal(false);
      load();
    }
    return ok;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const ok = await deleteMedicalExam(deleteId);
    setDeleting(false);
    if (ok) {
      setDeleteId(null);
      load();
    }
  };

  // Client-side employee name filter
  const allItems: MedicalExam[] = (medicalExams?.data ?? []).filter(
    (item) =>
      !filters.employeeSearch ||
      item.employeeName.toLowerCase().includes(filters.employeeSearch.toLowerCase()),
  );
  const isEmpty = !loading && allItems.length === 0;

  return (
    <main className="medical-exams-page">
      {/* Toast */}
      {toast && (
        <div className="medical-exams-page__toast" role="status">
          {toast}
        </div>
      )}

      <header className="medical-exams-page__header">
        <h1 className="medical-exams-page__title">
          <Stethoscope size={24} aria-hidden="true" />
          ASOs
        </h1>
        <button
          type="button"
          className="medical-exams-page__cta"
          onClick={() => setShowModal(true)}
        >
          Registrar ASO
        </button>
      </header>

      {/* Filter bar */}
      <div className="medical-exams-page__filters">
        <div className="medical-exams-page__filter-field">
          <label htmlFor="me-filter-emp" className="medical-exams-page__filter-label">
            Colaborador
          </label>
          <input
            id="me-filter-emp"
            type="search"
            className="medical-exams-page__filter-input"
            placeholder="Buscar..."
            value={filters.employeeSearch}
            onChange={(e) => setFilters((f) => ({ ...f, employeeSearch: e.target.value }))}
          />
        </div>

        <div className="medical-exams-page__filter-field">
          <label htmlFor="me-filter-type" className="medical-exams-page__filter-label">
            Tipo ASO
          </label>
          <select
            id="me-filter-type"
            className="medical-exams-page__filter-select"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as AsoType | '' }))}
          >
            <option value="">Todos</option>
            {(Object.keys(ASO_TYPE_LABELS) as AsoType[]).map((k) => (
              <option key={k} value={k}>
                {ASO_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="medical-exams-page__filter-field">
          <label htmlFor="me-filter-result" className="medical-exams-page__filter-label">
            Resultado
          </label>
          <select
            id="me-filter-result"
            className="medical-exams-page__filter-select"
            value={filters.result}
            onChange={(e) =>
              setFilters((f) => ({ ...f, result: e.target.value as AsoResult | '' }))
            }
          >
            <option value="">Todos</option>
            <option value="APTO">Apto</option>
            <option value="INAPTO">Inapto</option>
            <option value="APTO_COM_RESTRICAO">Apto com restrição</option>
          </select>
        </div>

        <div className="medical-exams-page__filter-field">
          <label htmlFor="me-filter-expiry" className="medical-exams-page__filter-label">
            Status de vencimento
          </label>
          <select
            id="me-filter-expiry"
            className="medical-exams-page__filter-select"
            value={filters.expiryStatus}
            onChange={(e) => setFilters((f) => ({ ...f, expiryStatus: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="YELLOW">Vencendo em breve</option>
            <option value="RED">Vencendo em 15 dias</option>
            <option value="EXPIRED">Vencido</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="medical-exams-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          Não foi possível carregar os dados. Verifique sua conexão e tente novamente.
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="medical-exams-page__skeleton" aria-busy="true" aria-label="Carregando">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="medical-exams-page__skeleton-row" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="medical-exams-page__empty">
          <Stethoscope size={48} aria-hidden="true" className="medical-exams-page__empty-icon" />
          <p className="medical-exams-page__empty-title">Nenhum ASO registrado</p>
          <p className="medical-exams-page__empty-body">
            Registre o ASO admissional dos colaboradores para iniciar o controle.
          </p>
          <button
            type="button"
            className="medical-exams-page__cta"
            onClick={() => setShowModal(true)}
          >
            Registrar ASO
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !isEmpty && (
        <div className="medical-exams-page__table-wrap">
          <table className="medical-exams-page__table">
            <thead>
              <tr>
                <th scope="col">COLABORADOR</th>
                <th scope="col">FUNÇÃO</th>
                <th scope="col">TIPO ASO</th>
                <th scope="col">DATA</th>
                <th scope="col">MÉDICO (CRM)</th>
                <th scope="col">RESULTADO</th>
                <th scope="col">PRÓXIMO EXAME</th>
                <th scope="col">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.employeeName}</td>
                  <td>{item.employeePosition ?? '—'}</td>
                  <td>{ASO_TYPE_LABELS[item.type] ?? item.type}</td>
                  <td>{formatDate(item.date)}</td>
                  <td className="medical-exams-page__mono">
                    {item.doctorName} · {item.doctorCrm}
                  </td>
                  <td>
                    <AsoResultBadge result={item.result} />
                  </td>
                  <td>
                    {item.expiryStatus ? (
                      <ComplianceStatusBadge status={item.expiryStatus} />
                    ) : (
                      <span className="medical-exams-page__no-date">
                        {formatDate(item.nextExamDate)}
                      </span>
                    )}
                  </td>
                  <td className="medical-exams-page__actions">
                    {item.documentUrl && (
                      <a
                        href={item.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="medical-exams-page__action-btn"
                        aria-label={`Baixar ASO de ${item.employeeName}`}
                      >
                        <Download size={16} aria-hidden="true" />
                      </a>
                    )}
                    <button
                      type="button"
                      aria-label={`Excluir ASO de ${item.employeeName}`}
                      className="medical-exams-page__action-btn medical-exams-page__action-btn--danger"
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MedicalExamModal
        isOpen={showModal}
        employees={employeeOptions}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir ASO"
        message="Excluir ASO: O histórico do exame será removido permanentemente. Confirmar exclusão?"
        variant="warning"
        confirmLabel="Excluir"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </main>
  );
}
