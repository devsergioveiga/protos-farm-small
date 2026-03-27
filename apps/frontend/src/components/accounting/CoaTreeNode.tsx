import { ChevronRight, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import type { ChartOfAccount, AccountType } from '@/types/accounting';
import './CoaTreeNode.css';

// ─── Type badge config ────────────────────────────────────────────────────

const TYPE_LABELS: Record<AccountType, string> = {
  ATIVO: 'Ativo',
  PASSIVO: 'Passivo',
  PL: 'PL',
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
};

const TYPE_CSS: Record<AccountType, string> = {
  ATIVO: 'coa-tree-node__type--ativo',
  PASSIVO: 'coa-tree-node__type--passivo',
  PL: 'coa-tree-node__type--pl',
  RECEITA: 'coa-tree-node__type--receita',
  DESPESA: 'coa-tree-node__type--despesa',
};

// ─── Props ────────────────────────────────────────────────────────────────

interface CoaTreeNodeProps {
  account: ChartOfAccount;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (account: ChartOfAccount) => void;
  onDeactivate: (account: ChartOfAccount) => void;
  level: number;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function CoaTreeNode({
  account,
  expandedIds,
  onToggle,
  onEdit,
  onDeactivate,
  level,
}: CoaTreeNodeProps) {
  const hasChildren = (account.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(account.id);
  const isInactive = !account.isActive;

  return (
    <>
      <div
        className={`coa-tree-node ${isInactive ? 'coa-tree-node--inactive' : ''}`}
        style={{ paddingLeft: `${level * 24}px` }}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected="false"
      >
        {/* Expand/collapse chevron */}
        <button
          type="button"
          className="coa-tree-node__toggle"
          onClick={() => onToggle(account.id)}
          aria-label={isExpanded ? `Recolher ${account.name}` : `Expandir ${account.name}`}
          aria-expanded={isExpanded}
          disabled={!hasChildren && !account.isSynthetic}
          tabIndex={hasChildren || account.isSynthetic ? 0 : -1}
        >
          {hasChildren || account.isSynthetic ? (
            isExpanded ? (
              <ChevronDown size={16} aria-hidden="true" />
            ) : (
              <ChevronRight size={16} aria-hidden="true" />
            )
          ) : (
            <span className="coa-tree-node__toggle-spacer" aria-hidden="true" />
          )}
        </button>

        {/* Account info */}
        <div className="coa-tree-node__info">
          <span className="coa-tree-node__code">{account.code}</span>
          <span className={`coa-tree-node__name ${isInactive ? 'coa-tree-node__name--strikethrough' : ''}`}>
            {account.name}
          </span>
          {account.isSynthetic && (
            <span className="coa-tree-node__synthetic-label">Grupo</span>
          )}
        </div>

        {/* Badges */}
        <div className="coa-tree-node__badges">
          <span className={`coa-tree-node__type ${TYPE_CSS[account.accountType]}`}>
            {TYPE_LABELS[account.accountType]}
          </span>
          <span className="coa-tree-node__nature">
            {account.nature === 'DEVEDORA' ? 'D' : 'C'}
          </span>
        </div>

        {/* Actions */}
        <div className="coa-tree-node__actions">
          <button
            type="button"
            className="coa-tree-node__action-btn"
            onClick={() => onEdit(account)}
            aria-label={`Editar ${account.name}`}
          >
            <Pencil size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="coa-tree-node__action-btn coa-tree-node__action-btn--danger"
            onClick={() => onDeactivate(account)}
            aria-label={`Desativar ${account.name}`}
          >
            <Trash2 size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Recursive children */}
      {isExpanded && hasChildren && account.children?.map((child) => (
        <CoaTreeNode
          key={child.id}
          account={child}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
          level={level + 1}
        />
      ))}
    </>
  );
}
