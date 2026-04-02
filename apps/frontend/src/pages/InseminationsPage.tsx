import { useState, useEffect, useCallback } from 'react';
import {
  Syringe,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Beef,
  Trash2,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { api } from '@/services/api';
import type { InseminationItem } from '@/types/iatf-execution';
import type { NaturalMatingItem, NaturalMatingDetail } from '@/types/natural-mating';
import { REASON_CONFIG } from '@/types/natural-mating';
import BulkInseminationModal from '@/components/inseminations/BulkInseminationModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import './InseminationsPage.css';

type ActiveTab = 'inseminations' | 'coberturas';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function InseminationsPage() {
  const { selectedFarm } = useFarmContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('inseminations');

  // Insemination state
  const [inseminations, setInseminations] = useState<InseminationItem[]>([]);
  const [insemTotal, setInsemTotal] = useState(0);
  const [insemPage, setInsemPage] = useState(1);
  const [insemLoading, setInsemLoading] = useState(true);
  const [insemError, setInsemError] = useState<string | null>(null);

  // Cobertura (natural mating) state
  const [coberturas, setCoberturas] = useState<NaturalMatingItem[]>([]);
  const [cobTotal, setCobTotal] = useState(0);
  const [cobPage, setCobPage] = useState(1);
  const [cobLoading, setCobLoading] = useState(true);
  const [cobError, setCobError] = useState<string | null>(null);
  const [expandedCobId, setExpandedCobId] = useState<string | null>(null);
  const [cobDetail, setCobDetail] = useState<NaturalMatingDetail | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const limit = 20;

  const fetchInseminations = useCallback(async () => {
    if (!selectedFarm) return;
    setInsemLoading(true);
    setInsemError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(insemPage));
      params.set('limit', String(limit));
      if (typeFilter) params.set('inseminationType', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get<{
        data: InseminationItem[];
        meta: { total: number };
      }>(`/org/farms/${selectedFarm.id}/inseminations?${params.toString()}`);

      let filtered = res.data;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(
          (i) =>
            i.animalEarTag.toLowerCase().includes(q) ||
            (i.animalName && i.animalName.toLowerCase().includes(q)) ||
            (i.bullName && i.bullName.toLowerCase().includes(q)) ||
            i.inseminatorName.toLowerCase().includes(q),
        );
      }

      setInseminations(filtered);
      setInsemTotal(res.meta.total);
    } catch (err) {
      setInsemError(err instanceof Error ? err.message : 'Erro ao carregar inseminações');
    } finally {
      setInsemLoading(false);
    }
  }, [selectedFarm, insemPage, typeFilter, dateFrom, dateTo, search]);

  const fetchCoberturas = useCallback(async () => {
    if (!selectedFarm) return;
    setCobLoading(true);
    setCobError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(cobPage));
      params.set('limit', String(limit));

      const res = await api.get<{
        data: NaturalMatingItem[];
        total: number;
      }>(`/org/farms/${selectedFarm.id}/natural-matings?${params.toString()}`);

      let filtered = res.data;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(
          (m) =>
            (m.bullName && m.bullName.toLowerCase().includes(q)) ||
            (m.bullBreedName && m.bullBreedName.toLowerCase().includes(q)),
        );
      }

      setCoberturas(filtered);
      setCobTotal(res.total);
    } catch (err) {
      setCobError(err instanceof Error ? err.message : 'Erro ao carregar coberturas');
    } finally {
      setCobLoading(false);
    }
  }, [selectedFarm, cobPage, search]);

  useEffect(() => {
    if (activeTab === 'inseminations') void fetchInseminations();
  }, [fetchInseminations, activeTab]);

  useEffect(() => {
    if (activeTab === 'coberturas') void fetchCoberturas();
  }, [fetchCoberturas, activeTab]);

  // Load cobertura detail when expanded
  useEffect(() => {
    if (!expandedCobId || !selectedFarm) {
      setCobDetail(null);
      return;
    }
    void api
      .get<NaturalMatingDetail>(`/org/farms/${selectedFarm.id}/natural-matings/${expandedCobId}`)
      .then((res) => setCobDetail(res))
      .catch(() => setCobDetail(null));
  }, [expandedCobId, selectedFarm]);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleDeleteCobertura() {
    if (!deleteConfirmId || !selectedFarm) return;
    try {
      await api.delete(`/org/farms/${selectedFarm.id}/natural-matings/${deleteConfirmId}`);
      setDeleteConfirmId(null);
      setExpandedCobId(null);
      showToast('success', 'Cobertura excluída com sucesso');
      void fetchCoberturas();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao excluir cobertura');
      setDeleteConfirmId(null);
    }
  }

  const insemTotalPages = Math.ceil(insemTotal / limit);
  const cobTotalPages = Math.ceil(cobTotal / limit);

  if (!selectedFarm) {
    return (
      <main className="inseminations-page">
        <div className="inseminations-page__empty">
          <Syringe size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="inseminations-page__empty-title">Selecione uma fazenda</h2>
          <p className="inseminations-page__empty-desc">
            Escolha uma fazenda no seletor acima para gerenciar inseminações e coberturas.
          </p>
        </div>
      </main>
    );
  }

  const isLoading = activeTab === 'inseminations' ? insemLoading : cobLoading;
  const error = activeTab === 'inseminations' ? insemError : cobError;

  return (
    <main className="inseminations-page">
      {toast && (
        <div
          className={`inseminations-page__toast inseminations-page__toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      <header className="inseminations-page__header">
        <div>
          <h1 className="inseminations-page__title">Inseminações e Coberturas</h1>
          <p className="inseminations-page__subtitle">
            Registre inseminações artificiais ou coberturas por touro
          </p>
        </div>
        <button
          type="button"
          className="inseminations-page__btn-primary"
          onClick={() => setShowModal(true)}
        >
          <Plus size={20} aria-hidden="true" />
          Novo registro
        </button>
      </header>

      {/* Tabs */}
      <div className="inseminations-page__tabs" role="tablist" aria-label="Tipo de registro">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inseminations'}
          className={`inseminations-page__tab ${activeTab === 'inseminations' ? 'inseminations-page__tab--active' : ''}`}
          onClick={() => setActiveTab('inseminations')}
        >
          <Syringe size={16} aria-hidden="true" />
          Inseminações
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'coberturas'}
          className={`inseminations-page__tab ${activeTab === 'coberturas' ? 'inseminations-page__tab--active' : ''}`}
          onClick={() => setActiveTab('coberturas')}
        >
          <Beef size={16} aria-hidden="true" />
          Coberturas
        </button>
      </div>

      {/* Filters */}
      <section className="inseminations-page__filters">
        <div className="inseminations-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder={
              activeTab === 'inseminations'
                ? 'Buscar por brinco, nome, touro ou inseminador...'
                : 'Buscar por touro ou raça...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar registros"
          />
        </div>
        {activeTab === 'inseminations' && (
          <div className="inseminations-page__filter-group">
            <Filter size={16} aria-hidden="true" className="inseminations-page__filter-icon" />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setInsemPage(1);
              }}
              aria-label="Filtrar por tipo"
            >
              <option value="">Todos os tipos</option>
              <option value="IATF">IATF</option>
              <option value="NATURAL_HEAT">Cio natural</option>
              <option value="HEAT_DURING_PROTOCOL">Cio durante protocolo</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setInsemPage(1);
              }}
              aria-label="Data inicial"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setInsemPage(1);
              }}
              aria-label="Data final"
            />
          </div>
        )}
      </section>

      {isLoading ? (
        <div className="inseminations-page__skeleton">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="inseminations-page__skeleton-row" />
          ))}
        </div>
      ) : error ? (
        <div className="inseminations-page__error" role="alert">
          {error}
          <button
            type="button"
            onClick={() =>
              void (activeTab === 'inseminations' ? fetchInseminations() : fetchCoberturas())
            }
          >
            Tentar novamente
          </button>
        </div>
      ) : activeTab === 'inseminations' ? (
        /* ─── Inseminations Tab ─── */
        inseminations.length === 0 ? (
          <div className="inseminations-page__empty">
            <Syringe size={48} color="var(--color-neutral-400)" aria-hidden="true" />
            <h2 className="inseminations-page__empty-title">Nenhuma inseminação encontrada</h2>
            <p className="inseminations-page__empty-desc">
              Registre a primeira inseminação para começar o acompanhamento reprodutivo.
            </p>
            <button
              type="button"
              className="inseminations-page__btn-primary"
              onClick={() => setShowModal(true)}
            >
              <Plus size={20} aria-hidden="true" />
              Novo registro
            </button>
          </div>
        ) : (
          <>
            <div className="inseminations-page__table-wrapper">
              <table className="inseminations-page__table">
                <thead>
                  <tr>
                    <th scope="col">Brinco</th>
                    <th scope="col">Nome</th>
                    <th scope="col">Data</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Protocolo</th>
                    <th scope="col">Touro</th>
                    <th scope="col">Tipo sêmen</th>
                    <th scope="col">Inseminador</th>
                    <th scope="col">Doses</th>
                  </tr>
                </thead>
                <tbody>
                  {inseminations.map((ins) => (
                    <tr key={ins.id}>
                      <td className="inseminations-page__cell-tag">{ins.animalEarTag}</td>
                      <td>{ins.animalName || '—'}</td>
                      <td>{formatDate(ins.inseminationDate)}</td>
                      <td>
                        <span
                          className={`inseminations-page__badge inseminations-page__badge--${ins.inseminationType.toLowerCase()}`}
                        >
                          {ins.inseminationTypeLabel}
                        </span>
                      </td>
                      <td>
                        {ins.protocolName ? (
                          <span className="inseminations-page__protocol-tag">
                            {ins.protocolName}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{ins.bullName || '—'}</td>
                      <td>{ins.semenTypeLabel || '—'}</td>
                      <td>{ins.inseminatorName}</td>
                      <td className="inseminations-page__cell-center">{ins.dosesUsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="inseminations-page__cards">
              {inseminations.map((ins) => (
                <div key={ins.id} className="inseminations-page__card">
                  <div className="inseminations-page__card-header">
                    <span className="inseminations-page__card-tag">{ins.animalEarTag}</span>
                    <span
                      className={`inseminations-page__badge inseminations-page__badge--${ins.inseminationType.toLowerCase()}`}
                    >
                      {ins.inseminationTypeLabel}
                    </span>
                  </div>
                  {ins.animalName && (
                    <p className="inseminations-page__card-name">{ins.animalName}</p>
                  )}
                  {ins.protocolName && (
                    <p className="inseminations-page__card-protocol">
                      <span className="inseminations-page__protocol-tag">{ins.protocolName}</span>
                    </p>
                  )}
                  <div className="inseminations-page__card-details">
                    <span>{formatDate(ins.inseminationDate)}</span>
                    <span>{ins.bullName || 'Sem touro'}</span>
                    {ins.semenTypeLabel && <span>{ins.semenTypeLabel}</span>}
                    <span>{ins.inseminatorName}</span>
                  </div>
                </div>
              ))}
            </div>

            {insemTotalPages > 1 && (
              <nav className="inseminations-page__pagination" aria-label="Paginação">
                <button
                  type="button"
                  onClick={() => setInsemPage((p) => Math.max(1, p - 1))}
                  disabled={insemPage === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <span>
                  Página {insemPage} de {insemTotalPages} ({insemTotal} registros)
                </span>
                <button
                  type="button"
                  onClick={() => setInsemPage((p) => Math.min(insemTotalPages, p + 1))}
                  disabled={insemPage === insemTotalPages}
                  aria-label="Próxima página"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )
      ) : /* ─── Coberturas Tab ─── */
      coberturas.length === 0 ? (
        <div className="inseminations-page__empty">
          <Beef size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="inseminations-page__empty-title">Nenhuma cobertura encontrada</h2>
          <p className="inseminations-page__empty-desc">
            Registre a primeira cobertura por touro para começar o acompanhamento.
          </p>
          <button
            type="button"
            className="inseminations-page__btn-primary"
            onClick={() => setShowModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Novo registro
          </button>
        </div>
      ) : (
        <>
          <div className="inseminations-page__table-wrapper">
            <table className="inseminations-page__table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Touro</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Fêmeas</th>
                  <th scope="col">Observações</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {coberturas.map((cob) => {
                  const reasonCfg = REASON_CONFIG[cob.reason as keyof typeof REASON_CONFIG];
                  const isExpanded = expandedCobId === cob.id;
                  return (
                    <>
                      <tr
                        key={cob.id}
                        className={isExpanded ? 'inseminations-page__row--expanded' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedCobId(isExpanded ? null : cob.id)}
                      >
                        <td>{formatDate(cob.entryDate)}</td>
                        <td>{cob.bullName || cob.bullBreedName || '—'}</td>
                        <td>
                          <span
                            className={`inseminations-page__badge inseminations-page__badge--${
                              cob.reason === 'POST_IATF_REPASSE' ? 'repasse' : 'direct'
                            }`}
                          >
                            {reasonCfg?.label || cob.reasonLabel}
                          </span>
                        </td>
                        <td className="inseminations-page__cell-center">{cob.animalCount}</td>
                        <td>{cob.notes || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="inseminations-page__action-btn inseminations-page__action-btn--delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(cob.id);
                            }}
                            aria-label="Excluir cobertura"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && cobDetail && cobDetail.id === cob.id && (
                        <tr key={`${cob.id}-detail`}>
                          <td colSpan={6} className="inseminations-page__detail-cell">
                            <div className="inseminations-page__detail-panel">
                              <strong>Fêmeas cobertas ({cobDetail.animals.length}):</strong>
                              <ul className="inseminations-page__detail-list">
                                {cobDetail.animals.map((a) => (
                                  <li key={a.id}>
                                    <span className="inseminations-page__cell-tag">{a.earTag}</span>
                                    {a.animalName && ` — ${a.animalName}`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="inseminations-page__cards">
            {coberturas.map((cob) => {
              const reasonCfg = REASON_CONFIG[cob.reason as keyof typeof REASON_CONFIG];
              return (
                <div key={cob.id} className="inseminations-page__card">
                  <div className="inseminations-page__card-header">
                    <span className="inseminations-page__card-tag">
                      {cob.bullName || cob.bullBreedName || 'Touro desconhecido'}
                    </span>
                    <span
                      className={`inseminations-page__badge inseminations-page__badge--${
                        cob.reason === 'POST_IATF_REPASSE' ? 'repasse' : 'direct'
                      }`}
                    >
                      {reasonCfg?.label || cob.reasonLabel}
                    </span>
                  </div>
                  <div className="inseminations-page__card-details">
                    <span>{formatDate(cob.entryDate)}</span>
                    <span>{cob.animalCount} fêmea(s)</span>
                  </div>
                  {cob.notes && <p className="inseminations-page__card-name">{cob.notes}</p>}
                  <button
                    type="button"
                    className="inseminations-page__action-btn inseminations-page__action-btn--delete"
                    onClick={() => setDeleteConfirmId(cob.id)}
                    aria-label="Excluir cobertura"
                    style={{ marginTop: 8 }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          {cobTotalPages > 1 && (
            <nav className="inseminations-page__pagination" aria-label="Paginação">
              <button
                type="button"
                onClick={() => setCobPage((p) => Math.max(1, p - 1))}
                disabled={cobPage === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span>
                Página {cobPage} de {cobTotalPages} ({cobTotal} registros)
              </span>
              <button
                type="button"
                onClick={() => setCobPage((p) => Math.min(cobTotalPages, p + 1))}
                disabled={cobPage === cobTotalPages}
                aria-label="Próxima página"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      <BulkInseminationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        farmId={selectedFarm.id}
        onSuccess={(count) => {
          setShowModal(false);
          void fetchInseminations();
          void fetchCoberturas();
          showToast('success', `${count} registro(s) salvo(s) com sucesso`);
        }}
      />

      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => void handleDeleteCobertura()}
        title="Excluir cobertura"
        message="Tem certeza que deseja excluir este registro de cobertura? Esta ação não pode ser desfeita."
        variant="danger"
        confirmLabel="Excluir"
      />
    </main>
  );
}

export default InseminationsPage;
