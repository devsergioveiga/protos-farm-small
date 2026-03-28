import type { BpGroup, BpGroupRow } from '@/types/financial-statements';
import './BalanceSheetTable.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div
      className="bs-table__skeleton"
      aria-label="Carregando balanco patrimonial..."
      aria-busy="true"
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="bs-table__skeleton-row">
          <div className="bs-table__skeleton-cell bs-table__skeleton-cell--name" />
          <div className="bs-table__skeleton-cell bs-table__skeleton-cell--amount" />
          <div className="bs-table__skeleton-cell bs-table__skeleton-cell--amount" />
        </div>
      ))}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface BpRowProps {
  row: BpGroupRow;
  isGroupTotal?: boolean;
}

function BpRow({ row, isGroupTotal }: BpRowProps) {
  const rowClass = isGroupTotal || row.isSubtotal
    ? 'bs-table__row bs-table__row--subtotal'
    : 'bs-table__row bs-table__row--account';

  const indent = isGroupTotal || row.isSubtotal ? 16 : Math.max(16, row.level * 16 + 16);

  return (
    <tr className={rowClass}>
      <th
        scope="row"
        className="bs-table__td bs-table__td--name"
        style={{ paddingLeft: `${indent}px` }}
      >
        {row.name}
      </th>
      <td className="bs-table__td bs-table__td--amount">{formatCurrency(row.currentBalance)}</td>
      <td className="bs-table__td bs-table__td--amount">{formatCurrency(row.priorBalance)}</td>
    </tr>
  );
}

// ─── Side Table ───────────────────────────────────────────────────────────────

interface SideTableProps {
  caption: string;
  groups: BpGroup[];
  grandTotal: BpGroupRow;
}

function SideTable({ caption, groups, grandTotal }: SideTableProps) {
  return (
    <div className="bs-table__side">
      <table className="bs-table" aria-label={caption}>
        <caption className="bs-table__caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="bs-table__th bs-table__th--name">
              Descricao
            </th>
            <th scope="col" className="bs-table__th bs-table__th--amount">
              Saldo Atual
            </th>
            <th scope="col" className="bs-table__th bs-table__th--amount">
              Saldo Anterior
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows key={group.id} group={group} />
          ))}
        </tbody>
        <tfoot>
          <tr className="bs-table__row bs-table__row--total">
            <th scope="row" className="bs-table__td bs-table__td--name">
              {grandTotal.name}
            </th>
            <td className="bs-table__td bs-table__td--amount">
              {formatCurrency(grandTotal.currentBalance)}
            </td>
            <td className="bs-table__td bs-table__td--amount">
              {formatCurrency(grandTotal.priorBalance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function GroupRows({ group }: { group: BpGroup }) {
  return (
    <>
      <tr className="bs-table__row bs-table__row--group-header">
        <th scope="row" colSpan={3} className="bs-table__td bs-table__td--group">
          {group.label}
        </th>
      </tr>
      {group.rows.map((row, i) => (
        <BpRow key={row.accountId ?? `${group.id}-${i}`} row={row} />
      ))}
      <BpRow key={`${group.id}-total`} row={group.total} isGroupTotal />
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BalanceSheetTableProps {
  ativo: BpGroup[];
  passivo: BpGroup[];
  totalAtivo: BpGroupRow;
  totalPassivo: BpGroupRow;
  loading: boolean;
  period: string;
}

export default function BalanceSheetTable({
  ativo,
  passivo,
  totalAtivo,
  totalPassivo,
  loading,
  period: _period,
}: BalanceSheetTableProps) {
  if (loading) {
    return (
      <div className="bs-table__grid">
        <TableSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="bs-table__grid">
      <SideTable caption="Ativo" groups={ativo} grandTotal={totalAtivo} />
      <hr className="bs-table__divider" aria-hidden="true" />
      <SideTable caption="Passivo e Patrimonio Liquido" groups={passivo} grandTotal={totalPassivo} />
    </div>
  );
}
