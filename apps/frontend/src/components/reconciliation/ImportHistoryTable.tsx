import { FileSearch, CheckCircle2, Clock, Minus, Upload } from 'lucide-react';
import type { BankStatementImport } from '@/hooks/useReconciliation';

// ─── Helpers ──────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ─── Status computation ────────────────────────────────────────────

interface ImportStatusBadgeProps {
  importRecord: BankStatementImport;
}

function ImportStatusBadge({ importRecord }: ImportStatusBadgeProps) {
  const { importedLines, pendingLines, reconciledLines, ignoredLines } = importRecord;

  const total = importedLines;

  if (total === 0) {
    return (
      <span className="recon-history__status-badge recon-history__status-badge--ignored">
        <Minus size={12} aria-hidden="true" />
        Vazio
      </span>
    );
  }

  if (reconciledLines + ignoredLines === total && total > 0) {
    return (
      <span className="recon-history__status-badge recon-history__status-badge--completed">
        <CheckCircle2 size={12} aria-hidden="true" />
        Conciliado
      </span>
    );
  }

  if (pendingLines > 0) {
    return (
      <span className="recon-history__status-badge recon-history__status-badge--in-progress">
        <Clock size={12} aria-hidden="true" />
        Em andamento
      </span>
    );
  }

  return (
    <span className="recon-history__status-badge recon-history__status-badge--ignored">
      <Minus size={12} aria-hidden="true" />
      Ignorado
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="recon-history__skeleton-row" aria-hidden="true">
      <td>
        <div className="recon-skeleton-cell" style={{ width: '80%', height: 56 }} />
      </td>
      <td>
        <div className="recon-skeleton-cell" style={{ width: '60%', height: 56 }} />
      </td>
      <td>
        <div className="recon-skeleton-cell" style={{ width: '70%', height: 56 }} />
      </td>
      <td>
        <div className="recon-skeleton-cell" style={{ width: '40%', height: 56 }} />
      </td>
      <td>
        <div className="recon-skeleton-cell" style={{ width: '40%', height: 56 }} />
      </td>
      <td>
        <div className="recon-skeleton-cell" style={{ width: '40%', height: 56 }} />
      </td>
      <td>
        <div className="recon-skeleton-cell" style={{ width: '60%', height: 56 }} />
      </td>
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────

interface ImportHistoryTableProps {
  imports: BankStatementImport[];
  loading: boolean;
  onRowClick: (importId: string) => void;
  onNewImport: () => void;
}

export default function ImportHistoryTable({
  imports,
  loading,
  onRowClick,
  onNewImport,
}: ImportHistoryTableProps) {
  if (loading) {
    return (
      <div className="recon-history__table-wrap" aria-busy="true">
        <table className="recon-history__table">
          <caption className="sr-only">
            Histórico de importações de extrato bancário — carregando
          </caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Arquivo</th>
              <th scope="col">Importado por</th>
              <th scope="col" className="recon-history__col-right">
                Total
              </th>
              <th scope="col" className="recon-history__col-right">
                Importadas
              </th>
              <th scope="col" className="recon-history__col-right">
                Pendentes
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </tbody>
        </table>
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <div className="recon-history__empty">
        <div className="recon-history__empty-icon" aria-hidden="true">
          <FileSearch size={48} />
        </div>
        <h2 className="recon-history__empty-title">Nenhum extrato importado ainda</h2>
        <p className="recon-history__empty-desc">
          Importe o primeiro extrato bancário para iniciar a conciliação automática.
        </p>
        <button type="button" className="reconciliation-page__btn-primary" onClick={onNewImport}>
          <Upload size={20} aria-hidden="true" />
          Nova Importação
        </button>
      </div>
    );
  }

  return (
    <div className="recon-history__table-wrap">
      <table className="recon-history__table">
        <caption className="sr-only">Histórico de importações de extrato bancário</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Arquivo</th>
            <th scope="col">Importado por</th>
            <th scope="col" className="recon-history__col-right">
              Total
            </th>
            <th scope="col" className="recon-history__col-right">
              Importadas
            </th>
            <th scope="col" className="recon-history__col-right">
              Pendentes
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((imp) => (
            <tr
              key={imp.id}
              onClick={() => onRowClick(imp.id)}
              tabIndex={0}
              role="button"
              aria-label={`Abrir conciliação: ${imp.fileName} importado em ${formatDate(imp.createdAt)}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onRowClick(imp.id);
              }}
            >
              <td data-label="Data" className="recon-history__col-mono">
                {formatDate(imp.createdAt)}
              </td>
              <td data-label="Arquivo">
                <div>
                  <strong>{imp.fileName}</strong>
                  {imp.bankAccountName && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-neutral-500, #9e9e9e)',
                        marginTop: 2,
                      }}
                    >
                      {imp.bankAccountName}
                    </div>
                  )}
                </div>
              </td>
              <td data-label="Importado por">{imp.importedByName ?? '—'}</td>
              <td data-label="Total" className="recon-history__col-right recon-history__col-mono">
                {imp.totalLines}
              </td>
              <td
                data-label="Importadas"
                className="recon-history__col-right recon-history__col-mono"
              >
                {imp.importedLines}
              </td>
              <td
                data-label="Pendentes"
                className="recon-history__col-right recon-history__col-mono"
              >
                {imp.pendingLines}
              </td>
              <td data-label="Status">
                <ImportStatusBadge importRecord={imp} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
