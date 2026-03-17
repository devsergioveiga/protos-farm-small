import type { ScheduleRow } from '@/types/rural-credit';
import './SchedulePreviewTable.css';

// ─── Helpers ─────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ─── Props ───────────────────────────────────────────────────────

interface SchedulePreviewTableProps {
  schedule: ScheduleRow[];
  /** Principal amount of the contract — reserved for future display use */
  principalAmount?: number;
  gracePeriodMonths: number;
}

// ─── Component ───────────────────────────────────────────────────

export default function SchedulePreviewTable({
  schedule,
  gracePeriodMonths,
}: SchedulePreviewTableProps) {
  const totalPrincipal = schedule.reduce((sum, r) => sum + r.principal, 0);
  const totalInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
  const totalPayment = schedule.reduce((sum, r) => sum + r.totalPayment, 0);

  const firstRow = schedule[0];
  const adjustedBalance =
    gracePeriodMonths > 0 && firstRow ? firstRow.outstandingBalance + firstRow.principal : null;

  return (
    <div className="spt">
      {gracePeriodMonths > 0 && adjustedBalance !== null && (
        <div className="spt__grace-banner" role="note">
          <span>
            Carencia de {gracePeriodMonths} {gracePeriodMonths === 1 ? 'mes' : 'meses'} com juros
            capitalizados. Saldo ajustado: <strong>{formatBRL(adjustedBalance)}</strong>
          </span>
        </div>
      )}

      {/* Desktop table */}
      <div className="spt__table-wrap">
        <table className="spt__table">
          <caption>Cronograma de parcelas</caption>
          <thead>
            <tr>
              <th scope="col" className="spt__col-num">
                #
              </th>
              <th scope="col">Vencimento</th>
              <th scope="col" className="spt__col-right">
                Principal
              </th>
              <th scope="col" className="spt__col-right">
                Juros
              </th>
              <th scope="col" className="spt__col-right spt__col-bold">
                Total
              </th>
              <th scope="col" className="spt__col-right">
                Saldo devedor
              </th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row) => (
              <tr key={row.installmentNumber}>
                <td className="spt__col-num">{row.installmentNumber}</td>
                <td className="spt__col-nowrap">{formatDate(row.dueDate)}</td>
                <td className="spt__col-right spt__col-mono">{formatBRL(row.principal)}</td>
                <td className="spt__col-right spt__col-mono">{formatBRL(row.interest)}</td>
                <td className="spt__col-right spt__col-mono spt__col-bold">
                  {formatBRL(row.totalPayment)}
                </td>
                <td className="spt__col-right spt__col-mono">
                  {formatBRL(row.outstandingBalance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="spt__tfoot-row">
              <td colSpan={2}>
                <strong>Total</strong>
              </td>
              <td className="spt__col-right spt__col-mono">
                <strong>{formatBRL(totalPrincipal)}</strong>
              </td>
              <td className="spt__col-right spt__col-mono">
                <strong>{formatBRL(totalInterest)}</strong>
              </td>
              <td className="spt__col-right spt__col-mono spt__col-bold">
                <strong>{formatBRL(totalPayment)}</strong>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="spt__cards" aria-label="Cronograma de parcelas (mobile)">
        {schedule.map((row) => (
          <div key={row.installmentNumber} className="spt__card">
            <div className="spt__card-header">
              <span className="spt__card-num">Parcela #{row.installmentNumber}</span>
              <span className="spt__card-date">{formatDate(row.dueDate)}</span>
            </div>
            <div className="spt__card-row">
              <span className="spt__card-label">Principal</span>
              <span className="spt__card-value">{formatBRL(row.principal)}</span>
            </div>
            <div className="spt__card-row">
              <span className="spt__card-label">Juros</span>
              <span className="spt__card-value">{formatBRL(row.interest)}</span>
            </div>
            <div className="spt__card-row">
              <span className="spt__card-label">Total</span>
              <span className="spt__card-value spt__card-value--bold">
                {formatBRL(row.totalPayment)}
              </span>
            </div>
            <div className="spt__card-row">
              <span className="spt__card-label">Saldo devedor</span>
              <span className="spt__card-value">{formatBRL(row.outstandingBalance)}</span>
            </div>
          </div>
        ))}
        {/* Summary */}
        <div className="spt__card spt__card--summary">
          <div className="spt__card-row">
            <span className="spt__card-label">Total principal</span>
            <span className="spt__card-value">{formatBRL(totalPrincipal)}</span>
          </div>
          <div className="spt__card-row">
            <span className="spt__card-label">Total juros</span>
            <span className="spt__card-value">{formatBRL(totalInterest)}</span>
          </div>
          <div className="spt__card-row">
            <span className="spt__card-label">Total geral</span>
            <span className="spt__card-value spt__card-value--bold">{formatBRL(totalPayment)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
