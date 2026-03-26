import { Calculator, FileDown, Mail } from 'lucide-react';
import PayrollRunStatusBadge from './PayrollRunStatusBadge';
import type { PayrollRunItem } from '@/types/payroll-runs';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface PayrollRunItemRowProps {
  item: PayrollRunItem;
  onRecalculate: (employeeId: string) => void;
  onDownloadPayslip: (itemId: string) => void;
  isRecalculating?: boolean;
}

export default function PayrollRunItemRow({
  item,
  onRecalculate,
  onDownloadPayslip,
  isRecalculating = false,
}: PayrollRunItemRowProps) {
  const isPendingTimesheet = item.status === 'PENDING_TIMESHEET';

  return (
    <tr
      className={`payroll-run-item-row${isPendingTimesheet ? ' payroll-run-item-row--dimmed' : ''}`}
    >
      <td className="payroll-run-item-row__cell payroll-run-item-row__cell--name">
        {item.employeeName ?? item.employeeId}
      </td>
      <td className="payroll-run-item-row__cell">
        <PayrollRunStatusBadge status={item.status} />
      </td>
      <td className="payroll-run-item-row__cell payroll-run-item-row__cell--mono">
        {formatCurrency(item.grossSalary)}
      </td>
      <td className="payroll-run-item-row__cell payroll-run-item-row__cell--mono">
        {formatCurrency(item.netSalary)}
      </td>
      <td className="payroll-run-item-row__cell payroll-run-item-row__cell--actions">
        <button
          type="button"
          className="payroll-run-item-row__action-btn"
          onClick={() => onRecalculate(item.employeeId)}
          disabled={isRecalculating}
          aria-label={`Recalcular ${item.employeeName ?? 'colaborador'}`}
          title="Recalcular este colaborador"
        >
          <Calculator size={16} aria-hidden="true" />
          <span className="sr-only">Recalcular</span>
        </button>
        <button
          type="button"
          className="payroll-run-item-row__action-btn"
          onClick={() => onDownloadPayslip(item.id)}
          aria-label={`Baixar holerite de ${item.employeeName ?? 'colaborador'}`}
          title="Baixar holerite"
        >
          <FileDown size={16} aria-hidden="true" />
          <span className="sr-only">Baixar holerite</span>
        </button>
        {item.payslipSentAt && (
          <button
            type="button"
            className="payroll-run-item-row__action-btn"
            aria-label={`Reenviar holerite de ${item.employeeName ?? 'colaborador'}`}
            title="Reenviar holerite"
          >
            <Mail size={16} aria-hidden="true" />
            <span className="sr-only">Reenviar holerite</span>
          </button>
        )}
      </td>
    </tr>
  );
}
