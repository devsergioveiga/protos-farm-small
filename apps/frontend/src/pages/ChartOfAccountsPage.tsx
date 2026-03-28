import { useState, useCallback, useMemo } from 'react';
import { GitBranch, Plus, Search, AlertTriangle, TreePine } from 'lucide-react';
import {
  useChartOfAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeactivateAccount,
  useSeedTemplate,
  useUnmappedSped,
} from '@/hooks/useChartOfAccounts';
import CoaTreeNode from '@/components/accounting/CoaTreeNode';
import CoaModal from '@/components/accounting/CoaModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { ChartOfAccount, CreateAccountInput } from '@/types/accounting';
import './ChartOfAccountsPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildTree(accounts: ChartOfAccount[]): ChartOfAccount[] {
  const map = new Map<string, ChartOfAccount>();
  const roots: ChartOfAccount[] = [];

  // Clone to avoid mutating source
  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [] });
  }

  for (const acc of map.values()) {
    if (acc.parentId && map.has(acc.parentId)) {
      const parent = map.get(acc.parentId)!;
      (parent.children ??= []).push(acc);
    } else {
      roots.push(acc);
    }
  }

  return roots;
}

function filterTree(nodes: ChartOfAccount[], term: string): ChartOfAccount[] {
  if (!term.trim()) return nodes;
  const lower = term.toLowerCase();
  return nodes.reduce<ChartOfAccount[]>((acc, node) => {
    const match =
      node.code.toLowerCase().includes(lower) || node.name.toLowerCase().includes(lower);
    const filteredChildren = filterTree(node.children ?? [], term);
    if (match || filteredChildren.length > 0) {
      acc.push({ ...node, children: filteredChildren });
    }
    return acc;
  }, []);
}

function flattenTree(nodes: ChartOfAccount[]): ChartOfAccount[] {
  const result: ChartOfAccount[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

// ─── Skeleton ────────────────────────────────────────────────────────────

function CoaSkeleton() {
  return (
    <div className="coa-page__skeleton" aria-label="Carregando plano de contas..." aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="coa-page__skeleton-row"
          style={{ paddingLeft: `${(i % 3) * 24}px` }}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
  const { data: rawAccounts, isLoading, error, refetch } = useChartOfAccounts();
  const { data: unmappedSped } = useUnmappedSped();
  const { mutate: createAccount } = useCreateAccount();
  const { mutate: updateAccount } = useUpdateAccount();
  const { mutate: deactivateAccount } = useDeactivateAccount();
  const { mutate: seedTemplate, isLoading: seeding } = useSeedTemplate();

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | undefined>(undefined);
  const [deactivatingAccount, setDeactivatingAccount] = useState<ChartOfAccount | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const tree = useMemo(() => buildTree(rawAccounts), [rawAccounts]);
  const filteredTree = useMemo(() => filterTree(tree, searchTerm), [tree, searchTerm]);
  const allAccounts = useMemo(() => flattenTree(tree), [tree]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleEdit = useCallback((account: ChartOfAccount) => {
    setEditingAccount(account);
    setShowModal(true);
  }, []);

  const handleDeactivate = useCallback((account: ChartOfAccount) => {
    setDeactivatingAccount(account);
  }, []);

  const handleModalSubmit = useCallback(
    async (data: CreateAccountInput) => {
      if (editingAccount) {
        await updateAccount(editingAccount.id, data);
        showToast('Conta atualizada com sucesso');
      } else {
        await createAccount(data);
        showToast('Conta criada com sucesso');
      }
      setShowModal(false);
      setEditingAccount(undefined);
      void refetch();
    },
    [editingAccount, createAccount, updateAccount, refetch],
  );

  const handleConfirmDeactivate = useCallback(async () => {
    if (!deactivatingAccount) return;
    try {
      await deactivateAccount(deactivatingAccount.id);
      showToast('Conta desativada com sucesso');
      void refetch();
    } catch {
      showToast('Não foi possível desativar a conta. Verifique se ela não possui lançamentos.');
    } finally {
      setDeactivatingAccount(null);
    }
  }, [deactivatingAccount, deactivateAccount, refetch]);

  const handleSeed = useCallback(async () => {
    try {
      const result = await seedTemplate();
      showToast(`Template carregado: ${result.created} criadas, ${result.updated} atualizadas`);
      void refetch();
    } catch {
      showToast('Não foi possível carregar o template rural.');
    }
  }, [seedTemplate, refetch]);

  return (
    <main className="coa-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="coa-page__breadcrumb" aria-label="Caminho da página">
        <span className="coa-page__breadcrumb-item">Contabilidade</span>
        <span className="coa-page__breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span className="coa-page__breadcrumb-item coa-page__breadcrumb-item--current">
          Plano de Contas
        </span>
      </nav>

      {/* Header */}
      <header className="coa-page__header">
        <div className="coa-page__header-left">
          <GitBranch size={24} aria-hidden="true" className="coa-page__header-icon" />
          <h1 className="coa-page__title">Plano de Contas</h1>
        </div>
        <div className="coa-page__header-actions">
          <button
            type="button"
            className="coa-page__btn coa-page__btn--secondary"
            onClick={() => {
              void handleSeed();
            }}
            disabled={seeding}
          >
            <TreePine size={16} aria-hidden="true" />
            {seeding ? 'Carregando...' : 'Carregar Template Rural'}
          </button>
          <button
            type="button"
            className="coa-page__btn coa-page__btn--primary"
            onClick={() => {
              setEditingAccount(undefined);
              setShowModal(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Nova Conta
          </button>
        </div>
      </header>

      {/* SPED alert */}
      {unmappedSped.length > 0 && (
        <div className="coa-page__alert" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            {unmappedSped.length} conta{unmappedSped.length !== 1 ? 's' : ''} analítica
            {unmappedSped.length !== 1 ? 's' : ''} sem mapeamento SPED referencial
          </span>
        </div>
      )}

      {/* Search */}
      <div className="coa-page__search">
        <Search size={16} aria-hidden="true" className="coa-page__search-icon" />
        <input
          type="search"
          className="coa-page__search-input"
          placeholder="Filtrar por código ou nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Filtrar contas por código ou nome"
        />
      </div>

      {/* Tree body */}
      <section className="coa-page__body" aria-label="Árvore do plano de contas">
        {isLoading && <CoaSkeleton />}

        {!isLoading && error && (
          <div className="coa-page__error" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && filteredTree.length === 0 && (
          <div className="coa-page__empty">
            <GitBranch size={48} aria-hidden="true" className="coa-page__empty-icon" />
            <h2 className="coa-page__empty-title">Nenhuma conta cadastrada</h2>
            <p className="coa-page__empty-desc">
              Carregue o template rural para começar com um plano de contas pré-configurado para
              agronegócio, ou cadastre suas contas manualmente.
            </p>
            <div className="coa-page__empty-actions">
              <button
                type="button"
                className="coa-page__btn coa-page__btn--primary"
                onClick={() => {
                  void handleSeed();
                }}
                disabled={seeding}
              >
                <TreePine size={16} aria-hidden="true" />
                {seeding ? 'Carregando...' : 'Carregar Template Rural'}
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && filteredTree.length > 0 && (
          <div className="coa-page__tree" role="tree" aria-label="Plano de contas hierárquico">
            {filteredTree.map((root) => (
              <CoaTreeNode
                key={root.id}
                account={root}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDeactivate={handleDeactivate}
                level={0}
              />
            ))}
          </div>
        )}
      </section>

      {/* Create/Edit Modal */}
      <CoaModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingAccount(undefined);
        }}
        onSubmit={handleModalSubmit}
        account={editingAccount}
        parentAccounts={allAccounts.filter((a) => a.isSynthetic)}
      />

      {/* Deactivate confirm */}
      <ConfirmModal
        isOpen={!!deactivatingAccount}
        title="Desativar conta"
        message={`Deseja desativar a conta "${deactivatingAccount?.code} — ${deactivatingAccount?.name}"? Esta ação pode ser revertida editando a conta.`}
        confirmLabel="Desativar"
        variant="warning"
        onConfirm={() => {
          void handleConfirmDeactivate();
        }}
        onCancel={() => setDeactivatingAccount(null)}
      />

      {/* Toast */}
      {toast && (
        <div className="coa-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
