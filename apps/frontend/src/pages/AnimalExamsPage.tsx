import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  FlaskConical,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Calendar,
  ClipboardList,
  BarChart3,
  FileText,
  Shield,
  Upload,
  FileUp,
  Paperclip,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useAnimalExams } from '@/hooks/useAnimalExams';
import { useExamTypes } from '@/hooks/useExamTypes';
import type { AnimalExamItem, ExamTypeItem, ExamIndicators } from '@/types/animal-exam';
import { EXAM_STATUSES } from '@/types/animal-exam';
import AnimalExamModal from '@/components/animal-exams/AnimalExamModal';
import ExamTypeModal from '@/components/animal-exams/ExamTypeModal';
import BulkExamModal from '@/components/animal-exams/BulkExamModal';
import ExamResultsModal from '@/components/animal-exams/ExamResultsModal';
import { api } from '@/services/api';
import './AnimalExamsPage.css';

type TabKey = 'exams' | 'types' | 'indicators';

export default function AnimalExamsPage() {
  const { selectedFarm } = useFarmContext();

  // ─── Tab state ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('exams');

  // ─── Exams tab state ─────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState<AnimalExamItem | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsExam, setResultsExam] = useState<AnimalExamItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ─── Types tab state ─────────────────────────────────────
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ExamTypeItem | null>(null);
  const [typesPage, setTypesPage] = useState(1);

  // ─── Indicators state ────────────────────────────────────
  const [indicators, setIndicators] = useState<ExamIndicators | null>(null);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);

  // ─── Debounced search ────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Data ────────────────────────────────────────────────
  const { exams, meta, isLoading, error, refetch } = useAnimalExams({
    farmId: selectedFarm?.id ?? null,
    page,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const {
    examTypes,
    meta: typesMeta,
    isLoading: typesLoading,
    error: typesError,
    refetch: refetchTypes,
  } = useExamTypes({ page: typesPage });

  // ─── Load indicators ─────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'indicators' && selectedFarm) {
      setIndicatorsLoading(true);
      void api
        .get<ExamIndicators>(`/org/farms/${selectedFarm.id}/animal-exams/indicators`)
        .then(setIndicators)
        .catch(() => setIndicators(null))
        .finally(() => setIndicatorsLoading(false));
    }
  }, [activeTab, selectedFarm]);

  // ─── Callbacks ───────────────────────────────────────────
  const handleExamSuccess = useCallback(() => {
    setShowExamModal(false);
    setShowBulkModal(false);
    setSelectedExam(null);
    setSuccessMsg(selectedExam ? 'Exame atualizado com sucesso' : 'Exame registrado com sucesso');
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, selectedExam]);

  const handleResultsSuccess = useCallback(() => {
    setShowResultsModal(false);
    setResultsExam(null);
    setSuccessMsg('Resultados registrados com sucesso');
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch]);

  const handleTypeSuccess = useCallback(() => {
    setShowTypeModal(false);
    setSelectedType(null);
    setSuccessMsg(
      selectedType ? 'Tipo de exame atualizado com sucesso' : 'Tipo de exame criado com sucesso',
    );
    void refetchTypes();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetchTypes, selectedType]);

  const handleEditExam = useCallback((e: AnimalExamItem) => {
    setSelectedExam(e);
    setShowExamModal(true);
  }, []);

  const handleRecordResults = useCallback((e: AnimalExamItem, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setResultsExam(e);
    setShowResultsModal(true);
  }, []);

  const handleDeleteExam = useCallback(
    async (e: AnimalExamItem, ev: React.MouseEvent) => {
      ev.stopPropagation();
      setDeleteError(null);
      if (!window.confirm('Excluir este exame? Esta ação não pode ser desfeita.')) return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/animal-exams/${e.id}`);
        setSuccessMsg('Exame excluído com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir exame.');
      }
    },
    [refetch, selectedFarm],
  );

  const handleDeleteType = useCallback(
    async (et: ExamTypeItem, ev: React.MouseEvent) => {
      ev.stopPropagation();
      if (!window.confirm(`Excluir o tipo "${et.name}"? Esta ação não pode ser desfeita.`)) return;
      try {
        await api.delete(`/org/exam-types/${et.id}`);
        setSuccessMsg('Tipo de exame excluído');
        void refetchTypes();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir tipo de exame.');
      }
    },
    [refetchTypes],
  );

  const handleImportResults = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedFarm) return;
      e.target.value = '';

      const resultDate = prompt('Data do resultado (AAAA-MM-DD):');
      if (!resultDate) return;

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('resultDate', resultDate);

        const response = await fetch(
          `/api/org/farms/${selectedFarm.id}/animal-exams/import-results`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
            body: formData,
          },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Erro na importação');

        setSuccessMsg(
          `Importação concluída: ${result.imported} resultado(s) importado(s)${result.skipped > 0 ? `, ${result.skipped} ignorado(s)` : ''}`,
        );
        if (result.errors?.length > 0) {
          setDeleteError(result.errors.slice(0, 3).join('; '));
        }
        void refetch();
        setTimeout(() => setSuccessMsg(null), 8000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao importar resultados');
      }
    },
    [selectedFarm, refetch],
  );

  const handleUploadReport = useCallback(
    async (examItem: AnimalExamItem, file: File) => {
      if (!selectedFarm) return;
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
          `/api/org/farms/${selectedFarm.id}/animal-exams/${examItem.id}/report`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
            body: formData,
          },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Erro no upload');

        setSuccessMsg('Laudo anexado com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao anexar laudo');
      }
    },
    [selectedFarm, refetch],
  );

  const statusTagClass = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'animal-exams-page__tag--pending';
      case 'IN_PROGRESS':
        return 'animal-exams-page__tag--in-progress';
      case 'COMPLETED':
        return 'animal-exams-page__tag--completed';
      case 'CANCELLED':
        return 'animal-exams-page__tag--cancelled';
      default:
        return '';
    }
  };

  const resultBadgeClass = (indicator: string) => {
    switch (indicator) {
      case 'NORMAL':
        return 'animal-exams-page__result-badge--normal';
      case 'ABOVE':
        return 'animal-exams-page__result-badge--above';
      case 'BELOW':
        return 'animal-exams-page__result-badge--below';
      case 'POSITIVE':
        return 'animal-exams-page__result-badge--positive';
      case 'NEGATIVE':
        return 'animal-exams-page__result-badge--negative';
      default:
        return '';
    }
  };

  // ─── No farm selected ───────────────────────────────────
  if (!selectedFarm) {
    return (
      <section className="animal-exams-page">
        <div className="animal-exams-page__empty">
          <FlaskConical size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver os exames.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="animal-exams-page">
      {/* Header */}
      <header className="animal-exams-page__header">
        <div>
          <h1>Exames</h1>
          <p>Registro de exames laboratoriais e de campo — {selectedFarm.name}</p>
        </div>
        {activeTab === 'exams' && (
          <div className="animal-exams-page__actions">
            <button
              type="button"
              className="animal-exams-page__btn-secondary"
              onClick={() => setShowBulkModal(true)}
            >
              <Layers size={20} aria-hidden="true" />
              Examinar lote
            </button>
            <label className="animal-exams-page__btn-secondary" style={{ cursor: 'pointer' }}>
              <FileUp size={20} aria-hidden="true" />
              Importar resultados
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => void handleImportResults(e)}
                aria-label="Importar resultados de exames"
              />
            </label>
            <button
              type="button"
              className="animal-exams-page__btn-primary"
              onClick={() => {
                setSelectedExam(null);
                setShowExamModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" />
              Novo exame
            </button>
          </div>
        )}
        {activeTab === 'types' && (
          <div className="animal-exams-page__actions">
            <button
              type="button"
              className="animal-exams-page__btn-primary"
              onClick={() => {
                setSelectedType(null);
                setShowTypeModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" />
              Novo tipo
            </button>
          </div>
        )}
      </header>

      {/* Success / Error */}
      {successMsg && (
        <div className="animal-exams-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}
      {(error || deleteError || typesError) && (
        <div className="animal-exams-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError || typesError}
        </div>
      )}

      {/* Tabs */}
      <div className="animal-exams-page__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`animal-exams-page__tab ${activeTab === 'exams' ? 'animal-exams-page__tab--active' : ''}`}
          aria-selected={activeTab === 'exams'}
          onClick={() => setActiveTab('exams')}
        >
          <ClipboardList
            size={16}
            aria-hidden="true"
            style={{ marginRight: 6, verticalAlign: 'middle' }}
          />
          Exames
        </button>
        <button
          type="button"
          role="tab"
          className={`animal-exams-page__tab ${activeTab === 'types' ? 'animal-exams-page__tab--active' : ''}`}
          aria-selected={activeTab === 'types'}
          onClick={() => setActiveTab('types')}
        >
          <FileText
            size={16}
            aria-hidden="true"
            style={{ marginRight: 6, verticalAlign: 'middle' }}
          />
          Tipos de exame
        </button>
        <button
          type="button"
          role="tab"
          className={`animal-exams-page__tab ${activeTab === 'indicators' ? 'animal-exams-page__tab--active' : ''}`}
          aria-selected={activeTab === 'indicators'}
          onClick={() => setActiveTab('indicators')}
        >
          <BarChart3
            size={16}
            aria-hidden="true"
            style={{ marginRight: 6, verticalAlign: 'middle' }}
          />
          Indicadores
        </button>
      </div>

      {/* ═══ TAB: Exams ════════════════════════════════════ */}
      {activeTab === 'exams' && (
        <>
          <div className="animal-exams-page__toolbar">
            <div className="animal-exams-page__search">
              <Search size={16} aria-hidden="true" className="animal-exams-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por animal, exame ou responsável..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar exames"
              />
            </div>
            <div className="animal-exams-page__filter">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                {EXAM_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading && <div className="animal-exams-page__loading">Carregando exames...</div>}

          {!isLoading && exams.length === 0 && (
            <div className="animal-exams-page__empty">
              <FlaskConical size={48} aria-hidden="true" />
              <h2>Nenhum exame registrado</h2>
              <p>Registre exames individualmente ou em lote usando os botões acima.</p>
            </div>
          )}

          {!isLoading && exams.length > 0 && (
            <div className="animal-exams-page__grid">
              {exams.map((e) => (
                <div
                  key={e.id}
                  className="animal-exams-page__card"
                  onClick={() => handleEditExam(e)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      handleEditExam(e);
                    }
                  }}
                >
                  <div className="animal-exams-page__card-header">
                    <div>
                      <h3 className="animal-exams-page__card-title">
                        {e.animalEarTag} — {e.animalName || 'Sem nome'}
                      </h3>
                      <p className="animal-exams-page__card-subtitle">{e.examTypeName}</p>
                    </div>
                    <div className="animal-exams-page__card-actions">
                      {(e.status === 'PENDING' || e.status === 'IN_PROGRESS') && (
                        <button
                          type="button"
                          className="animal-exams-page__card-btn animal-exams-page__card-btn--results"
                          onClick={(ev) => handleRecordResults(e, ev)}
                          aria-label={`Registrar resultados de ${e.animalEarTag}`}
                        >
                          <CheckCircle size={16} aria-hidden="true" />
                        </button>
                      )}
                      <label
                        className="animal-exams-page__card-btn"
                        style={{ cursor: 'pointer' }}
                        aria-label={`Anexar laudo de ${e.animalEarTag}`}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <Upload size={16} aria-hidden="true" />
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          style={{ display: 'none' }}
                          onChange={(ev) => {
                            const file = ev.target.files?.[0];
                            if (file) void handleUploadReport(e, file);
                            ev.target.value = '';
                          }}
                        />
                      </label>
                      {e.reportUrl && (
                        <a
                          href={e.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="animal-exams-page__card-btn"
                          onClick={(ev) => ev.stopPropagation()}
                          aria-label={`Ver laudo de ${e.animalEarTag}`}
                        >
                          <Paperclip size={16} aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        className="animal-exams-page__card-btn"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleEditExam(e);
                        }}
                        aria-label={`Editar exame de ${e.animalEarTag}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="animal-exams-page__card-btn animal-exams-page__card-btn--delete"
                        onClick={(ev) => void handleDeleteExam(e, ev)}
                        aria-label={`Excluir exame de ${e.animalEarTag}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="animal-exams-page__card-tags">
                    <span className={`animal-exams-page__tag ${statusTagClass(e.status)}`}>
                      {e.statusLabel}
                    </span>
                    {e.examTypeCategory === 'MANDATORY' && (
                      <span className="animal-exams-page__tag animal-exams-page__tag--regulatory">
                        <Shield size={10} aria-hidden="true" />
                        Regulatório
                      </span>
                    )}
                    <span className="animal-exams-page__tag animal-exams-page__tag--category">
                      {e.examTypeCategoryLabel}
                    </span>
                  </div>

                  <div className="animal-exams-page__card-details">
                    <span className="animal-exams-page__detail">
                      <Calendar size={14} aria-hidden="true" />
                      {new Date(e.collectionDate).toLocaleDateString('pt-BR')}
                    </span>
                    {e.laboratory && (
                      <span className="animal-exams-page__detail">{e.laboratory}</span>
                    )}
                    <span className="animal-exams-page__detail">{e.responsibleName}</span>
                  </div>

                  {e.results.length > 0 && (
                    <div className="animal-exams-page__card-results">
                      {e.results.map((r) =>
                        r.indicator ? (
                          <span
                            key={r.id}
                            className={`animal-exams-page__result-badge ${resultBadgeClass(r.indicator)}`}
                          >
                            {r.paramName}: {r.indicatorLabel}
                          </span>
                        ) : null,
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <nav className="animal-exams-page__pagination" aria-label="Paginação">
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
        </>
      )}

      {/* ═══ TAB: Types ════════════════════════════════════ */}
      {activeTab === 'types' && (
        <>
          {typesLoading && (
            <div className="animal-exams-page__loading">Carregando tipos de exame...</div>
          )}

          {!typesLoading && examTypes.length === 0 && (
            <div className="animal-exams-page__empty">
              <FileText size={48} aria-hidden="true" />
              <h2>Nenhum tipo de exame cadastrado</h2>
              <p>Cadastre tipos de exame para começar a registrar exames do rebanho.</p>
            </div>
          )}

          {!typesLoading && examTypes.length > 0 && (
            <div className="animal-exams-page__types-grid">
              {examTypes.map((et) => (
                <div
                  key={et.id}
                  className="animal-exams-page__type-card"
                  onClick={() => {
                    setSelectedType(et);
                    setShowTypeModal(true);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      setSelectedType(et);
                      setShowTypeModal(true);
                    }
                  }}
                >
                  <div className="animal-exams-page__card-header">
                    <h3 className="animal-exams-page__type-name">{et.name}</h3>
                    <div className="animal-exams-page__card-actions">
                      <button
                        type="button"
                        className="animal-exams-page__card-btn"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedType(et);
                          setShowTypeModal(true);
                        }}
                        aria-label={`Editar ${et.name}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="animal-exams-page__card-btn animal-exams-page__card-btn--delete"
                        onClick={(ev) => void handleDeleteType(et, ev)}
                        aria-label={`Excluir ${et.name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="animal-exams-page__card-tags">
                    <span className="animal-exams-page__tag animal-exams-page__tag--category">
                      {et.categoryLabel}
                    </span>
                    <span className="animal-exams-page__tag">{et.methodLabel}</span>
                    {et.materialLabel && (
                      <span className="animal-exams-page__tag">{et.materialLabel}</span>
                    )}
                    {et.isRegulatory && (
                      <span className="animal-exams-page__tag animal-exams-page__tag--regulatory">
                        <Shield size={10} aria-hidden="true" />
                        Regulatório
                      </span>
                    )}
                  </div>
                  <div className="animal-exams-page__type-meta">
                    {et.defaultLab && <span>Lab: {et.defaultLab}</span>}
                    <span>{et.referenceParams.length} parâmetro(s)</span>
                    {et.validityDays && <span>Validade: {et.validityDays} dias</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {typesMeta && typesMeta.totalPages > 1 && (
            <nav className="animal-exams-page__pagination" aria-label="Paginação de tipos">
              <button
                type="button"
                onClick={() => setTypesPage((p) => Math.max(1, p - 1))}
                disabled={typesPage <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span>
                {typesPage} de {typesMeta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setTypesPage((p) => p + 1)}
                disabled={typesPage >= typesMeta.totalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* ═══ TAB: Indicators ═══════════════════════════════ */}
      {activeTab === 'indicators' && (
        <>
          {indicatorsLoading && (
            <div className="animal-exams-page__loading">Carregando indicadores...</div>
          )}

          {!indicatorsLoading && indicators && (
            <>
              <div className="animal-exams-page__indicators">
                <div className="animal-exams-page__stat-card">
                  <p className="animal-exams-page__stat-label">Resultados pendentes</p>
                  <p
                    className={`animal-exams-page__stat-value ${indicators.pendingResults > 0 ? 'animal-exams-page__stat-value--warning' : ''}`}
                  >
                    {indicators.pendingResults}
                  </p>
                </div>
                <div className="animal-exams-page__stat-card">
                  <p className="animal-exams-page__stat-label">Regulatórios vencidos</p>
                  <p
                    className={`animal-exams-page__stat-value ${indicators.expiredRegulatory > 0 ? 'animal-exams-page__stat-value--error' : ''}`}
                  >
                    {indicators.expiredRegulatory}
                  </p>
                </div>
              </div>

              {indicators.positivityRates.length > 0 && (
                <>
                  <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 12 }}>
                    Taxa de positividade por tipo de exame
                  </h3>
                  <table className="animal-exams-page__rates-table">
                    <thead>
                      <tr>
                        <th scope="col">Tipo de exame</th>
                        <th scope="col">Total</th>
                        <th scope="col">Positivos</th>
                        <th scope="col">Taxa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.positivityRates.map((r) => (
                        <tr key={r.examTypeName}>
                          <td>{r.examTypeName}</td>
                          <td>{r.total}</td>
                          <td>{r.positive}</td>
                          <td>{r.rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {indicators.positivityRates.length === 0 && (
                <div className="animal-exams-page__empty">
                  <BarChart3 size={48} aria-hidden="true" />
                  <h2>Sem dados de positividade</h2>
                  <p>Registre exames com resultados para ver as taxas de positividade.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modals */}
      <AnimalExamModal
        isOpen={showExamModal}
        onClose={() => {
          setShowExamModal(false);
          setSelectedExam(null);
        }}
        exam={selectedExam}
        farmId={selectedFarm.id}
        onSuccess={handleExamSuccess}
      />

      <BulkExamModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleExamSuccess}
      />

      <ExamTypeModal
        isOpen={showTypeModal}
        onClose={() => {
          setShowTypeModal(false);
          setSelectedType(null);
        }}
        examType={selectedType}
        onSuccess={handleTypeSuccess}
      />

      <ExamResultsModal
        isOpen={showResultsModal}
        onClose={() => {
          setShowResultsModal(false);
          setResultsExam(null);
        }}
        exam={resultsExam}
        farmId={selectedFarm.id}
        examTypes={examTypes}
        onSuccess={handleResultsSuccess}
      />
    </section>
  );
}
