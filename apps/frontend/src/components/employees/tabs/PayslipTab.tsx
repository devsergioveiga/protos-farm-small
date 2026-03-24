import { useState, useEffect, useCallback } from 'react';
import { FileText, FileDown, Mail, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { Payslip, PayrollRunType } from '@/types/payroll-runs';
import './PayslipTab.css';

interface PayslipTabProps {
  orgId: string;
  employeeId: string;
  employeeEmail?: string;
}

const RUN_TYPE_LABELS: Record<PayrollRunType, string> = {
  MONTHLY: 'Mensal',
  ADVANCE: 'Adiantamento',
  THIRTEENTH_FIRST: '13o - 1a Parcela',
  THIRTEENTH_SECOND: '13o - 2a Parcela',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  if (!year || !month) return yyyyMm;
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const m = parseInt(month, 10);
  return `${months[m - 1] ?? month}/${year}`;
}

// Skeleton row for loading state
function SkeletonRow() {
  return (
    <tr className="payslip-tab__skeleton-row" aria-hidden="true">
      <td><div className="payslip-tab__skeleton payslip-tab__skeleton--sm" /></td>
      <td><div className="payslip-tab__skeleton payslip-tab__skeleton--xs" /></td>
      <td><div className="payslip-tab__skeleton payslip-tab__skeleton--sm" /></td>
      <td><div className="payslip-tab__skeleton payslip-tab__skeleton--sm" /></td>
      <td><div className="payslip-tab__skeleton payslip-tab__skeleton--xs" /></td>
      <td><div className="payslip-tab__skeleton payslip-tab__skeleton--actions" /></td>
    </tr>
  );
}

export default function PayslipTab({ orgId, employeeId, employeeEmail }: PayslipTabProps) {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPayslips = useCallback(async () => {
    if (!orgId || !employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<Payslip[] | { data: Payslip[] }>(
        `/org/${orgId}/employees/${employeeId}/payslips`,
      );
      // Handle both array and paginated response shapes
      const items = Array.isArray(result) ? result : (result as { data: Payslip[] }).data ?? [];
      // Only show payslips from COMPLETED runs — filter out REVERTED
      const completed = items.filter((p) => p.status === 'COMPLETED');
      setPayslips(completed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar holerites';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, employeeId]);

  useEffect(() => {
    void fetchPayslips();
  }, [fetchPayslips]);

  const handleDownload = useCallback(
    async (referenceMonth: string) => {
      setDownloadingId(referenceMonth);
      setActionError(null);
      try {
        const blob = await api.getBlob(
          `/org/${orgId}/employees/${employeeId}/payslips/${referenceMonth}`,
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `holerite_${referenceMonth}_colaborador.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (_err) {
        setActionError(
          'Nao foi possivel baixar o holerite. Tente novamente ou contate o suporte.',
        );
      } finally {
        setDownloadingId(null);
      }
    },
    [orgId, employeeId],
  );

  const handleResendEmail = useCallback(
    async (payslip: Payslip) => {
      setResendingId(payslip.id);
      setActionError(null);
      try {
        await api.post(
          `/org/${orgId}/payroll-runs/${payslip.payrollRunId}/items/${payslip.id}/resend-email`,
        );
      } catch (_err) {
        setActionError(
          'Nao foi possivel reenviar o holerite. Verifique se o colaborador tem e-mail cadastrado.',
        );
      } finally {
        setResendingId(null);
      }
    },
    [orgId],
  );

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <section className="payslip-tab" aria-label="Holerites do colaborador">
      <div className="payslip-tab__header">
        <h2 className="payslip-tab__section-title">Holerites</h2>
      </div>

      {actionError && (
        <div className="payslip-tab__action-error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {actionError}
        </div>
      )}

      {isLoading ? (
        <table className="payslip-tab__table" aria-label="Carregando holerites">
          <thead>
            <tr>
              <th scope="col">COMPETENCIA</th>
              <th scope="col">TIPO</th>
              <th scope="col" className="payslip-tab__col--right">BRUTO</th>
              <th scope="col" className="payslip-tab__col--right">LIQUIDO</th>
              <th scope="col">STATUS</th>
              <th scope="col">ACOES</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      ) : error ? (
        <div className="payslip-tab__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>{error}</span>
          <button
            type="button"
            className="payslip-tab__btn-secondary"
            onClick={() => void fetchPayslips()}
          >
            Tentar novamente
          </button>
        </div>
      ) : payslips.length === 0 ? (
        <div className="payslip-tab__empty-state" aria-label="Nenhum holerite disponivel">
          <FileText size={48} aria-hidden="true" className="payslip-tab__empty-icon" />
          <p className="payslip-tab__empty-title">Nenhum holerite disponivel.</p>
          <p className="payslip-tab__empty-body">
            Os holerites aparecem apos o fechamento da folha mensal.
          </p>
        </div>
      ) : (
        <div className="payslip-tab__table-wrapper">
          <table className="payslip-tab__table">
            <caption className="sr-only">
              Holerites dos ultimos 12 meses do colaborador
            </caption>
            <thead>
              <tr>
                <th scope="col">COMPETENCIA</th>
                <th scope="col">TIPO</th>
                <th scope="col" className="payslip-tab__col--right">BRUTO</th>
                <th scope="col" className="payslip-tab__col--right">LIQUIDO</th>
                <th scope="col">STATUS</th>
                <th scope="col">ACOES</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((payslip) => (
                <tr key={payslip.id} className="payslip-tab__row">
                  <td className="payslip-tab__cell payslip-tab__cell--month">
                    {formatMonth(payslip.referenceMonth)}
                  </td>
                  <td className="payslip-tab__cell">
                    {RUN_TYPE_LABELS[payslip.runType] ?? payslip.runType}
                  </td>
                  <td className="payslip-tab__cell payslip-tab__cell--right payslip-tab__cell--mono">
                    <span aria-label={`R$ ${formatCurrency(payslip.grossSalary)} bruto`}>
                      R$ {formatCurrency(payslip.grossSalary)}
                    </span>
                  </td>
                  <td className="payslip-tab__cell payslip-tab__cell--right payslip-tab__cell--mono">
                    <span aria-label={`R$ ${formatCurrency(payslip.netSalary)} liquido`}>
                      R$ {formatCurrency(payslip.netSalary)}
                    </span>
                  </td>
                  <td className="payslip-tab__cell">
                    <span className="payslip-tab__status payslip-tab__status--completed">
                      Fechado
                    </span>
                  </td>
                  <td className="payslip-tab__cell payslip-tab__cell--actions">
                    {/* Download PDF */}
                    <button
                      type="button"
                      className="payslip-tab__action-btn"
                      aria-label={`Baixar holerite de ${formatMonth(payslip.referenceMonth)}`}
                      onClick={() => void handleDownload(payslip.referenceMonth)}
                      disabled={downloadingId === payslip.referenceMonth}
                    >
                      <FileDown
                        size={20}
                        aria-hidden="true"
                        className={downloadingId === payslip.referenceMonth ? 'payslip-tab__icon--spinning' : ''}
                      />
                    </button>
                    {/* Resend email (only if employee has email) */}
                    {employeeEmail && (
                      <button
                        type="button"
                        className="payslip-tab__action-btn"
                        aria-label={`Reenviar holerite de ${formatMonth(payslip.referenceMonth)} por email`}
                        onClick={() => void handleResendEmail(payslip)}
                        disabled={resendingId === payslip.id}
                      >
                        <Mail
                          size={20}
                          aria-hidden="true"
                          className={resendingId === payslip.id ? 'payslip-tab__icon--spinning' : ''}
                        />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
