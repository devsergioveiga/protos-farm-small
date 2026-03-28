import type { DreSection, DreSectionRow } from '@/types/financial-statements';
import './DreTable.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function formatPercent(value: string | null): string {
  if (value === null || value === undefined) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num / 100);
}

function getAhClass(value: string | null): string {
  if (value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return '';
  return num > 0 ? 'dre-table__delta--positive' : 'dre-table__delta--negative';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DreTableSkeleton({ showVH }: { showVH: boolean }) {
  const amountCols = showVH ? 5 : 3;
  return (
    <tbody aria-label="Carregando demonstracao do resultado..." aria-busy="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <tr key={i} className="dre-table__skeleton-row">
          <td className="dre-table__td dre-table__td--name" style={{ paddingLeft: `${(i % 3) * 16 + 16}px` }}>
            <div className="dre-table__skeleton-cell dre-table__skeleton-cell--name" />
          </td>
          {Array.from({ length: amountCols }).map((_, j) => (
            <td key={j} className="dre-table__td dre-table__td--amount">
              <div className="dre-table__skeleton-cell dre-table__skeleton-cell--amount" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface DreRowProps {
  row: DreSectionRow;
  showVH: boolean;
  isSubtotal?: boolean;
  isFoot?: boolean;
}

function DreRow({ row, showVH, isSubtotal, isFoot }: DreRowProps) {
  const rowClass = isFoot
    ? 'dre-table__resultado'
    : isSubtotal || row.isSubtotal
      ? 'dre-table__subtotal'
      : row.isCpc29
        ? 'dre-table__account-row dre-table__cpc29'
        : 'dre-table__account-row';

  const indent = isFoot || isSubtotal || row.isSubtotal ? 16 : Math.max(16, row.level * 16 + 16);

  return (
    <tr className={rowClass}>
      <th
        scope="row"
        className="dre-table__td dre-table__td--name"
        style={{ paddingLeft: `${indent}px` }}
      >
        {row.name}
      </th>
      <td className="dre-table__td dre-table__td--amount amount-mono">{formatCurrency(row.currentMonth)}</td>
      <td className="dre-table__td dre-table__td--amount amount-mono">{formatCurrency(row.ytd)}</td>
      <td className="dre-table__td dre-table__td--amount amount-mono">{formatCurrency(row.priorYear)}</td>
      {showVH && (
        <>
          <td className="dre-table__td dre-table__td--amount amount-mono dre-table__vh-col">
            {formatPercent(row.avPercent)}
          </td>
          <td className={`dre-table__td dre-table__td--amount amount-mono dre-table__vh-col ${getAhClass(row.ahPercent)}`}>
            {row.ahPercent !== null ? `${parseFloat(row.ahPercent) > 0 ? '+' : ''}${formatPercent(row.ahPercent)}` : '—'}
          </td>
        </>
      )}
    </tr>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DreTableProps {
  sections: DreSection[];
  resultadoLiquido: DreSectionRow;
  showVH: boolean;
  loading: boolean;
  period: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DreTable({ sections, resultadoLiquido, showVH, loading, period }: DreTableProps) {
  return (
    <div className="dre-table__wrapper">
      <table className="dre-table" aria-label="Demonstracao do Resultado do Exercicio">
        <caption className="dre-table__caption">
          Demonstracao do Resultado do Exercicio
          {period && <span className="dre-table__caption-period"> | {period}</span>}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="dre-table__th dre-table__th--name">
              Descricao
            </th>
            <th scope="col" className="dre-table__th dre-table__th--amount">
              Mes Atual
            </th>
            <th scope="col" className="dre-table__th dre-table__th--amount">
              Acumulado
            </th>
            <th scope="col" className="dre-table__th dre-table__th--amount">
              Mesmo Per. Ano Ant.
            </th>
            {showVH && (
              <>
                <th scope="col" className="dre-table__th dre-table__th--amount dre-table__vh-col">
                  % AV
                </th>
                <th scope="col" className="dre-table__th dre-table__th--amount dre-table__vh-col">
                  Delta% AH
                </th>
              </>
            )}
          </tr>
        </thead>
        {loading ? (
          <DreTableSkeleton showVH={showVH} />
        ) : (
          <>
            <tbody>
              {sections.map((section) => (
                <SectionRows key={section.id} section={section} showVH={showVH} />
              ))}
            </tbody>
            <tfoot>
              <DreRow row={resultadoLiquido} showVH={showVH} isFoot />
            </tfoot>
          </>
        )}
      </table>
    </div>
  );
}

function SectionRows({ section, showVH }: { section: DreSection; showVH: boolean }) {
  const colSpan = showVH ? 6 : 4;
  return (
    <>
      <tr className="dre-table__section-header">
        <th scope="row" colSpan={colSpan} className="dre-table__td dre-table__td--section">
          {section.label}
        </th>
      </tr>
      {section.rows.map((row, i) => (
        <DreRow key={row.accountId ?? `${section.id}-${i}`} row={row} showVH={showVH} />
      ))}
      <DreRow key={`${section.id}-total`} row={section.total} showVH={showVH} isSubtotal />
    </>
  );
}
