import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Leaf, Trash2, ArrowUp, ArrowDown, AlertCircle, Minus } from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useBiologicalAssets } from '@/hooks/useBiologicalAssets';
import BiologicalAssetValuationModal from '@/components/assets/BiologicalAssetValuationModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  GROUP_TYPE_LABELS,
  ANIMAL_GROUPS,
  PERENNIAL_CROP_GROUPS,
} from '@/types/asset';
import type { BiologicalValuationOutput, BiologicalGroupType } from '@/types/asset';
import './BiologicalAssetsPage.css';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatBRL(value: number): string {
  return currencyFmt.format(value);
}

const numberFmt = new Intl.NumberFormat('pt-BR');

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

const ALL_GROUPS = [...ANIMAL_GROUPS, ...PERENNIAL_CROP_GROUPS];

function groupLabel(assetGroup: string): string {
  const found = ALL_GROUPS.find((g) => g.value === assetGroup);
  return found ? found.label : assetGroup;
}

function qtyDisplay(v: BiologicalValuationOutput): string {
  if (v.groupType === 'ANIMAL' && v.headCount != null) {
    return `${numberFmt.format(v.headCount)} cab`;
  }
  if (v.areaHa != null) {
    return `${numberFmt.format(v.areaHa)} ha`;
  }
  return '-';
}

// ─── Skeleton ───────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div role="status" aria-label="Carregando ativos biologicos">
      <div className="bio-assets__summary">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bio-assets__kpi-skeleton" />
        ))}
      </div>
      <div className="bio-assets__table-wrapper">
        <table className="bio-assets__table">
          <thead>
            <tr>
              <th scope="col">DATA</th>
              <th scope="col">FAZENDA</th>
              <th scope="col">GRUPO</th>
              <th scope="col">TIPO</th>
              <th scope="col">QTD/AREA</th>
              <th scope="col">PRECO UNITARIO</th>
              <th scope="col">VALOR JUSTO</th>
              <th scope="col">VARIACAO</th>
              <th scope="col">ACOES</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j}>
                    <div className="bio-assets__kpi-skeleton" style={{ height: 16, borderRadius: 4 }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── BiologicalAssetsPage ───────────────────────────────────────────────────────

export default function BiologicalAssetsPage() {
  const { farms, selectedFarmId } = useFarmContext();
  const { valuations, summary, loading, error, refetch, createValuation, deleteValuation } =
    useBiologicalAssets();

  const [farmFilter, setFarmFilter] = useState<string>(selectedFarmId ?? '');
  const [groupTypeFilter, setGroupTypeFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BiologicalValuationOutput | null>(null);
  const [deleting, setDeleting] = useState(false);

  const initialFetchDone = useRef(false);

  // Initial fetch
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      refetch(farmFilter || undefined, undefined, groupTypeFilter || undefined);
    }
  }, [refetch, farmFilter, groupTypeFilter]);

  // Refetch on filter changes
  const handleFarmChange = useCallback(
    (value: string) => {
      setFarmFilter(value);
      refetch(value || undefined, undefined, groupTypeFilter || undefined);
    },
    [refetch, groupTypeFilter],
  );

  const handleGroupTypeChange = useCallback(
    (value: string) => {
      setGroupTypeFilter(value);
      refetch(farmFilter || undefined, undefined, value || undefined);
    },
    [refetch, farmFilter],
  );

  // Modal handlers
  const handleCreateSuccess = useCallback(() => {
    setModalOpen(false);
    refetch(farmFilter || undefined, undefined, groupTypeFilter || undefined);
  }, [refetch, farmFilter, groupTypeFilter]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteValuation(deleteTarget.id);
      refetch(farmFilter || undefined, undefined, groupTypeFilter || undefined);
    } catch {
      // error handled by hook
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteValuation, refetch, farmFilter, groupTypeFilter]);

  return (
    <main className="bio-assets__page" id="main-content">
      {/* Breadcrumb */}
      <nav className="bio-assets__breadcrumb" aria-label="Caminho de navegacao">
        <Link to="/patrimony">Patrimonio</Link>
        <span className="bio-assets__breadcrumb-sep" aria-hidden="true">&gt;</span>
        <span className="bio-assets__breadcrumb-current" aria-current="page">
          Ativos Biologicos
        </span>
      </nav>

      {/* Header */}
      <header className="bio-assets__header">
        <div>
          <h1 className="bio-assets__title">Ativos Biologicos</h1>
          <p className="bio-assets__subtitle">
            Avaliacoes de valor justo do rebanho e culturas perenes (CPC 29)
          </p>
        </div>
        <button
          type="button"
          className="bio-assets__btn-new"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={20} aria-hidden="true" />
          Nova Avaliacao
        </button>
      </header>

      {/* Error */}
      {error && (
        <div className="bio-assets__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          Nao foi possivel carregar as avaliacoes. Verifique sua conexao e tente novamente.
        </div>
      )}

      {/* Loading */}
      {loading && valuations.length === 0 && <PageSkeleton />}

      {/* KPI Summary */}
      {!loading && summary.length > 0 && (
        <section className="bio-assets__summary" aria-label="Resumo por grupo">
          {summary.map((item) => {
            const change = item.latestFairValueChange;
            const isPositive = change != null && change > 0;
            const isNegative = change != null && change < 0;
            const changeClass = isPositive
              ? 'bio-assets__kpi-change--positive'
              : isNegative
                ? 'bio-assets__kpi-change--negative'
                : 'bio-assets__kpi-change--neutral';

            return (
              <div key={item.assetGroup} className="bio-assets__kpi">
                <div className="bio-assets__kpi-label">{groupLabel(item.assetGroup)}</div>
                <div className="bio-assets__kpi-value">
                  {formatBRL(item.latestTotalFairValue)}
                </div>
                <div className={`bio-assets__kpi-change ${changeClass}`}>
                  {isPositive && <ArrowUp size={14} aria-hidden="true" />}
                  {isNegative && <ArrowDown size={14} aria-hidden="true" />}
                  {!isPositive && !isNegative && <Minus size={14} aria-hidden="true" />}
                  {change != null ? formatBRL(Math.abs(change)) : 'Sem variacao'}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Filters */}
      {!loading && (
        <div className="bio-assets__filters">
          <select
            className="bio-assets__filter-select"
            value={farmFilter}
            onChange={(e) => handleFarmChange(e.target.value)}
            aria-label="Filtrar por fazenda"
          >
            <option value="">Todas as fazendas</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <select
            className="bio-assets__filter-select"
            value={groupTypeFilter}
            onChange={(e) => handleGroupTypeChange(e.target.value)}
            aria-label="Filtrar por tipo de grupo"
          >
            <option value="">Todos os tipos</option>
            {(Object.entries(GROUP_TYPE_LABELS) as [BiologicalGroupType, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>
      )}

      {/* Content */}
      {!loading && valuations.length === 0 && !error && (
        <div className="bio-assets__empty">
          <Leaf size={48} aria-hidden="true" className="bio-assets__empty-icon" />
          <h2 className="bio-assets__empty-title">Nenhuma avaliacao registrada</h2>
          <p className="bio-assets__empty-desc">
            Registre a primeira avaliacao de valor justo dos seus ativos biologicos.
          </p>
          <button
            type="button"
            className="bio-assets__empty-btn"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Nova Avaliacao
          </button>
        </div>
      )}

      {!loading && valuations.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="bio-assets__table-wrapper">
            <table className="bio-assets__table">
              <thead>
                <tr>
                  <th scope="col">DATA</th>
                  <th scope="col">FAZENDA</th>
                  <th scope="col">GRUPO</th>
                  <th scope="col">TIPO</th>
                  <th scope="col">QTD/AREA</th>
                  <th scope="col">PRECO UNITARIO</th>
                  <th scope="col">VALOR JUSTO</th>
                  <th scope="col">VARIACAO</th>
                  <th scope="col">ACOES</th>
                </tr>
              </thead>
              <tbody>
                {valuations.map((v) => {
                  const change = v.fairValueChange;
                  const isPositive = change != null && change > 0;
                  const isNegative = change != null && change < 0;
                  const variationClass = isPositive
                    ? 'bio-assets__variation--positive'
                    : isNegative
                      ? 'bio-assets__variation--negative'
                      : 'bio-assets__variation--neutral';

                  return (
                    <tr key={v.id}>
                      <td>{formatDate(v.valuationDate)}</td>
                      <td>{v.farmName}</td>
                      <td>{groupLabel(v.assetGroup)}</td>
                      <td>{GROUP_TYPE_LABELS[v.groupType]}</td>
                      <td>{qtyDisplay(v)}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatBRL(v.pricePerUnit)}
                      </td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatBRL(v.totalFairValue)}
                      </td>
                      <td>
                        <span className={`bio-assets__variation ${variationClass}`}>
                          {isPositive && <ArrowUp size={12} aria-hidden="true" />}
                          {isNegative && <ArrowDown size={12} aria-hidden="true" />}
                          {change != null ? formatBRL(Math.abs(change)) : '-'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="bio-assets__action-btn"
                          onClick={() => setDeleteTarget(v)}
                          aria-label={`Excluir avaliacao de ${groupLabel(v.assetGroup)}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="bio-assets__cards">
            {valuations.map((v) => {
              const change = v.fairValueChange;
              const isPositive = change != null && change > 0;
              const isNegative = change != null && change < 0;
              const variationClass = isPositive
                ? 'bio-assets__variation--positive'
                : isNegative
                  ? 'bio-assets__variation--negative'
                  : 'bio-assets__variation--neutral';

              return (
                <div key={v.id} className="bio-assets__card">
                  <div className="bio-assets__card-row">
                    <span className="bio-assets__card-label">DATA</span>
                    <span className="bio-assets__card-value">{formatDate(v.valuationDate)}</span>
                  </div>
                  <div className="bio-assets__card-row">
                    <span className="bio-assets__card-label">FAZENDA</span>
                    <span className="bio-assets__card-value">{v.farmName}</span>
                  </div>
                  <div className="bio-assets__card-row">
                    <span className="bio-assets__card-label">GRUPO</span>
                    <span className="bio-assets__card-value">{groupLabel(v.assetGroup)}</span>
                  </div>
                  <div className="bio-assets__card-row">
                    <span className="bio-assets__card-label">TIPO</span>
                    <span className="bio-assets__card-value">{GROUP_TYPE_LABELS[v.groupType]}</span>
                  </div>
                  <div className="bio-assets__card-row">
                    <span className="bio-assets__card-label">QTD/AREA</span>
                    <span className="bio-assets__card-value">{qtyDisplay(v)}</span>
                  </div>
                  <div className="bio-assets__card-row">
                    <span className="bio-assets__card-label">PRECO UNITARIO</span>
                    <span className="bio-assets__card-value" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatBRL(v.pricePerUnit)}
                    </span>
                  </div>
                  <div className="bio-assets__card-row">
                    <span className="bio-assets__card-label">VALOR JUSTO</span>
                    <span className="bio-assets__card-value" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatBRL(v.totalFairValue)}
                    </span>
                  </div>
                  <div className="bio-assets__card-row">
                    <span className="bio-assets__card-label">VARIACAO</span>
                    <span className={`bio-assets__variation ${variationClass}`}>
                      {isPositive && <ArrowUp size={12} aria-hidden="true" />}
                      {isNegative && <ArrowDown size={12} aria-hidden="true" />}
                      {change != null ? formatBRL(Math.abs(change)) : '-'}
                    </span>
                  </div>
                  <div className="bio-assets__card-row">
                    <span className="bio-assets__card-label">ACOES</span>
                    <button
                      type="button"
                      className="bio-assets__action-btn"
                      onClick={() => setDeleteTarget(v)}
                      aria-label={`Excluir avaliacao de ${groupLabel(v.assetGroup)}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Valuation modal */}
      <BiologicalAssetValuationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCreateSuccess}
        onSubmit={createValuation}
      />

      {/* Delete confirm modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Excluir avaliacao"
        message={
          deleteTarget
            ? `Deseja excluir a avaliacao de ${groupLabel(deleteTarget.assetGroup)} do dia ${formatDate(deleteTarget.valuationDate)}?`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
