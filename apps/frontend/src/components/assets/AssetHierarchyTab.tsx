import { Layers } from 'lucide-react';
import type { Asset, AssetStatus } from '@/types/asset';
import './AssetHierarchyTab.css';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatBRL(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Nao informado';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'Nao informado';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatBRLNumber(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Status badge (simplified inline version) ─────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  EM_MANUTENCAO: 'Em manutencao',
  ALIENADO: 'Alienado',
  EM_ANDAMENTO: 'Em andamento',
};

const STATUS_CSS: Record<string, string> = {
  ATIVO: 'asset-hierarchy-tab__status--ativo',
  INATIVO: 'asset-hierarchy-tab__status--inativo',
  EM_MANUTENCAO: 'asset-hierarchy-tab__status--manutencao',
  ALIENADO: 'asset-hierarchy-tab__status--alienado',
  EM_ANDAMENTO: 'asset-hierarchy-tab__status--andamento',
};

function StatusChip({ status }: { status: AssetStatus }) {
  const label = STATUS_LABELS[status] ?? status;
  const css = STATUS_CSS[status] ?? '';
  return (
    <span className={`asset-hierarchy-tab__status ${css}`}>{label}</span>
  );
}

// ─── Tree node ─────────────────────────────────────────────────────────────

interface TreeNodeData {
  id: string;
  name: string;
  assetTag: string;
  acquisitionValue?: string | number | null;
  status: AssetStatus;
  childAssets?: TreeNodeData[];
}

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  isCurrent: boolean;
  onNavigate: (assetId: string) => void;
}

function TreeNode({ node, level, isCurrent, onNavigate }: TreeNodeProps) {
  const valueStr = formatBRL(node.acquisitionValue);
  const ariaLabel = `${node.name} — ${valueStr}`;
  const levelClass = level > 0 ? ` asset-hierarchy-tab__node--level-${Math.min(level, 2)}` : '';
  const currentClass = isCurrent ? ' asset-hierarchy-tab__node--current' : '';

  return (
    <>
      <button
        type="button"
        className={`asset-hierarchy-tab__node${levelClass}${currentClass}`}
        aria-label={ariaLabel}
        onClick={() => onNavigate(node.id)}
      >
        <span className="asset-hierarchy-tab__node-info">
          <span className="asset-hierarchy-tab__node-name">{node.name}</span>
          <span className="asset-hierarchy-tab__node-tag">{node.assetTag}</span>
        </span>
        <span className="asset-hierarchy-tab__node-right">
          <StatusChip status={node.status} />
          <span className="asset-hierarchy-tab__node-value">{valueStr}</span>
        </span>
      </button>
      {node.childAssets && node.childAssets.length > 0 && (
        <>
          {node.childAssets.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              isCurrent={false}
              onNavigate={onNavigate}
            />
          ))}
        </>
      )}
    </>
  );
}

// ─── AssetHierarchyTab ────────────────────────────────────────────────────

interface AssetHierarchyTabProps {
  asset: Asset;
  onNavigate: (assetId: string) => void;
}

export default function AssetHierarchyTab({ asset, onNavigate }: AssetHierarchyTabProps) {
  const hasParent = !!asset.parentAsset;
  const children = asset.childAssets ?? [];

  // Calculate total child value (sum of acquisitionValue of direct children)
  const totalChildValue = children.reduce((sum, child) => {
    const val = child.acquisitionValue ? parseFloat(child.acquisitionValue as string) : 0;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Build the root node for the tree view
  // If this asset has a parent, show parent at root level
  // If this asset has only children, show current as root

  return (
    <div className="asset-hierarchy-tab">
      <div className="asset-hierarchy-tab__header">
        <Layers size={20} aria-hidden="true" className="asset-hierarchy-tab__header-icon" />
        <h3 className="asset-hierarchy-tab__title">Hierarquia do ativo</h3>
      </div>

      <div className="asset-hierarchy-tab__tree" role="tree">
        {/* Parent node */}
        {hasParent && asset.parentAsset && (
          <button
            type="button"
            className="asset-hierarchy-tab__node asset-hierarchy-tab__node--parent"
            aria-label={`${asset.parentAsset.name} — ativo pai`}
            onClick={() => onNavigate(asset.parentAsset!.id)}
          >
            <span className="asset-hierarchy-tab__node-info">
              <span className="asset-hierarchy-tab__node-name">{asset.parentAsset.name}</span>
              <span className="asset-hierarchy-tab__node-tag">{asset.parentAsset.assetTag}</span>
            </span>
            <span className="asset-hierarchy-tab__node-right">
              <span className="asset-hierarchy-tab__node-parent-label">Ativo pai</span>
            </span>
          </button>
        )}

        {/* Current asset */}
        <button
          type="button"
          className={`asset-hierarchy-tab__node asset-hierarchy-tab__node--current${hasParent ? ' asset-hierarchy-tab__node--level-1' : ''}`}
          aria-label={`${asset.name} — ${formatBRL(asset.acquisitionValue)} (ativo atual)`}
          onClick={() => onNavigate(asset.id)}
        >
          <span className="asset-hierarchy-tab__node-info">
            <span className="asset-hierarchy-tab__node-name">{asset.name}</span>
            <span className="asset-hierarchy-tab__node-tag">{asset.assetTag}</span>
          </span>
          <span className="asset-hierarchy-tab__node-right">
            <StatusChip status={asset.status} />
            <span className="asset-hierarchy-tab__node-value">
              {formatBRL(asset.acquisitionValue)}
            </span>
          </span>
        </button>

        {/* Children */}
        {children.map((child) => (
          <TreeNode
            key={child.id}
            node={child as TreeNodeData}
            level={hasParent ? 2 : 1}
            isCurrent={false}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Total child value footer */}
      {children.length > 0 && (
        <div className="asset-hierarchy-tab__total">
          <span className="asset-hierarchy-tab__total-label">
            Total filhos ({children.length}):
          </span>
          <span className="asset-hierarchy-tab__total-value">
            {formatBRLNumber(totalChildValue)}
          </span>
        </div>
      )}
    </div>
  );
}
