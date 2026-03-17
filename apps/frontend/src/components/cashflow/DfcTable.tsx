import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DfcSummary, DfcEntry } from '@/hooks/useCashflow';

// ─── Helpers ──────────────────────────────────────────────────────────

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCellValue(value: number) {
  const negative = value < 0;
  return (
    <span className={`dfc-table__cell${negative ? ' dfc-table__cell--negative' : ''}`}>
      {formatBRL(value)}
    </span>
  );
}

// ─── Category label map ───────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  // Payable categories
  INPUTS: 'Insumos',
  MAINTENANCE: 'Manutencao',
  PAYROLL: 'Folha de pagamento',
  RENT: 'Aluguel',
  SERVICES: 'Servicos',
  TAXES: 'Impostos',
  FINANCING: 'Financiamento',
  OTHER: 'Outros',
  CARTAO_CREDITO: 'Cartao de credito',
  // Receivable categories
  GRAIN_SALE: 'Venda de graos',
  CATTLE_SALE: 'Venda de gado',
  MILK_SALE: 'Venda de leite',
  LEASE: 'Arrendamento',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

// ─── Section component ────────────────────────────────────────────────

type DfcClass = 'OPERACIONAL' | 'INVESTIMENTO' | 'FINANCIAMENTO';

interface SectionData {
  dfcClass: DfcClass;
  label: string;
  inflows: DfcEntry[];
  outflows: DfcEntry[];
  net: number;
}

interface DfcSectionProps {
  section: SectionData;
}

function DfcSection({ section }: DfcSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const netNegative = section.net < 0;
  const hasData = section.inflows.length > 0 || section.outflows.length > 0;

  // Monthly net per column for total row
  const monthlyNet = MONTH_LABELS.map((_, idx) => {
    const inflowsSum = section.inflows.reduce((acc, e) => acc + (e.monthlyAmounts[idx] ?? 0), 0);
    const outflowsSum = section.outflows.reduce((acc, e) => acc + (e.monthlyAmounts[idx] ?? 0), 0);
    return inflowsSum - outflowsSum;
  });

  return (
    <div className="dfc-table__section">
      {/* Section header (toggle button) */}
      <button
        type="button"
        className="dfc-table__section-header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls={`dfc-section-${section.dfcClass}`}
      >
        {expanded ? (
          <ChevronDown size={16} aria-hidden="true" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" />
        )}
        <span>{section.label}</span>
        <span
          className={`dfc-table__section-net${netNegative ? ' dfc-table__section-net--negative' : ''}`}
          aria-label={`Resultado ${section.label}: ${formatBRL(section.net)}`}
        >
          {formatBRL(section.net)}
        </span>
      </button>

      {/* Collapsible body */}
      <div
        id={`dfc-section-${section.dfcClass}`}
        className={`dfc-table__section-body dfc-table__section-body--${expanded ? 'expanded' : 'collapsed'}`}
      >
        {!hasData ? (
          <p className="dfc-table__empty">Sem projecoes para {section.label}</p>
        ) : (
          <div className="dfc-table__wrapper">
            <table className="dfc-table">
              <caption className="visually-hidden">
                Demonstracao de fluxo de caixa — {section.label}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} scope="col">
                      {m}
                    </th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {/* Inflows sub-group */}
                {section.inflows.length > 0 && (
                  <>
                    <tr className="dfc-table__row--group-label">
                      <td colSpan={14}>Entradas</td>
                    </tr>
                    {section.inflows.map((entry) => {
                      const total = entry.monthlyAmounts.reduce((a, b) => a + b, 0);
                      return (
                        <tr key={`in-${entry.category}`} className="dfc-table__row">
                          <th scope="row" className="dfc-table__cell--label">
                            {getCategoryLabel(entry.category)}
                          </th>
                          {entry.monthlyAmounts.map((v, i) => (
                            <td key={i}>{formatCellValue(v)}</td>
                          ))}
                          <td>{formatCellValue(total)}</td>
                        </tr>
                      );
                    })}
                    {/* Inflows subtotal */}
                    <tr className="dfc-table__row--subtotal">
                      <td>Subtotal entradas</td>
                      {MONTH_LABELS.map((_, idx) => {
                        const sum = section.inflows.reduce(
                          (acc, e) => acc + (e.monthlyAmounts[idx] ?? 0),
                          0,
                        );
                        return <td key={idx}>{formatCellValue(sum)}</td>;
                      })}
                      <td>
                        {formatCellValue(section.inflows.reduce((acc, e) => acc + e.total, 0))}
                      </td>
                    </tr>
                  </>
                )}

                {/* Outflows sub-group */}
                {section.outflows.length > 0 && (
                  <>
                    <tr className="dfc-table__row--group-label">
                      <td colSpan={14}>Saidas</td>
                    </tr>
                    {section.outflows.map((entry) => {
                      const total = entry.monthlyAmounts.reduce((a, b) => a + b, 0);
                      return (
                        <tr key={`out-${entry.category}`} className="dfc-table__row">
                          <th scope="row" className="dfc-table__cell--label">
                            {getCategoryLabel(entry.category)}
                          </th>
                          {entry.monthlyAmounts.map((v, i) => (
                            <td key={i}>{formatCellValue(v)}</td>
                          ))}
                          <td>{formatCellValue(total)}</td>
                        </tr>
                      );
                    })}
                    {/* Outflows subtotal */}
                    <tr className="dfc-table__row--subtotal">
                      <td>Subtotal saidas</td>
                      {MONTH_LABELS.map((_, idx) => {
                        const sum = section.outflows.reduce(
                          (acc, e) => acc + (e.monthlyAmounts[idx] ?? 0),
                          0,
                        );
                        return <td key={idx}>{formatCellValue(sum)}</td>;
                      })}
                      <td>
                        {formatCellValue(section.outflows.reduce((acc, e) => acc + e.total, 0))}
                      </td>
                    </tr>
                  </>
                )}

                {/* Section net total row */}
                <tr className="dfc-table__row--total">
                  <td>Resultado {section.label}</td>
                  {monthlyNet.map((v, i) => (
                    <td key={i}>
                      <span className={v < 0 ? 'dfc-table__cell--negative' : ''}>
                        {formatBRL(v)}
                      </span>
                    </td>
                  ))}
                  <td>
                    <span className={netNegative ? 'dfc-table__cell--negative' : ''}>
                      {formatBRL(section.net)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────

interface DfcTableProps {
  dfc: DfcSummary;
}

export default function DfcTable({ dfc }: DfcTableProps) {
  // Build sections
  const sections: SectionData[] = [
    {
      dfcClass: 'OPERACIONAL',
      label: 'Operacional',
      inflows: dfc.inflows.filter((e) => e.dfcClass === 'OPERACIONAL'),
      outflows: dfc.outflows.filter((e) => e.dfcClass === 'OPERACIONAL'),
      net: dfc.operacional.net,
    },
    {
      dfcClass: 'INVESTIMENTO',
      label: 'Investimento',
      inflows: dfc.inflows.filter((e) => e.dfcClass === 'INVESTIMENTO'),
      outflows: dfc.outflows.filter((e) => e.dfcClass === 'INVESTIMENTO'),
      net: dfc.investimento.net,
    },
    {
      dfcClass: 'FINANCIAMENTO',
      label: 'Financiamento',
      inflows: dfc.inflows.filter((e) => e.dfcClass === 'FINANCIAMENTO'),
      outflows: dfc.outflows.filter((e) => e.dfcClass === 'FINANCIAMENTO'),
      net: dfc.financiamento.net,
    },
  ];

  // Grand total net per month
  const grandTotalNet = MONTH_LABELS.map((_, idx) => {
    const allInflowsMonth = dfc.inflows.reduce((acc, e) => acc + (e.monthlyAmounts[idx] ?? 0), 0);
    const allOutflowsMonth = dfc.outflows.reduce((acc, e) => acc + (e.monthlyAmounts[idx] ?? 0), 0);
    return allInflowsMonth - allOutflowsMonth;
  });

  const grandTotalNetAll = grandTotalNet.reduce((a, b) => a + b, 0);

  return (
    <div>
      {sections.map((section) => (
        <DfcSection key={section.dfcClass} section={section} />
      ))}

      {/* Grand total row (all sections combined) */}
      <div className="dfc-table__wrapper" style={{ marginTop: 'var(--space-4)' }}>
        <table className="dfc-table">
          <caption className="visually-hidden">Resultado total do fluxo de caixa projetado</caption>
          <thead>
            <tr>
              <th scope="col">Resultado Total</th>
              {MONTH_LABELS.map((m) => (
                <th key={m} scope="col">
                  {m}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="dfc-table__row--total">
              <td>Resultado total (Oper. + Invest. + Financ.)</td>
              {grandTotalNet.map((v, i) => (
                <td key={i}>
                  <span className={v < 0 ? 'dfc-table__cell--negative' : ''}>{formatBRL(v)}</span>
                </td>
              ))}
              <td>
                <span className={grandTotalNetAll < 0 ? 'dfc-table__cell--negative' : ''}>
                  {formatBRL(grandTotalNetAll)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
