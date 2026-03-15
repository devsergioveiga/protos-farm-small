import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  Copy,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  FileDown,
  Layers,
  History,
  FlaskConical,
  Calendar,
  X,
} from 'lucide-react';
import { useDiets } from '@/hooks/useDiets';
import type { DietItem, DietDetail, DietVersionItem, DietLotAssignmentItem } from '@/types/diet';
import { ANIMAL_CATEGORIES } from '@/types/diet';
import DietModal, { NutrientsSummary } from '@/components/diets/DietModal';
import { api } from '@/services/api';
import './DietsPage.css';

type TabId = 'diets' | 'detail';

export default function DietsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('diets');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editDiet, setEditDiet] = useState<DietDetail | null>(null);
  const [selectedDietId, setSelectedDietId] = useState<string | null>(null);
  const [dietDetail, setDietDetail] = useState<DietDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [versions, setVersions] = useState<DietVersionItem[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  const [showLotAssign, setShowLotAssign] = useState(false);
  const [lotId, setLotId] = useState('');
  const [lotStartDate, setLotStartDate] = useState('');
  const [lotEndDate, setLotEndDate] = useState('');
  const [lots, setLots] = useState<Array<{ id: string; name: string }>>([]);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { diets, meta, isLoading, error, refetch } = useDiets({
    page,
    search: search || undefined,
    targetCategory: categoryFilter || undefined,
  });

  // Load detail
  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const result = await api.get<DietDetail>(`/org/diets/${id}`);
      setDietDetail(result);
      setSelectedDietId(id);
      setActiveTab('detail');
    } catch {
      setDeleteError('Erro ao carregar detalhes da dieta');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Load lots for assignment
  useEffect(() => {
    if (showLotAssign) {
      api
        .get<{ data: Array<{ id: string; name: string }> }>('/org/lots?limit=100')
        .then((res) => setLots(res.data))
        .catch(() => setLots([]));
    }
  }, [showLotAssign]);

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setEditDiet(null);
    setSuccessMsg(editDiet ? 'Dieta atualizada com sucesso' : 'Dieta criada com sucesso');
    void refetch();
    if (selectedDietId) void loadDetail(selectedDietId);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, editDiet, selectedDietId, loadDetail]);

  const handleEdit = useCallback(async (diet: DietItem) => {
    try {
      const detail = await api.get<DietDetail>(`/org/diets/${diet.id}`);
      setEditDiet(detail);
      setShowModal(true);
    } catch {
      setDeleteError('Erro ao carregar dieta para edição');
    }
  }, []);

  const handleDelete = useCallback(
    async (diet: DietItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm(`Excluir a dieta "${diet.name}"? Esta ação não pode ser desfeita.`))
        return;
      try {
        await api.delete(`/org/diets/${diet.id}`);
        setSuccessMsg('Dieta excluída com sucesso');
        void refetch();
        if (selectedDietId === diet.id) {
          setDietDetail(null);
          setSelectedDietId(null);
          setActiveTab('diets');
        }
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir dieta');
      }
    },
    [refetch, selectedDietId],
  );

  const handleDuplicate = useCallback(
    async (diet: DietItem, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await api.post(`/org/diets/${diet.id}/duplicate`);
        setSuccessMsg('Dieta duplicada com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao duplicar dieta');
      }
    },
    [refetch],
  );

  const handleExportRecipe = useCallback(async (dietId: string, lotIdParam?: string) => {
    try {
      const qs = lotIdParam ? `?lotId=${lotIdParam}` : '';
      const blob = await api.getBlob(`/org/diets/${dietId}/recipe${qs}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'receita-dieta.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDeleteError('Erro ao exportar receita');
    }
  }, []);

  const handleLoadVersions = useCallback(async (dietId: string) => {
    try {
      const result = await api.get<DietVersionItem[]>(`/org/diets/${dietId}/versions`);
      setVersions(result);
      setShowVersions(true);
    } catch {
      setDeleteError('Erro ao carregar versões');
    }
  }, []);

  const handleAssignLot = useCallback(async () => {
    if (!selectedDietId || !lotId || !lotStartDate) return;
    try {
      await api.post(`/org/diets/${selectedDietId}/lots`, {
        lotId,
        startDate: lotStartDate,
        endDate: lotEndDate || null,
      });
      setShowLotAssign(false);
      setLotId('');
      setLotStartDate('');
      setLotEndDate('');
      setSuccessMsg('Lote vinculado com sucesso');
      void loadDetail(selectedDietId);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao vincular lote');
    }
  }, [selectedDietId, lotId, lotStartDate, lotEndDate, loadDetail]);

  const handleRemoveLot = useCallback(
    async (assignment: DietLotAssignmentItem) => {
      if (!selectedDietId) return;
      if (!window.confirm(`Desvincular o lote "${assignment.lotName}" desta dieta?`)) return;
      try {
        await api.delete(`/org/diets/${selectedDietId}/lots/${assignment.id}`);
        setSuccessMsg('Lote desvinculado com sucesso');
        void loadDetail(selectedDietId);
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao desvincular lote');
      }
    },
    [selectedDietId, loadDetail],
  );

  return (
    <main className="diets-page">
      {/* Header */}
      <div className="diets-page__header">
        <div>
          <h1>Dietas</h1>
          <p>Formulação e gerenciamento de dietas por categoria de animal</p>
        </div>
        <div className="diets-page__actions">
          <button
            type="button"
            className="diets-page__btn-primary"
            onClick={() => {
              setEditDiet(null);
              setShowModal(true);
            }}
          >
            <Plus size={18} aria-hidden="true" />
            Nova dieta
          </button>
        </div>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="diets-page__toast diets-page__toast--success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}
      {deleteError && (
        <div className="diets-page__toast diets-page__toast--error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            aria-label="Fechar alerta"
            className="diets-page__toast-close"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="diets-page__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'diets'}
          className={`diets-page__tab ${activeTab === 'diets' ? 'diets-page__tab--active' : ''}`}
          onClick={() => setActiveTab('diets')}
        >
          <UtensilsCrossed size={16} aria-hidden="true" />
          Dietas
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'detail'}
          className={`diets-page__tab ${activeTab === 'detail' ? 'diets-page__tab--active' : ''}`}
          onClick={() => setActiveTab('detail')}
          disabled={!dietDetail}
        >
          <FlaskConical size={16} aria-hidden="true" />
          Detalhes
        </button>
      </div>

      {/* ═══ TAB: DIETS ═══ */}
      {activeTab === 'diets' && (
        <section role="tabpanel" aria-label="Lista de dietas">
          {/* Filters */}
          <div className="diets-page__filters">
            <div className="diets-page__search">
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                placeholder="Buscar por nome, nutricionista..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar dietas"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por categoria"
              className="diets-page__filter-select"
            >
              <option value="">Todas as categorias</option>
              {ANIMAL_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          {error ? (
            <div className="diets-page__error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : isLoading ? (
            <div className="diets-page__skeleton">
              {[1, 2, 3].map((i) => (
                <div key={i} className="diets-page__skeleton-card" />
              ))}
            </div>
          ) : diets.length === 0 ? (
            <div className="diets-page__empty">
              <UtensilsCrossed size={48} aria-hidden="true" />
              <h3>Nenhuma dieta cadastrada</h3>
              <p>Crie a primeira dieta para gerenciar a nutrição dos seus animais.</p>
              <button
                type="button"
                className="diets-page__btn-primary"
                onClick={() => {
                  setEditDiet(null);
                  setShowModal(true);
                }}
              >
                <Plus size={18} aria-hidden="true" />
                Criar primeira dieta
              </button>
            </div>
          ) : (
            <>
              <div className="diets-page__cards">
                {diets.map((diet) => (
                  <article
                    key={diet.id}
                    className={`diets-page__card ${!diet.isActive ? 'diets-page__card--inactive' : ''}`}
                    onClick={() => loadDetail(diet.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void loadDetail(diet.id);
                      }
                    }}
                    aria-label={`Ver detalhes de ${diet.name}`}
                  >
                    <div className="diets-page__card-header">
                      <div>
                        <h3>{diet.name}</h3>
                        <span className="diets-page__card-category">
                          {diet.targetCategoryLabel}
                        </span>
                      </div>
                      <div className="diets-page__card-actions">
                        {diet.version > 1 && (
                          <span className="diets-page__version-badge">v{diet.version}</span>
                        )}
                        {!diet.isActive && (
                          <span className="diets-page__inactive-badge">Inativa</span>
                        )}
                      </div>
                    </div>

                    <div className="diets-page__card-nutrients">
                      <div className="diets-page__card-nutrient">
                        <span className="diets-page__card-nutrient-label">MS</span>
                        <span className="diets-page__card-nutrient-value">
                          {diet.nutrients.totalDmKgDay?.toFixed(1) ?? '--'} kg
                        </span>
                      </div>
                      <div className="diets-page__card-nutrient">
                        <span className="diets-page__card-nutrient-label">PB</span>
                        <span className="diets-page__card-nutrient-value">
                          {diet.nutrients.cpPercentDm?.toFixed(1) ?? '--'}%
                        </span>
                      </div>
                      <div className="diets-page__card-nutrient">
                        <span className="diets-page__card-nutrient-label">NDT</span>
                        <span className="diets-page__card-nutrient-value">
                          {diet.nutrients.tdnPercentDm?.toFixed(1) ?? '--'}%
                        </span>
                      </div>
                      <div className="diets-page__card-nutrient">
                        <span className="diets-page__card-nutrient-label">CUSTO</span>
                        <span className="diets-page__card-nutrient-value">
                          {diet.nutrients.costPerAnimalDay != null
                            ? `R$ ${diet.nutrients.costPerAnimalDay.toFixed(2)}`
                            : '--'}
                        </span>
                      </div>
                    </div>

                    <div className="diets-page__card-footer">
                      <span className="diets-page__card-meta">
                        <UtensilsCrossed size={14} aria-hidden="true" />
                        {diet.ingredientCount} ingredientes
                      </span>
                      <span className="diets-page__card-meta">
                        <Layers size={14} aria-hidden="true" />
                        {diet.lotCount} lotes
                      </span>
                      <div className="diets-page__card-btn-group">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleEdit(diet);
                          }}
                          aria-label={`Editar ${diet.name}`}
                          className="diets-page__icon-btn"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void handleDuplicate(diet, e)}
                          aria-label={`Duplicar ${diet.name}`}
                          className="diets-page__icon-btn"
                        >
                          <Copy size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void handleDelete(diet, e)}
                          aria-label={`Excluir ${diet.name}`}
                          className="diets-page__icon-btn diets-page__icon-btn--danger"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="diets-page__pagination">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <span>
                    {meta.page} de {meta.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ═══ TAB: DETAIL ═══ */}
      {activeTab === 'detail' && (
        <section role="tabpanel" aria-label="Detalhes da dieta">
          {detailLoading ? (
            <div className="diets-page__skeleton">
              <div className="diets-page__skeleton-card" style={{ height: '200px' }} />
            </div>
          ) : !dietDetail ? (
            <div className="diets-page__empty">
              <FlaskConical size={48} aria-hidden="true" />
              <h3>Selecione uma dieta</h3>
              <p>Clique em uma dieta na lista para ver os detalhes.</p>
            </div>
          ) : (
            <div className="diets-page__detail">
              {/* Detail header */}
              <div className="diets-page__detail-header">
                <div>
                  <h2>{dietDetail.name}</h2>
                  <div className="diets-page__detail-meta">
                    <span>{dietDetail.targetCategoryLabel}</span>
                    {dietDetail.nutritionist && (
                      <span>Nutricionista: {dietDetail.nutritionist}</span>
                    )}
                    {dietDetail.objective && <span>Objetivo: {dietDetail.objective}</span>}
                    {dietDetail.startDate && (
                      <span>
                        <Calendar size={14} aria-hidden="true" />
                        {dietDetail.startDate}
                        {dietDetail.endDate ? ` a ${dietDetail.endDate}` : ''}
                      </span>
                    )}
                    <span>Versão {dietDetail.version}</span>
                  </div>
                </div>
                <div className="diets-page__detail-actions">
                  <button
                    type="button"
                    className="diets-page__btn-outline"
                    onClick={() => void handleLoadVersions(dietDetail.id)}
                  >
                    <History size={16} aria-hidden="true" />
                    Versões
                  </button>
                  <button
                    type="button"
                    className="diets-page__btn-outline"
                    onClick={() => void handleExportRecipe(dietDetail.id)}
                  >
                    <FileDown size={16} aria-hidden="true" />
                    Receita CSV
                  </button>
                  <button
                    type="button"
                    className="diets-page__btn-outline"
                    onClick={() => void handleEdit(dietDetail)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Editar
                  </button>
                </div>
              </div>

              {/* Nutrients */}
              <div className="diets-page__detail-section">
                <h3>Composição nutricional calculada</h3>
                <NutrientsSummary nutrients={dietDetail.nutrients} />
              </div>

              {/* Ingredients table */}
              <div className="diets-page__detail-section">
                <h3>Ingredientes ({dietDetail.ingredients.length})</h3>
                <div className="diets-page__table-wrapper">
                  <table className="diets-page__table">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Ingrediente</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">kg MN/dia</th>
                        <th scope="col">kg MS/dia</th>
                        <th scope="col">PB g/dia</th>
                        <th scope="col">R$/dia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dietDetail.ingredients.map((ing, idx) => (
                        <tr key={ing.id}>
                          <td>{idx + 1}</td>
                          <td>{ing.feedIngredientName}</td>
                          <td>
                            <span
                              className={`diets-page__type-badge diets-page__type-badge--${ing.feedIngredientType.toLowerCase()}`}
                            >
                              {ing.feedIngredientType === 'ROUGHAGE' ? 'Volumoso' : 'Concentrado'}
                            </span>
                          </td>
                          <td className="diets-page__td-mono">{ing.quantityKgDay.toFixed(3)}</td>
                          <td className="diets-page__td-mono">{ing.dmKgDay?.toFixed(3) ?? '--'}</td>
                          <td className="diets-page__td-mono">{ing.cpGDay?.toFixed(1) ?? '--'}</td>
                          <td className="diets-page__td-mono">
                            {ing.costPerDay?.toFixed(4) ?? '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lot assignments */}
              <div className="diets-page__detail-section">
                <div className="diets-page__detail-section-header">
                  <h3>Lotes vinculados ({dietDetail.lotAssignments.length})</h3>
                  <button
                    type="button"
                    className="diets-page__btn-outline diets-page__btn-outline--sm"
                    onClick={() => setShowLotAssign(true)}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Vincular lote
                  </button>
                </div>

                {dietDetail.lotAssignments.length === 0 ? (
                  <p className="diets-page__no-data">Nenhum lote vinculado a esta dieta.</p>
                ) : (
                  <div className="diets-page__lot-cards">
                    {dietDetail.lotAssignments.map((la) => (
                      <div key={la.id} className="diets-page__lot-card">
                        <div className="diets-page__lot-info">
                          <strong>{la.lotName}</strong>
                          <span>{la.animalCount} animais</span>
                          <span>
                            {la.startDate}
                            {la.endDate ? ` a ${la.endDate}` : ''}
                          </span>
                        </div>
                        <div className="diets-page__lot-actions">
                          <button
                            type="button"
                            className="diets-page__icon-btn"
                            onClick={() => void handleExportRecipe(dietDetail.id, la.lotId)}
                            aria-label={`Exportar receita para ${la.lotName}`}
                          >
                            <FileDown size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="diets-page__icon-btn diets-page__icon-btn--danger"
                            onClick={() => void handleRemoveLot(la)}
                            aria-label={`Desvincular ${la.lotName}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Diet Modal (create/edit) */}
      <DietModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditDiet(null);
        }}
        onSuccess={handleSuccess}
        editDiet={editDiet}
      />

      {/* Versions modal */}
      {showVersions && (
        <div
          className="diet-modal__overlay"
          onClick={() => setShowVersions(false)}
          aria-hidden="true"
        >
          <div
            className="diets-page__versions-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Histórico de versões"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diet-modal__header">
              <h2>Histórico de versões</h2>
              <button
                type="button"
                className="diet-modal__close"
                onClick={() => setShowVersions(false)}
                aria-label="Fechar"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="diets-page__versions-body">
              {versions.length === 0 ? (
                <p className="diets-page__no-data">Sem histórico de versões.</p>
              ) : (
                <ul className="diets-page__versions-list">
                  {versions.map((v) => (
                    <li
                      key={v.id}
                      className={`diets-page__version-item ${v.isActive ? 'diets-page__version-item--active' : ''}`}
                    >
                      <div>
                        <strong>Versão {v.version}</strong>
                        <span className="diets-page__version-date">
                          {new Date(v.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div>
                        <span>{v.creatorName}</span>
                        {v.isActive && <span className="diets-page__active-badge">Ativa</span>}
                      </div>
                      <button
                        type="button"
                        className="diets-page__btn-outline diets-page__btn-outline--sm"
                        onClick={() => {
                          setShowVersions(false);
                          void loadDetail(v.id);
                        }}
                      >
                        Ver
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lot assignment modal */}
      {showLotAssign && (
        <div
          className="diet-modal__overlay"
          onClick={() => setShowLotAssign(false)}
          aria-hidden="true"
        >
          <div
            className="diets-page__lot-assign-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Vincular lote"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diet-modal__header">
              <h2>Vincular lote</h2>
              <button
                type="button"
                className="diet-modal__close"
                onClick={() => setShowLotAssign(false)}
                aria-label="Fechar"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="diets-page__lot-assign-body">
              <div className="diet-modal__field">
                <label htmlFor="lot-select">
                  Lote <span aria-hidden="true">*</span>
                </label>
                <select
                  id="lot-select"
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                  required
                  aria-required="true"
                >
                  <option value="">Selecione...</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="diet-modal__field">
                <label htmlFor="lot-start">
                  Data inicial <span aria-hidden="true">*</span>
                </label>
                <input
                  id="lot-start"
                  type="date"
                  value={lotStartDate}
                  onChange={(e) => setLotStartDate(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>
              <div className="diet-modal__field">
                <label htmlFor="lot-end">Data final</label>
                <input
                  id="lot-end"
                  type="date"
                  value={lotEndDate}
                  onChange={(e) => setLotEndDate(e.target.value)}
                />
              </div>
              <div className="diet-modal__footer">
                <button
                  type="button"
                  className="diet-modal__btn-secondary"
                  onClick={() => setShowLotAssign(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="diet-modal__btn-primary"
                  onClick={() => void handleAssignLot()}
                  disabled={!lotId || !lotStartDate}
                >
                  Vincular
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
