import { useState, useEffect } from 'react';
import {
  FileBarChart2,
  Download,
  Send,
  AlertCircle,
  CheckCircle,
  Info,
  Plus,
} from 'lucide-react';
import { useIncomeStatements } from '@/hooks/useIncomeStatements';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  GENERATED: 'Gerado',
  SENT: 'Enviado',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    GENERATED: 'bg-blue-100 text-blue-800',
    SENT: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function IncomeStatementsPage() {
  const { statements, loading, error, generating, consistencyReport, fetchStatements, generateStatements, downloadStatement, sendStatement, checkConsistency } = useIncomeStatements();
  const [year, setYear] = useState(CURRENT_YEAR);

  useEffect(() => {
    void fetchStatements(year);
  }, [year, fetchStatements]);

  async function handleGenerate() {
    await generateStatements(year);
  }

  async function handleCheckConsistency() {
    await checkConsistency(year);
  }

  return (
    <main className="p-6 max-w-screen-xl mx-auto">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--color-neutral-500)] mb-4">
        <span>RH</span>
        <span className="mx-2">/</span>
        <span className="text-[var(--color-neutral-700)]">Informes de Rendimentos</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-neutral-800)]" style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}>
          Informes de Rendimentos
        </h1>
        <div className="flex gap-3">
          <label htmlFor="year-select" className="sr-only">Ano de referência</label>
          <select
            id="year-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-[var(--color-neutral-300)] rounded px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)]"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleCheckConsistency()}
            aria-label="Verificar consistência com RAIS"
            className="flex items-center gap-2 border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] px-4 py-2 rounded text-sm font-medium hover:bg-[var(--color-neutral-50)] min-h-[48px]"
          >
            <CheckCircle size={16} aria-hidden="true" />
            Verificar Consistência
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            aria-label="Gerar informes de rendimentos"
            className="flex items-center gap-2 bg-[var(--color-primary-600)] text-white px-4 py-2 rounded text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-50 min-h-[48px]"
          >
            <Plus size={16} aria-hidden="true" />
            {generating ? 'Gerando...' : 'Gerar Informes'}
          </button>
        </div>
      </header>

      {/* RAIS banner */}
      <div role="note" className="flex items-start gap-3 bg-blue-50 border border-blue-200 text-blue-800 rounded p-4 mb-6 text-sm">
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          <strong>Informação RAIS:</strong> A partir de 2025, a DIRF foi abolida e substituída pelos informes de rendimentos entregues diretamente aos trabalhadores. Os dados enviados ao eSocial substituem a entrega ao Fisco.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Consistency report */}
      {consistencyReport && (
        <section aria-labelledby="consistency-heading" className="mb-6 border border-[var(--color-neutral-200)] rounded-lg p-4">
          <h2 id="consistency-heading" className="font-semibold text-[var(--color-neutral-800)] mb-3 flex items-center gap-2" style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}>
            {consistencyReport.consistent
              ? <><CheckCircle size={16} className="text-green-600" aria-hidden="true" /> Consistência verificada — sem divergências</>
              : <><AlertCircle size={16} className="text-[var(--color-error-500)]" aria-hidden="true" /> {consistencyReport.issues.length} divergência(s) encontrada(s)</>
            }
          </h2>
          {!consistencyReport.consistent && (
            <ul className="space-y-1 text-sm text-[var(--color-neutral-700)]">
              {consistencyReport.issues.map((issue, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="font-medium">{issue.employeeName}:</span>
                  <span>{issue.description}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Statements table */}
      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando informes">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-[var(--color-neutral-100)] rounded animate-pulse" />
          ))}
        </div>
      ) : statements.length === 0 ? (
        <div className="text-center py-16">
          <FileBarChart2 size={48} className="mx-auto text-[var(--color-neutral-400)] mb-3" aria-hidden="true" />
          <p className="font-semibold text-[var(--color-neutral-700)]">Nenhum informe gerado</p>
          <p className="text-sm text-[var(--color-neutral-500)] mt-1">Clique em "Gerar Informes" para criar os informes de rendimentos do ano selecionado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Lista de informes de rendimentos</caption>
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)] text-left text-xs uppercase text-[var(--color-neutral-500)]">
                <th scope="col" className="py-3 pr-4 font-medium">COLABORADOR</th>
                <th scope="col" className="py-3 pr-4 font-medium">CPF</th>
                <th scope="col" className="py-3 pr-4 font-medium">RENDIMENTOS</th>
                <th scope="col" className="py-3 pr-4 font-medium">DEDUÇÕES</th>
                <th scope="col" className="py-3 pr-4 font-medium">IRRF</th>
                <th scope="col" className="py-3 pr-4 font-medium">STATUS</th>
                <th scope="col" className="py-3 font-medium">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((stmt) => (
                <tr key={stmt.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                  <td className="py-3 pr-4 font-medium text-[var(--color-neutral-800)]">{stmt.employeeName}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-[var(--color-neutral-600)]">{stmt.cpf}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-[var(--color-neutral-700)]">{formatCurrency(stmt.totalIncome)}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-[var(--color-neutral-700)]">{formatCurrency(stmt.totalDeductions)}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-[var(--color-neutral-700)]">{formatCurrency(stmt.irrf)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={stmt.status} /></td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void downloadStatement(stmt.id)}
                        aria-label={`Baixar informe de ${stmt.employeeName}`}
                        className="p-1 text-[var(--color-neutral-500)] hover:text-[var(--color-primary-600)] min-h-[48px] min-w-[48px] flex items-center justify-center"
                      >
                        <Download size={16} aria-hidden="true" />
                      </button>
                      {stmt.status === 'GENERATED' && (
                        <button
                          type="button"
                          onClick={() => void sendStatement(stmt.id)}
                          aria-label={`Enviar informe de ${stmt.employeeName} por email`}
                          className="p-1 text-[var(--color-neutral-500)] hover:text-[var(--color-primary-600)] min-h-[48px] min-w-[48px] flex items-center justify-center"
                        >
                          <Send size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
