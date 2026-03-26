import { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { usePayrollProvisions } from '@/hooks/usePayrollProvisions';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { PayrollProvision, ProvisionReportRow } from '@/types/provision';
import { PROVISION_TYPE_LABELS } from '@/types/provision';
import './PayrollProvisionsPage.css';

type Tab = 'mes' | 'relatorio';

// Provision type display labels (Ferias, Decimo Terceiro)
const PROVISION_DISPLAY = {
  VACATION: 'Ferias',
  THIRTEENTH: 'Decimo Terceiro',
} as const;

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getMonthLabel(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const m = parseInt(month, 10) - 1;
  return `${monthNames[m] ?? month}/${year}`;
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 11; i >= -2; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    options.push({ value, label: getMonthLabel(value) });
  }
  return options;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="prov-page__skeleton-row" aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div className="prov-page__skeleton-cell" />
        </td>
      ))}
    </tr>
  );
}

const PayrollProvisionsPage = () => {
  const {
    provisions,
    report,
    loading,
    error,
    successMessage,
    fetchProvisions,
    calculateProvisions,
    reverseProvision,
    fetchReport,
    exportReport,
  } = usePayrollProvisions();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState<Tab>('mes');
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmReverse, setConfirmReverse] = useState<{ id: string; type: string; month: string } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const monthOptions = generateMonthOptions();

  const doFetchProvisions = useCallback(() => {
    fetchProvisions({ referenceMonth: selectedMonth });
  }, [fetchProvisions, selectedMonth]);

  const doFetchReport = useCallback(() => {
    fetchReport(selectedMonth);
  }, [fetchReport, selectedMonth]);

  useEffect(() => {
    doFetchProvisions();
  }, [doFetchProvisions]);

  useEffect(() => {
    if (activeTab === 'relatorio') {
      doFetchReport();
    }
  }, [activeTab, doFetchReport]);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    if (type === 'success') {
      toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
    }
  }, []);

  useEffect(() => {
    if (successMessage) {
      showToast(successMessage, 'success');
    }
  }, [successMessage, showToast]);

  useEffect(() => {
    if (error) {
      showToast(error, 'error');
    }
  }, [error, showToast]);

  const handleCalculate = async () => {
    setIsCalculating(true);
    const result = await calculateProvisions({ referenceMonth: selectedMonth });
    setIsCalculating(false);
    if (result) {
      showToast(
        `Provisoes de ${getMonthLabel(selectedMonth)} calculadas para ${result.processedCount} colaboradores.`,
        'success',
      );
      doFetchProvisions();
    }
  };

  const handleReverseConfirm = async () => {
    if (!confirmReverse) return;
    const ok = await reverseProvision(confirmReverse.id);
    setConfirmReverse(null);
    if (ok) {
      showToast('Provisao estornada com sucesso.', 'success');
      doFetchProvisions();
    }
  };

  const handleExport = () => {
    exportReport(selectedMonth);
  };

  // Group provisions by employee
  const groupedProvisions: Record<string, { name: string; items: PayrollProvision[] }> = {};
  provisions.forEach((p) => {
    if (!groupedProvisions[p.employeeId]) {
      groupedProvisions[p.employeeId] = { name: p.employeeName, items: [] };
    }
    groupedProvisions[p.employeeId].items.push(p);
  });

  // Totals for provisions tab
  const totalProvision = provisions.filter((p) => !p.reversedAt).reduce((sum, p) => sum + p.provisionAmount, 0);
  const totalCharges = provisions.filter((p) => !p.reversedAt).reduce((sum, p) => sum + p.chargesAmount, 0);
  const totalAmount = provisions.filter((p) => !p.reversedAt).reduce((sum, p) => sum + p.totalAmount, 0);

  // Grand total for report tab
  const reportGrandTotal = report.reduce((sum, r) => sum + r.grandTotal, 0);

  return (
    <main className="prov-page" id="main-content">
      {/* Toast */}
      {toast && (
        <div
          className={`prov-page__toast ${toast.type === 'error' ? 'prov-page__toast--error' : 'prov-page__toast--success'}`}
          role="alert"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="prov-page__breadcrumb" aria-label="Localização na aplicação">
        <span className="prov-page__breadcrumb-item">RH</span>
        <span className="prov-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="prov-page__breadcrumb-item prov-page__breadcrumb-item--current">Provisoes</span>
      </nav>

      {/* Page Header */}
      <header className="prov-page__header">
        <h1 className="prov-page__title">Provisoes</h1>
        <div className="prov-page__header-controls">
          <div className="prov-page__month-group">
            <label htmlFor="prov-month-select" className="prov-page__month-label">Mes de referencia</label>
            <select
              id="prov-month-select"
              className="prov-page__month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="prov-page__cta-btn"
            onClick={handleCalculate}
            disabled={isCalculating || loading}
          >
            <BarChart3 size={20} aria-hidden="true" />
            {isCalculating ? 'Calculando...' : 'Calcular Provisoes'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="prov-page__tabs" role="tablist" aria-label="Visualizacao de provisoes">
        <button
          type="button"
          role="tab"
          className={`prov-page__tab ${activeTab === 'mes' ? 'prov-page__tab--active' : ''}`}
          aria-selected={activeTab === 'mes'}
          aria-controls="prov-tab-mes"
          id="prov-tab-btn-mes"
          onClick={() => setActiveTab('mes')}
        >
          Provisoes do Mes
        </button>
        <button
          type="button"
          role="tab"
          className={`prov-page__tab ${activeTab === 'relatorio' ? 'prov-page__tab--active' : ''}`}
          aria-selected={activeTab === 'relatorio'}
          aria-controls="prov-tab-relatorio"
          id="prov-tab-btn-relatorio"
          onClick={() => setActiveTab('relatorio')}
        >
          Relatorio de Posicao
        </button>
      </div>

      {/* Tab: Provisoes do Mes */}
      <section
        id="prov-tab-mes"
        role="tabpanel"
        aria-labelledby="prov-tab-btn-mes"
        className={`prov-page__tab-panel ${activeTab === 'mes' ? 'prov-page__tab-panel--active' : ''}`}
      >
        {loading ? (
          <table className="prov-page__table">
            <caption className="sr-only">Carregando provisoes...</caption>
            <thead>
              <tr>
                {['Colaborador', 'Mes Referencia', 'Tipo', 'Salario Base', 'Provisao', 'Encargos', 'Total', 'Centro de Custo', 'Acoes'].map((h) => (
                  <th key={h} scope="col">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={9} />
              ))}
            </tbody>
          </table>
        ) : provisions.length === 0 ? (
          <div className="prov-page__empty">
            <BarChart3 size={48} aria-hidden="true" className="prov-page__empty-icon" />
            <h2 className="prov-page__empty-title">Provisoes nao calculadas para este mes</h2>
            <p className="prov-page__empty-body">
              Clique em Calcular Provisoes para apurar ferias e 13o de todos os colaboradores ativos.
            </p>
            <button
              type="button"
              className="prov-page__cta-btn"
              onClick={handleCalculate}
              disabled={isCalculating}
            >
              <BarChart3 size={20} aria-hidden="true" />
              {isCalculating ? 'Calculando...' : 'Calcular Provisoes'}
            </button>
          </div>
        ) : (
          <div className="prov-page__table-section">
            <table className="prov-page__table">
              <caption className="sr-only">Provisoes do mes {getMonthLabel(selectedMonth)} agrupadas por colaborador</caption>
              <thead>
                <tr>
                  <th scope="col">Colaborador</th>
                  <th scope="col">Mes Referencia</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="prov-page__col-numeric">Salario Base</th>
                  <th scope="col" className="prov-page__col-numeric">Provisao</th>
                  <th scope="col" className="prov-page__col-numeric">Encargos</th>
                  <th scope="col" className="prov-page__col-numeric">Total</th>
                  <th scope="col">Centro de Custo</th>
                  <th scope="col">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(groupedProvisions).map(({ name, items }) => (
                  items.map((p, idx) => (
                    <tr
                      key={p.id}
                      className={`prov-page__row ${p.reversedAt ? 'prov-page__row--reversed' : ''}`}
                    >
                      {idx === 0 ? (
                        <td rowSpan={items.length} className="prov-page__employee-name">
                          {name}
                        </td>
                      ) : null}
                      <td>{getMonthLabel(p.referenceMonth)}</td>
                      <td>{PROVISION_TYPE_LABELS[p.provisionType] ?? p.provisionType}</td>
                      <td className="prov-page__col-numeric">{formatCurrency(p.baseSalary)}</td>
                      <td className="prov-page__col-numeric">{formatCurrency(p.provisionAmount)}</td>
                      <td className="prov-page__col-numeric">{formatCurrency(p.chargesAmount)}</td>
                      <td className="prov-page__col-numeric">{formatCurrency(p.totalAmount)}</td>
                      <td>{p.costCenterName ?? '—'}</td>
                      <td className="prov-page__actions">
                        {p.reversedAt ? (
                          <span
                            className="prov-page__badge prov-page__badge--reversed"
                            aria-label="Status: Provisao estornada"
                          >
                            ESTORNADO
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="prov-page__action-btn"
                            onClick={() =>
                              setConfirmReverse({
                                id: p.id,
                                type: PROVISION_TYPE_LABELS[p.provisionType] ?? p.provisionType,
                                month: getMonthLabel(p.referenceMonth),
                              })
                            }
                          >
                            Estornar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ))}
                {/* Summary row */}
                <tr className="prov-page__summary-row">
                  <td colSpan={4} className="prov-page__summary-label">Total</td>
                  <td className="prov-page__col-numeric">{formatCurrency(totalProvision)}</td>
                  <td className="prov-page__col-numeric">{formatCurrency(totalCharges)}</td>
                  <td className="prov-page__col-numeric">{formatCurrency(totalAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tab: Relatorio de Posicao */}
      <section
        id="prov-tab-relatorio"
        role="tabpanel"
        aria-labelledby="prov-tab-btn-relatorio"
        className={`prov-page__tab-panel ${activeTab === 'relatorio' ? 'prov-page__tab-panel--active' : ''}`}
      >
        <div className="prov-page__report-header">
          <p className="prov-page__report-subtitle">
            Posicao acumulada de provisoes por centro de custo — {getMonthLabel(selectedMonth)}
          </p>
          <button
            type="button"
            className="prov-page__export-btn"
            onClick={handleExport}
          >
            <Download size={16} aria-hidden="true" />
            Exportar CSV
          </button>
        </div>

        {loading ? (
          <table className="prov-page__table">
            <caption className="sr-only">Carregando relatorio de posicao...</caption>
            <thead>
              <tr>
                {['Centro de Custo', 'Total Ferias', 'Total 13o', 'Total Encargos', 'Total Geral'].map((h) => (
                  <th key={h} scope="col">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={5} />
              ))}
            </tbody>
          </table>
        ) : report.length === 0 ? (
          <div className="prov-page__empty">
            <BarChart3 size={48} aria-hidden="true" className="prov-page__empty-icon" />
            <h2 className="prov-page__empty-title">Nenhum dado de relatorio disponivel</h2>
            <p className="prov-page__empty-body">
              Calcule as provisoes do mes para visualizar o relatorio de posicao por centro de custo.
            </p>
          </div>
        ) : (
          <div className="prov-page__table-section">
            <table className="prov-page__table">
              <caption className="sr-only">Relatorio de posicao de provisoes por centro de custo</caption>
              <thead>
                <tr>
                  <th scope="col">Centro de Custo</th>
                  <th scope="col" className="prov-page__col-numeric">Total Ferias</th>
                  <th scope="col" className="prov-page__col-numeric">Total 13o</th>
                  <th scope="col" className="prov-page__col-numeric">Total Encargos</th>
                  <th scope="col" className="prov-page__col-numeric">Total Geral</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row: ProvisionReportRow, i) => (
                  <tr key={row.costCenterId ?? `no-cc-${i}`} className="prov-page__row">
                    <td>{row.costCenterName || '—'}</td>
                    <td className="prov-page__col-numeric">{formatCurrency(row.vacationTotal)}</td>
                    <td className="prov-page__col-numeric">{formatCurrency(row.thirteenthTotal)}</td>
                    <td className="prov-page__col-numeric">{formatCurrency(row.chargesTotal)}</td>
                    <td className="prov-page__col-numeric prov-page__col-bold">{formatCurrency(row.grandTotal)}</td>
                  </tr>
                ))}
                {/* Grand total row */}
                <tr className="prov-page__summary-row">
                  <td className="prov-page__summary-label">Total Geral</td>
                  <td className="prov-page__col-numeric">
                    {formatCurrency(report.reduce((s, r) => s + r.vacationTotal, 0))}
                  </td>
                  <td className="prov-page__col-numeric">
                    {formatCurrency(report.reduce((s, r) => s + r.thirteenthTotal, 0))}
                  </td>
                  <td className="prov-page__col-numeric">
                    {formatCurrency(report.reduce((s, r) => s + r.chargesTotal, 0))}
                  </td>
                  <td className="prov-page__col-numeric">{formatCurrency(reportGrandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reversal Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmReverse}
        title="Estornar Provisao"
        message={
          confirmReverse
            ? `Estornar a provisao de ${confirmReverse.type} de ${confirmReverse.month}? Os valores serao removidos do passivo apurado.`
            : ''
        }
        confirmLabel="Estornar"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={handleReverseConfirm}
        onCancel={() => setConfirmReverse(null)}
      />
    </main>
  );
};

export default PayrollProvisionsPage;
