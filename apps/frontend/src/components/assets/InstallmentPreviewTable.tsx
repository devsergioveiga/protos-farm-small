import { useState } from 'react';
import type { InstallmentPreview } from '@/types/asset';
import './InstallmentPreviewTable.css';

// ─── Helpers ──────────────────────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat('pt-BR');
const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Props ────────────────────────────────────────────────────────────────

interface InstallmentPreviewTableProps {
  installments: InstallmentPreview[];
  totalAmount: number;
  isLoading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function InstallmentPreviewTable({
  installments,
  totalAmount,
  isLoading = false,
}: InstallmentPreviewTableProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleCount = 6;
  const hasMore = installments.length > visibleCount;
  const visibleRows = expanded ? installments : installments.slice(0, visibleCount);
  const hiddenRows = expanded ? [] : installments.slice(visibleCount);

  if (isLoading) {
    return (
      <table className="installment-table" aria-busy="true" aria-label="Carregando parcelas">
        <caption>Parcelas geradas</caption>
        <thead>
          <tr className="installment-table__header">
            <th scope="col" className="installment-table__cell--number">
              #
            </th>
            <th scope="col">Vencimento</th>
            <th scope="col" className="installment-table__cell--amount">
              Valor
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="installment-table__skeleton-row" aria-hidden="true">
            <td className="installment-table__cell--number">—</td>
            <td>—</td>
            <td className="installment-table__cell--amount">—</td>
          </tr>
          <tr className="installment-table__skeleton-row" aria-hidden="true">
            <td className="installment-table__cell--number">—</td>
            <td>—</td>
            <td className="installment-table__cell--amount">—</td>
          </tr>
          <tr className="installment-table__skeleton-row" aria-hidden="true">
            <td className="installment-table__cell--number">—</td>
            <td>—</td>
            <td className="installment-table__cell--amount">—</td>
          </tr>
        </tbody>
      </table>
    );
  }

  if (installments.length === 0) return null;

  return (
    <>
      <table className="installment-table">
        <caption>Parcelas geradas</caption>
        <thead>
          <tr className="installment-table__header">
            <th scope="col" className="installment-table__cell--number">
              #
            </th>
            <th scope="col">Vencimento</th>
            <th scope="col" className="installment-table__cell--amount">
              Valor
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((inst) => (
            <tr key={inst.number}>
              <td className="installment-table__cell--number">{inst.number}</td>
              <td>{dateFmt.format(inst.dueDate)}</td>
              <td className="installment-table__cell--amount">{currencyFmt.format(inst.amount)}</td>
            </tr>
          ))}
          {/* Hidden rows — display toggled via CSS */}
          {hiddenRows.map((inst) => (
            <tr key={inst.number} style={{ display: expanded ? 'table-row' : 'none' }}>
              <td className="installment-table__cell--number">{inst.number}</td>
              <td>{dateFmt.format(inst.dueDate)}</td>
              <td className="installment-table__cell--amount">{currencyFmt.format(inst.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="installment-table__footer">
            <td className="installment-table__cell--number" colSpan={2}>
              Total
            </td>
            <td className="installment-table__cell--amount">{currencyFmt.format(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>

      {hasMore && (
        <button
          type="button"
          className="installment-table__expand-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded
            ? 'Recolher'
            : `Ver todas as ${installments.length} parcelas`}
        </button>
      )}
    </>
  );
}
