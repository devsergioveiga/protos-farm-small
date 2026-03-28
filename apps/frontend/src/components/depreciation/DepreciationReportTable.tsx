import { useState } from 'react';
import { TrendingDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import type { DepreciationEntry } from '@/types/depreciation';
import { TRACK_LABELS } from '@/types/depreciation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPeriod(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}/${year}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="depreciation-table__tr">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
            <td key={j} className="depreciation-table__td">
              <div className="depreciation-table__skeleton-cell" aria-hidden="true" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Row overflow menu ────────────────────────────────────────────────────────

interface RowMenuProps {
  entry: DepreciationEntry;
  onReverse: (entryId: string) => void;
}

function RowMenu({ entry, onReverse }: RowMenuProps) {
  const [open, setOpen] = useState(false);

  if (entry.reversedAt) {
    return (
      <span className="depreciation-table__badge depreciation-table__badge--reversed">
        Estornado
      </span>
    );
  }

  return (
    <div className="depreciation-table__row-menu">
      <button
        type="button"
        className="depreciation-table__menu-btn"
        aria-label="Acoes"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div
            className="depreciation-table__menu-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <ul className="depreciation-table__menu-list" role="menu">
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="depreciation-table__menu-item depreciation-table__menu-item--danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onReverse(entry.id);
                }}
              >
                Estornar lancamento
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}

// ─── Mobile card ─────────────────────────────────────────────────────────────

interface MobileCardProps {
  entry: DepreciationEntry;
  onReverse: (entryId: string) => void;
}

function MobileCard({ entry, onReverse }: MobileCardProps) {
  return (
    <article
      className={`depreciation-card${entry.reversedAt ? ' depreciation-card--reversed' : ''}`}
    >
      <div className="depreciation-card__header">
        <span className="depreciation-card__name">{entry.asset.name}</span>
        {entry.reversedAt && (
          <span className="depreciation-table__badge depreciation-table__badge--reversed">
            Estornado
          </span>
        )}
      </div>
      <div className="depreciation-card__meta">
        <span>{entry.asset.assetType}</span>
        {entry.farm && <span>{entry.farm.name}</span>}
        <span>{TRACK_LABELS[entry.track]}</span>
      </div>
      <div className="depreciation-card__values">
        <div className="depreciation-card__value-row">
          <span className="depreciation-card__value-label">Depreciacao</span>
          <span className="depreciation-card__value-amount">
            {formatBRL(entry.depreciationAmount)}
          </span>
        </div>
        <div className="depreciation-card__value-row">
          <span className="depreciation-card__value-label">Valor atual</span>
          <span className="depreciation-card__value-amount">
            {formatBRL(entry.closingBookValue)}
          </span>
        </div>
      </div>
      {!entry.reversedAt && (
        <div className="depreciation-card__actions">
          <button
            type="button"
            className="depreciation-card__reverse-btn"
            onClick={() => onReverse(entry.id)}
          >
            Estornar lancamento
          </button>
        </div>
      )}
    </article>
  );
}

// ─── DepreciationReportTable ──────────────────────────────────────────────────

interface DepreciationReportTableProps {
  entries: DepreciationEntry[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onReverse: (entryId: string) => void;
  loading: boolean;
  onRunClick?: () => void;
}

export default function DepreciationReportTable({
  entries,
  total,
  page,
  limit,
  onPageChange,
  onReverse,
  loading,
  onRunClick,
}: DepreciationReportTableProps) {
  const totalPages = Math.ceil(total / limit);
  const isEmpty = !loading && entries.length === 0;

  return (
    <section className="depreciation-table__wrapper" aria-label="Lancamentos de depreciacao">
      {/* Mobile: card stack */}
      {!loading && !isEmpty && (
        <div className="depreciation-table__cards">
          {entries.map((entry) => (
            <MobileCard key={entry.id} entry={entry} onReverse={onReverse} />
          ))}
        </div>
      )}

      {/* Desktop: table */}
      <div className="depreciation-table__desktop">
        <table className="depreciation-table">
          <caption className="sr-only">Lancamentos de depreciacao do periodo</caption>
          <thead>
            <tr>
              <th scope="col" className="depreciation-table__th">
                Ativo
              </th>
              <th scope="col" className="depreciation-table__th">
                Tipo
              </th>
              <th scope="col" className="depreciation-table__th">
                Fazenda
              </th>
              <th scope="col" className="depreciation-table__th depreciation-table__th--right">
                Valor Anterior
              </th>
              <th scope="col" className="depreciation-table__th depreciation-table__th--right">
                Depreciacao
              </th>
              <th scope="col" className="depreciation-table__th depreciation-table__th--right">
                Valor Atual
              </th>
              <th scope="col" className="depreciation-table__th">
                Centro de Custo
              </th>
              <th scope="col" className="depreciation-table__th">
                Track
              </th>
              <th scope="col" className="depreciation-table__th depreciation-table__th--actions">
                <span className="sr-only">Acoes</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows />}
            {!loading && isEmpty && (
              <tr>
                <td colSpan={9} className="depreciation-table__td depreciation-table__td--empty">
                  <div className="depreciation-table__empty">
                    <TrendingDown
                      size={48}
                      aria-hidden="true"
                      className="depreciation-table__empty-icon"
                    />
                    <h3 className="depreciation-table__empty-title">
                      Nenhuma depreciacao neste periodo
                    </h3>
                    <p className="depreciation-table__empty-desc">
                      Execute a depreciacao mensal ou selecione outro periodo.
                    </p>
                    {onRunClick && (
                      <button
                        type="button"
                        className="depreciation-table__empty-cta"
                        onClick={onRunClick}
                      >
                        Executar Depreciacao
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={`depreciation-table__tr${entry.reversedAt ? ' depreciation-table__tr--reversed' : ''}`}
                >
                  <td className="depreciation-table__td">
                    <div className="depreciation-table__asset-cell">
                      <span className="depreciation-table__asset-tag">{entry.asset.assetTag}</span>
                      <span className="depreciation-table__asset-name">{entry.asset.name}</span>
                    </div>
                  </td>
                  <td className="depreciation-table__td">{entry.asset.assetType}</td>
                  <td className="depreciation-table__td">{entry.farm?.name ?? '—'}</td>
                  <td className="depreciation-table__td depreciation-table__td--mono depreciation-table__td--right">
                    {formatBRL(entry.openingBookValue)}
                  </td>
                  <td className="depreciation-table__td depreciation-table__td--mono depreciation-table__td--right">
                    {formatBRL(entry.depreciationAmount)}
                  </td>
                  <td className="depreciation-table__td depreciation-table__td--mono depreciation-table__td--right">
                    {formatBRL(entry.closingBookValue)}
                  </td>
                  <td className="depreciation-table__td">
                    {entry.ccItems.length > 0
                      ? entry.ccItems.map((cc) => cc.costCenter.name).join(', ')
                      : '—'}
                  </td>
                  <td className="depreciation-table__td">
                    <span
                      className={`depreciation-table__track-badge depreciation-table__track-badge--${entry.track.toLowerCase()}`}
                    >
                      {TRACK_LABELS[entry.track]}
                    </span>
                  </td>
                  <td className="depreciation-table__td depreciation-table__td--actions">
                    <RowMenu entry={entry} onReverse={onReverse} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="depreciation-table__pagination" aria-label="Paginacao">
          <button
            type="button"
            className="depreciation-table__pagination-btn"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Pagina anterior"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="depreciation-table__pagination-info">
            Pagina {page} de {totalPages} ({total} lancamentos)
          </span>
          <button
            type="button"
            className="depreciation-table__pagination-btn"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Proxima pagina"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  );
}

export { formatPeriod };
