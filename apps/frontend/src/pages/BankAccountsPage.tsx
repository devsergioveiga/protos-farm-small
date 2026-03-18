import { useState, useCallback } from 'react';
import {
  Plus,
  Building2,
  AlertCircle,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from 'lucide-react';
import { FEBRABAN_BANKS } from '@protos-farm/shared';
import {
  useBankAccounts,
  useBankAccountDashboard,
  useBankAccountStatement,
} from '@/hooks/useBankAccounts';
import type { BankAccount, BankAccountType } from '@/hooks/useBankAccounts';
import { useFarms } from '@/hooks/useFarms';
import BankAccountModal from '@/components/bank-accounts/BankAccountModal';
import { api } from '@/services/api';
import './BankAccountsPage.css';

// ─── Constants ────────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  CHECKING: 'Conta corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento',
  RURAL_CREDIT: 'Crédito rural',
};

const TYPE_OPTIONS: { value: BankAccountType; label: string }[] = [
  { value: 'CHECKING', label: 'Conta corrente' },
  { value: 'SAVINGS', label: 'Poupança' },
  { value: 'INVESTMENT', label: 'Investimento' },
  { value: 'RURAL_CREDIT', label: 'Crédito rural' },
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ─── Skeleton ────────────────────────────────────────────────────────

function AccountCardSkeleton() {
  return (
    <div className="ba-page__card ba-page__card--skeleton" aria-hidden="true">
      <div className="ba-page__skeleton-line ba-page__skeleton-line--short" />
      <div className="ba-page__skeleton-line ba-page__skeleton-line--long" />
      <div className="ba-page__skeleton-line ba-page__skeleton-line--medium" />
      <div className="ba-page__skeleton-line ba-page__skeleton-line--amount" />
    </div>
  );
}

// ─── Statement Panel ─────────────────────────────────────────────────

interface StatementPanelProps {
  account: BankAccount;
  onClose: () => void;
}

function StatementPanel({ account, onClose }: StatementPanelProps) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [txType, setTxType] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { transactions, isLoading, error } = useBankAccountStatement(account.id, {
    from: fromDate || undefined,
    to: toDate || undefined,
    type: txType || undefined,
  });

  const handleExport = useCallback(
    async (format: 'pdf' | 'xlsx' | 'csv') => {
      setIsExporting(true);
      try {
        const qs = new URLSearchParams({ format });
        if (fromDate) qs.set('from', fromDate);
        if (toDate) qs.set('to', toDate);
        const blob = await api.getBlob(
          `/org/bank-accounts/${account.id}/statement/export?${qs.toString()}`,
        );
        const ext = format === 'xlsx' ? 'xlsx' : format;
        const mimeMap = {
          pdf: 'application/pdf',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          csv: 'text/csv',
        };
        const url = URL.createObjectURL(new Blob([blob], { type: mimeMap[format] }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `extrato-${account.name.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // silent — user can retry
      } finally {
        setIsExporting(false);
      }
    },
    [account.id, account.name, fromDate, toDate],
  );

  return (
    <section className="ba-page__statement" aria-label={`Extrato: ${account.name}`}>
      <div className="ba-page__statement-header">
        <h3 className="ba-page__statement-title">
          <FileText size={16} aria-hidden="true" />
          Extrato — {account.name}
        </h3>
        <button
          type="button"
          className="ba-page__statement-close"
          onClick={onClose}
          aria-label="Fechar extrato"
        >
          <ChevronUp size={16} aria-hidden="true" />
          Fechar
        </button>
      </div>

      <div className="ba-page__statement-toolbar">
        <div className="ba-page__statement-filters">
          <div className="ba-page__filter-group">
            <label htmlFor="stmt-from" className="ba-page__filter-label">
              De
            </label>
            <input
              id="stmt-from"
              type="date"
              className="ba-page__filter-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="ba-page__filter-group">
            <label htmlFor="stmt-to" className="ba-page__filter-label">
              Até
            </label>
            <input
              id="stmt-to"
              type="date"
              className="ba-page__filter-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="ba-page__filter-group">
            <label htmlFor="stmt-type" className="ba-page__filter-label">
              Tipo
            </label>
            <select
              id="stmt-type"
              className="ba-page__filter-input"
              value={txType}
              onChange={(e) => setTxType(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="CREDIT">Entrada</option>
              <option value="DEBIT">Saída</option>
            </select>
          </div>
        </div>

        <div className="ba-page__statement-exports">
          <span className="ba-page__export-label">Exportar:</span>
          <button
            type="button"
            className="ba-page__export-btn"
            onClick={() => void handleExport('pdf')}
            disabled={isExporting}
            aria-label="Exportar extrato em PDF"
          >
            <Download size={14} aria-hidden="true" />
            PDF
          </button>
          <button
            type="button"
            className="ba-page__export-btn"
            onClick={() => void handleExport('xlsx')}
            disabled={isExporting}
            aria-label="Exportar extrato em Excel"
          >
            <Download size={14} aria-hidden="true" />
            Excel
          </button>
          <button
            type="button"
            className="ba-page__export-btn"
            onClick={() => void handleExport('csv')}
            disabled={isExporting}
            aria-label="Exportar extrato em CSV"
          >
            <Download size={14} aria-hidden="true" />
            CSV
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="ba-page__statement-loading" aria-live="polite">
          Carregando extrato...
        </div>
      )}

      {error && (
        <div className="ba-page__statement-error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {!isLoading && !error && transactions.length === 0 && (
        <div className="ba-page__statement-empty">
          Nenhuma transação encontrada para o período selecionado.
        </div>
      )}

      {!isLoading && transactions.length > 0 && (
        <div className="ba-page__statement-table-wrap">
          <table className="ba-page__statement-table">
            <caption className="sr-only">Extrato da conta {account.name}</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Descrição</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="ba-page__col-right">
                  Valor
                </th>
                <th scope="col" className="ba-page__col-right">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="ba-page__col-mono">{formatDate(tx.date)}</td>
                  <td>{tx.description}</td>
                  <td>
                    <span
                      className={`ba-page__tx-badge ba-page__tx-badge--${tx.type.toLowerCase()}`}
                    >
                      {tx.type === 'CREDIT'
                        ? 'Entrada'
                        : tx.type === 'DEBIT'
                          ? 'Saída'
                          : 'Saldo inicial'}
                    </span>
                  </td>
                  <td
                    className={`ba-page__col-right ba-page__col-mono ${
                      tx.type === 'DEBIT' ? 'ba-page__amount--debit' : 'ba-page__amount--credit'
                    }`}
                  >
                    {tx.type === 'DEBIT' ? '−' : '+'} {formatBRL(Math.abs(tx.amount))}
                  </td>
                  <td className="ba-page__col-right ba-page__col-mono">{formatBRL(tx.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────

interface AccountCardProps {
  account: BankAccount;
  isStatementOpen: boolean;
  onToggleStatement: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function AccountCard({
  account,
  isStatementOpen,
  onToggleStatement,
  onEdit,
  onDelete,
}: AccountCardProps) {
  const bank = FEBRABAN_BANKS.find((b) => b.code === account.bankCode);
  const bankLabel = bank ? bank.shortName : account.bankName || account.bankCode;

  return (
    <article className="ba-page__card">
      <div className="ba-page__card-top">
        <div className="ba-page__card-bank">
          <Building2 size={20} aria-hidden="true" className="ba-page__bank-icon" />
          <span className="ba-page__bank-name">{bankLabel}</span>
          <span className="ba-page__type-badge">{ACCOUNT_TYPE_LABELS[account.type]}</span>
        </div>
        <div className="ba-page__card-actions">
          <button
            type="button"
            className="ba-page__action-btn"
            onClick={onEdit}
            aria-label={`Editar ${account.name}`}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ba-page__action-btn ba-page__action-btn--danger"
            onClick={onDelete}
            aria-label={`Excluir ${account.name}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <h3 className="ba-page__account-name">{account.name}</h3>

      <p className="ba-page__account-number">
        Ag. {account.agency}
        {account.agencyDigit ? `-${account.agencyDigit}` : ''} / Conta {account.accountNumber}
        {account.accountDigit ? `-${account.accountDigit}` : ''}
      </p>

      <div className="ba-page__balance">
        <span className="ba-page__balance-label">Saldo atual</span>
        <span className="ba-page__balance-value">{formatBRL(account.balance.currentBalance)}</span>
      </div>

      <div className="ba-page__projected">
        <span className="ba-page__projected-label">Saldo projetado</span>
        <span
          className="ba-page__projected-value"
          title="Disponível após cadastrar contas a pagar e receber"
          aria-label="Saldo projetado: indisponível. Disponível após cadastrar contas a pagar e receber"
        >
          --
        </span>
      </div>

      {account.producer && <p className="ba-page__producer">Produtor: {account.producer.name}</p>}

      {account.farms.length > 0 && (
        <div className="ba-page__farms" aria-label="Fazendas vinculadas">
          {account.farms.map((f) => (
            <span key={f.id} className="ba-page__farm-chip">
              {f.name}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className="ba-page__statement-btn"
        onClick={onToggleStatement}
        aria-expanded={isStatementOpen}
      >
        <FileText size={16} aria-hidden="true" />
        Ver extrato
        {isStatementOpen ? (
          <ChevronUp size={14} aria-hidden="true" />
        ) : (
          <ChevronDown size={14} aria-hidden="true" />
        )}
      </button>
    </article>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export default function BankAccountsPage() {
  const [farmFilter, setFarmFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [bankCodeFilter, setBankCodeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | undefined>();
  const [openStatementId, setOpenStatementId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { farms } = useFarms();
  const { accounts, isLoading, error, refetch } = useBankAccounts({
    farmId: farmFilter || undefined,
    type: typeFilter || undefined,
    bankCode: bankCodeFilter || undefined,
  });
  const {
    dashboard,
    isLoading: dashLoading,
    refetch: refetchDashboard,
  } = useBankAccountDashboard();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setShowModal(false);
    setEditAccountId(undefined);
    void refetch();
    void refetchDashboard();
    showToast('Conta bancária cadastrada com sucesso');
  }, [refetch, refetchDashboard, showToast]);

  const handleEditSuccess = useCallback(() => {
    setShowModal(false);
    setEditAccountId(undefined);
    void refetch();
    void refetchDashboard();
    showToast('Conta bancária atualizada com sucesso');
  }, [refetch, refetchDashboard, showToast]);

  const handleEdit = useCallback((accountId: string) => {
    setEditAccountId(accountId);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (accountId: string) => {
      try {
        await api.delete(`/org/bank-accounts/${accountId}`);
        void refetch();
        void refetchDashboard();
        showToast('Conta bancária removida');
      } catch {
        showToast('Não foi possível remover a conta bancária.');
      } finally {
        setDeleteConfirmId(null);
      }
    },
    [refetch, refetchDashboard, showToast],
  );

  const openForCreate = useCallback(() => {
    setEditAccountId(undefined);
    setShowModal(true);
  }, []);

  const toggleStatement = useCallback((accountId: string) => {
    setOpenStatementId((prev) => (prev === accountId ? null : accountId));
  }, []);

  // Find the account being deleted for confirmation
  const deleteAccount = deleteConfirmId ? accounts.find((a) => a.id === deleteConfirmId) : null;

  return (
    <main className="ba-page" id="main-content">
      {toast && (
        <div className="ba-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteAccount && (
        <div
          className="ba-page__confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar exclusão"
        >
          <div className="ba-page__confirm-panel">
            <h3 className="ba-page__confirm-title">Remover conta bancária?</h3>
            <p className="ba-page__confirm-text">
              A conta <strong>{deleteAccount.name}</strong> será desativada. Esta ação não pode ser
              desfeita.
            </p>
            <div className="ba-page__confirm-actions">
              <button
                type="button"
                className="ba-page__confirm-cancel"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ba-page__confirm-delete"
                onClick={() => void handleDelete(deleteAccount.id)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Remover conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="ba-page__header">
        <div>
          <h1 className="ba-page__title">Contas bancárias</h1>
          <p className="ba-page__subtitle">Gerencie contas e acompanhe saldos</p>
        </div>
        <button type="button" className="ba-page__btn-primary" onClick={openForCreate}>
          <Plus size={20} aria-hidden="true" />
          Nova conta bancária
        </button>
      </header>

      {/* Totalization bar */}
      {!dashLoading && dashboard && (
        <section className="ba-page__totals" aria-label="Resumo financeiro">
          <div className="ba-page__total-main">
            <span className="ba-page__total-label">Saldo total</span>
            <span className="ba-page__total-value">{formatBRL(dashboard.totalBalance)}</span>
          </div>
          <div className="ba-page__total-divider" aria-hidden="true" />
          {dashboard.byType.map((bt) => (
            <div key={bt.type} className="ba-page__total-bytype">
              <span className="ba-page__total-type-label">{ACCOUNT_TYPE_LABELS[bt.type]}</span>
              <span className="ba-page__total-type-value">{formatBRL(bt.totalBalance)}</span>
            </div>
          ))}
          <div className="ba-page__total-count">
            {dashboard.accountCount} {dashboard.accountCount === 1 ? 'conta' : 'contas'}
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="ba-page__filters" aria-label="Filtros">
        <div className="ba-page__filter-group">
          <label htmlFor="filter-farm" className="ba-page__filter-label">
            Fazenda
          </label>
          <select
            id="filter-farm"
            className="ba-page__filter-select"
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
          >
            <option value="">Todas as fazendas</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ba-page__filter-group">
          <label htmlFor="filter-type" className="ba-page__filter-label">
            Tipo
          </label>
          <select
            id="filter-type"
            className="ba-page__filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ba-page__filter-group">
          <label htmlFor="filter-bank" className="ba-page__filter-label">
            Banco
          </label>
          <select
            id="filter-bank"
            className="ba-page__filter-select"
            value={bankCodeFilter}
            onChange={(e) => setBankCodeFilter(e.target.value)}
          >
            <option value="">Todos os bancos</option>
            {FEBRABAN_BANKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.shortName} ({b.code})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="ba-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="ba-page__grid" aria-busy="true" aria-label="Carregando contas bancárias">
          {[1, 2, 3].map((i) => (
            <AccountCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && accounts.length === 0 && (
        <div className="ba-page__empty">
          <div className="ba-page__empty-icon" aria-hidden="true">
            <Building2 size={48} />
          </div>
          <h2 className="ba-page__empty-title">Nenhuma conta bancária cadastrada</h2>
          <p className="ba-page__empty-desc">
            Cadastre sua primeira conta para acompanhar saldos e extratos
          </p>
          <button type="button" className="ba-page__btn-primary" onClick={openForCreate}>
            <Plus size={20} aria-hidden="true" />
            Nova conta bancária
          </button>
        </div>
      )}

      {/* Account cards */}
      {!isLoading && accounts.length > 0 && (
        <div className="ba-page__accounts">
          <div className="ba-page__grid">
            {accounts.map((account) => (
              <div key={account.id} className="ba-page__card-wrap">
                <AccountCard
                  account={account}
                  isStatementOpen={openStatementId === account.id}
                  onToggleStatement={() => toggleStatement(account.id)}
                  onEdit={() => handleEdit(account.id)}
                  onDelete={() => setDeleteConfirmId(account.id)}
                />
                {openStatementId === account.id && (
                  <StatementPanel account={account} onClose={() => setOpenStatementId(null)} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      <BankAccountModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditAccountId(undefined);
        }}
        onSuccess={editAccountId ? handleEditSuccess : handleCreateSuccess}
        accountId={editAccountId}
      />
    </main>
  );
}
