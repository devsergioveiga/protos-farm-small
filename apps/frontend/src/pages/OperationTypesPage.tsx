import { useState, useCallback } from 'react';
import {
  FolderTree,
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Power,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { useOperationTypeTree } from '@/hooks/useOperationTypes';
import PermissionGate from '@/components/auth/PermissionGate';
import OperationTypeModal from '@/components/operation-types/OperationTypeModal';
import { api } from '@/services/api';
import type { OperationTypeItem, OperationTypeTreeNode } from '@/types/operation-type';
import './OperationTypesPage.css';

// ─── Tree Node ──────────────────────────────────────────────────────

interface TreeNodeProps {
  node: OperationTypeTreeNode;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (item: OperationTypeItem, parentName: string | null, parentCrops: string[]) => void;
  onAddChild: (parentId: string, parentName: string, parentCrops: string[]) => void;
  onDelete: (item: OperationTypeItem) => void;
  onToggleActive: (item: OperationTypeItem) => void;
  parentName?: string | null;
  parentCrops?: string[];
}

function TreeNode({
  node,
  expandedIds,
  onToggleExpand,
  onEdit,
  onAddChild,
  onDelete,
  onToggleActive,
  parentName = null,
  parentCrops = [],
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const isLeaf = node.level === 3 || (!hasChildren && node.childCount === 0);
  const canAddChild = node.level < 3;

  return (
    <li
      className="optype-tree__item"
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
    >
      <div
        className={`optype-tree__row optype-tree__row--level-${node.level}${!node.isActive ? ' optype-tree__row--inactive' : ''}`}
      >
        <button
          type="button"
          className="optype-tree__toggle"
          onClick={() => onToggleExpand(node.id)}
          aria-label={isExpanded ? 'Recolher' : 'Expandir'}
          disabled={isLeaf}
        >
          {isLeaf ? (
            <span className="optype-tree__leaf-dot" aria-hidden="true" />
          ) : isExpanded ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
        </button>

        <div className="optype-tree__info">
          <span className="optype-tree__name">{node.name}</span>
          {node.crops.length > 0 && (
            <span className="optype-tree__crops">{node.crops.join(', ')}</span>
          )}
          {node.description && <span className="optype-tree__desc">{node.description}</span>}
          {!node.isActive && (
            <span className="optype-tree__badge optype-tree__badge--inactive">Inativo</span>
          )}
          {node.childCount > 0 && (
            <span className="optype-tree__badge optype-tree__badge--count">{node.childCount}</span>
          )}
        </div>

        <PermissionGate permission="farms:update">
          <div className="optype-tree__actions">
            {canAddChild && (
              <button
                type="button"
                className="optype-tree__action-btn"
                onClick={() => onAddChild(node.id, node.name, node.crops)}
                aria-label={`Adicionar sub-operação em ${node.name}`}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="optype-tree__action-btn"
              onClick={() => onEdit(node, parentName, parentCrops)}
              aria-label={`Editar ${node.name}`}
            >
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="optype-tree__action-btn"
              onClick={() => onToggleActive(node)}
              aria-label={node.isActive ? `Desativar ${node.name}` : `Ativar ${node.name}`}
            >
              <Power size={16} aria-hidden="true" />
            </button>
            {node.childCount === 0 && (
              <button
                type="button"
                className="optype-tree__action-btn optype-tree__action-btn--danger"
                onClick={() => onDelete(node)}
                aria-label={`Excluir ${node.name}`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </PermissionGate>
      </div>

      {hasChildren && isExpanded && (
        <ul className="optype-tree__children" role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              parentName={node.name}
              parentCrops={node.crops}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

function OperationTypesPage() {
  const [showInactive, setShowInactive] = useState(false);
  const { tree, isLoading, error, refetch } = useOperationTypeTree({
    includeInactive: showInactive,
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<OperationTypeItem | null>(null);
  const [modalParentId, setModalParentId] = useState<string | null>(null);
  const [modalParentName, setModalParentName] = useState<string | null>(null);
  const [modalParentCrops, setModalParentCrops] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<OperationTypeItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allIds = new Set<string>();
    function collect(nodes: OperationTypeTreeNode[]) {
      for (const n of nodes) {
        allIds.add(n.id);
        collect(n.children);
      }
    }
    collect(tree);
    setExpandedIds(allIds);
  }, [tree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const handleNewRoot = useCallback(() => {
    setEditingItem(null);
    setModalParentId(null);
    setModalParentName(null);
    setModalParentCrops([]);
    setShowModal(true);
  }, []);

  const handleAddChild = useCallback(
    (parentId: string, parentName: string, parentCrops: string[]) => {
      setEditingItem(null);
      setModalParentId(parentId);
      setModalParentName(parentName);
      setModalParentCrops(parentCrops);
      setShowModal(true);
    },
    [],
  );

  const handleEdit = useCallback(
    (item: OperationTypeItem, parentName: string | null, parentCrops: string[]) => {
      setEditingItem(item);
      setModalParentId(item.parentId);
      setModalParentName(parentName);
      setModalParentCrops(parentCrops);
      setShowModal(true);
    },
    [],
  );

  const handleModalSuccess = useCallback(() => {
    setShowModal(false);
    setEditingItem(null);
    void refetch();
  }, [refetch]);

  const handleToggleActive = useCallback(
    async (item: OperationTypeItem) => {
      setActionError(null);
      try {
        await api.patch(`/org/operation-types/${item.id}/toggle-active`);
        void refetch();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao alterar status');
      }
    },
    [refetch],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    setActionError(null);
    try {
      await api.delete(`/org/operation-types/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      void refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao excluir');
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, refetch]);

  const totalCount = tree.reduce(function countAll(acc: number, n: OperationTypeTreeNode): number {
    return n.children.reduce(countAll, acc + 1);
  }, 0);

  return (
    <main className="optype-page">
      <div className="optype-page__header">
        <div className="optype-page__title-row">
          <FolderTree size={24} aria-hidden="true" className="optype-page__icon" />
          <h1 className="optype-page__title">Tipos de operação</h1>
          <span className="optype-page__count">{totalCount}</span>
        </div>

        <div className="optype-page__toolbar">
          <label className="optype-page__toggle-label">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inativos
          </label>

          <div className="optype-page__toolbar-btns">
            <button
              type="button"
              className="optype-page__btn optype-page__btn--ghost"
              onClick={handleExpandAll}
            >
              Expandir tudo
            </button>
            <button
              type="button"
              className="optype-page__btn optype-page__btn--ghost"
              onClick={handleCollapseAll}
            >
              Recolher tudo
            </button>

            <PermissionGate permission="farms:update">
              <button
                type="button"
                className="optype-page__btn optype-page__btn--primary"
                onClick={handleNewRoot}
              >
                <Plus size={20} aria-hidden="true" />
                Nova categoria
              </button>
            </PermissionGate>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="optype-page__alert optype-page__alert--error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {actionError}
        </div>
      )}

      {error && (
        <div className="optype-page__alert optype-page__alert--error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="optype-page__skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="optype-page__skeleton-row" />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="optype-page__empty">
          <Layers size={48} aria-hidden="true" className="optype-page__empty-icon" />
          <h2 className="optype-page__empty-title">Nenhum tipo de operação cadastrado</h2>
          <p className="optype-page__empty-desc">
            Cadastre as categorias de operação (Preparo de Solo, Plantio, Tratos Culturais, etc.)
            para organizar os registros de campo.
          </p>
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="optype-page__btn optype-page__btn--primary"
              onClick={handleNewRoot}
            >
              <Plus size={20} aria-hidden="true" />
              Criar primeira categoria
            </button>
          </PermissionGate>
        </div>
      ) : (
        <ul className="optype-tree" role="tree" aria-label="Tipos de operação">
          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              expandedIds={expandedIds}
              onToggleExpand={handleToggleExpand}
              onEdit={handleEdit}
              onAddChild={handleAddChild}
              onDelete={setDeleteConfirm}
              onToggleActive={handleToggleActive}
            />
          ))}
        </ul>
      )}

      <OperationTypeModal
        isOpen={showModal}
        operationType={editingItem}
        parentId={modalParentId}
        parentName={modalParentName}
        parentCrops={modalParentCrops}
        onClose={() => setShowModal(false)}
        onSuccess={handleModalSuccess}
      />

      {deleteConfirm && (
        <div
          className="optype-modal__overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmar exclusão"
        >
          <div className="optype-confirm">
            <h3 className="optype-confirm__title">Excluir &ldquo;{deleteConfirm.name}&rdquo;?</h3>
            <p className="optype-confirm__text">
              Esta ação não pode ser desfeita. O tipo de operação será removido da lista.
            </p>
            <div className="optype-confirm__actions">
              <button
                type="button"
                className="optype-modal__btn optype-modal__btn--secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="optype-confirm__delete-btn"
                onClick={handleDeleteConfirm}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default OperationTypesPage;
