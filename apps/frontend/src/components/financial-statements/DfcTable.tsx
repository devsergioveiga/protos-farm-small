import type {
  DfcMethodOutput,
  DfcSectionRow,
  DfcSection,
  DfcCashSummary,
} from '@/types/financial-statements';
import './DfcTable.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function getValueClass(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return '';
  return num < 0 ? 'dfc-table__cell--negative' : 'dfc-table__cell--positive';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DfcTableSkeleton() {
  return (
    <tbody aria-label="Carregando demonstracao do fluxo de caixa..." aria-busy="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <tr key={i} className="dfc-table__skeleton-row">
          <td className="dfc-table__td dfc-table__td--name">
            <div className="dfc-table__skeleton-cell dfc-table__skeleton-cell--name" />
          </td>
          {Array.from({ length: 3 }).map((_, j) => (
            <td key={j} className="dfc-table__td dfc-table__td--amount">
              <div className="dfc-table__skeleton-cell dfc-table__skeleton-cell--amount" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface SectionRowsProps {
  section: DfcSection;
}

function SectionRows({ section }: SectionRowsProps) {
  return (
    <>
      <tr className="dfc-table__section-header">
        <th scope="row" colSpan={4} className="dfc-table__td dfc-table__td--section">
          {section.label}
        </th>
      </tr>
      {section.rows.map((row) => (
        <DfcRow key={row.id} row={row} />
      ))}
      <DfcRow row={section.subtotal} isSubtotal />
    </>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface DfcRowProps {
  row: DfcSectionRow;
  isSubtotal?: boolean;
  isCashSummary?: boolean;
  isFinal?: boolean;
}

function DfcRow({ row, isSubtotal, isCashSummary, isFinal }: DfcRowProps) {
  const rowClass = isFinal
    ? 'dfc-table__row-final'
    : isCashSummary
      ? 'dfc-table__row-cash'
      : isSubtotal || row.isSubtotal
        ? 'dfc-table__row-subtotal'
        : 'dfc-table__row';

  const cellClass = isCashSummary || isFinal ? getValueClass(row.currentMonth) : '';

  return (
    <tr className={rowClass}>
      <th scope="row" className="dfc-table__td dfc-table__td--name">
        {row.label}
      </th>
      <td
        className={`dfc-table__td dfc-table__td--amount amount-mono ${cellClass}`}
        aria-label={`${row.label} mes atual: ${formatCurrency(row.currentMonth)}`}
      >
        {formatCurrency(row.currentMonth)}
      </td>
      <td
        className={`dfc-table__td dfc-table__td--amount amount-mono ${cellClass}`}
        aria-label={`${row.label} acumulado exercicio: ${formatCurrency(row.ytd)}`}
      >
        {formatCurrency(row.ytd)}
      </td>
      <td
        className={`dfc-table__td dfc-table__td--amount amount-mono ${cellClass}`}
        aria-label={`${row.label} ano anterior: ${formatCurrency(row.priorYear)}`}
      >
        {formatCurrency(row.priorYear)}
      </td>
    </tr>
  );
}

// ─── Cash Summary Rows ────────────────────────────────────────────────────────

interface CashRowProps {
  label: string;
  values: { currentMonth: string; ytd: string; priorYear: string };
  isFinal?: boolean;
}

function CashRow({ label, values, isFinal }: CashRowProps) {
  const syntheticRow: DfcSectionRow = {
    id: label,
    label,
    currentMonth: values.currentMonth,
    ytd: values.ytd,
    priorYear: values.priorYear,
    isSubtotal: false,
  };
  return <DfcRow row={syntheticRow} isCashSummary={!isFinal} isFinal={isFinal} />;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DfcTableProps {
  data: DfcMethodOutput;
  caption: string;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DfcTable({ data, caption, loading }: DfcTableProps) {
  const cash: DfcCashSummary | undefined = data?.cash;

  return (
    <div className="dfc-table__wrapper">
      <table className="dfc-table" aria-label="Demonstracao do Fluxo de Caixa">
        <caption className="dfc-table__caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="dfc-table__th dfc-table__th--name">
              Descricao
            </th>
            <th scope="col" className="dfc-table__th dfc-table__th--amount">
              Mes Atual
            </th>
            <th scope="col" className="dfc-table__th dfc-table__th--amount">
              Acumulado Exercicio
            </th>
            <th scope="col" className="dfc-table__th dfc-table__th--amount">
              Ano Anterior
            </th>
          </tr>
        </thead>
        {loading ? (
          <DfcTableSkeleton />
        ) : (
          <>
            <tbody>
              {data.sections.map((section) => (
                <SectionRows key={section.id} section={section} />
              ))}
            </tbody>
            {cash && (
              <tfoot>
                <tr className="dfc-table__row-separator">
                  <td colSpan={4} />
                </tr>
                <CashRow label="Saldo inicial de caixa" values={cash.saldoInicial} />
                <CashRow label="Variacao liquida de caixa" values={cash.variacaoLiquida} />
                <CashRow label="Saldo final de caixa" values={cash.saldoFinal} isFinal />
              </tfoot>
            )}
          </>
        )}
      </table>
    </div>
  );
}
