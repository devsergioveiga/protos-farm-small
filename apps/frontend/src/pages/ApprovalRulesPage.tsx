import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings2,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronRight,
  UserCheck,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react';
import { useApprovalRules } from '@/hooks/useApprovalRules';
import type { ApprovalRule, CreateApprovalRuleInput } from '@/hooks/useApprovalRules';
import { useAuth } from '@/stores/AuthContext';
import ApprovalRuleModal from '@/components/approval-rules/ApprovalRuleModal';
import DelegationModal from '@/components/approval-rules/DelegationModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import './ApprovalRulesPage.css';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ApprovalRulesPage() {
  const { user } = useAuth();
  const {
    rules,
    delegations,
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    reorderRules,
    createDelegation,
    deactivateDelegation,
  } = useApprovalRules();

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [isDeletingRule, setIsDeletingRule] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Check if current user has an active delegation
  const activeDelegation = delegations.find((d) => d.isActive && d.delegatorId === user?.id);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSaveRule(input: CreateApprovalRuleInput) {
    if (editingRule) {
      await updateRule(editingRule.id, input);
      showToast('Regra atualizada com sucesso.');
    } else {
      await createRule(input);
      showToast('Regra criada com sucesso.');
    }
  }

  async function handleToggleActive(rule: ApprovalRule) {
    await updateRule(rule.id, { isActive: !rule.isActive });
    showToast(rule.isActive ? 'Regra desativada.' : 'Regra ativada.');
  }

  async function handleDelete() {
    if (!deleteRuleId) return;
    setIsDeletingRule(true);
    try {
      await deleteRule(deleteRuleId);
      showToast('Regra excluida com sucesso.');
    } finally {
      setIsDeletingRule(false);
      setDeleteRuleId(null);
    }
  }

  // Drag-and-drop reorder (simple HTML5)
  function handleDragStart(id: string) {
    setDraggedId(id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
  }

  async function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const fromIdx = sorted.findIndex((r) => r.id === draggedId);
    const toIdx = sorted.findIndex((r) => r.id === targetId);
    const reordered = [...sorted];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setDraggedId(null);
    await reorderRules(reordered.map((r) => r.id));
    showToast('Ordem das regras atualizada.');
  }

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <main className="arp-page">
      {/* Toast */}
      {toast && (
        <div className="arp-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="arp-breadcrumb">
        <Link to="/dashboard" className="arp-breadcrumb__link">
          Inicio
        </Link>
        <span aria-hidden="true" className="arp-breadcrumb__sep">
          /
        </span>
        <span>Compras</span>
        <span aria-hidden="true" className="arp-breadcrumb__sep">
          /
        </span>
        <span aria-current="page">Alcadas</span>
      </nav>

      {/* Page header */}
      <header className="arp-page__header">
        <h1 className="arp-page__title">Regras de Alcada</h1>
        <div className="arp-page__actions">
          <button
            type="button"
            className="arp-btn arp-btn--secondary"
            onClick={() => setShowDelegationModal(true)}
          >
            <UserCheck size={16} aria-hidden="true" />
            Configurar Delegacao
          </button>
          <button
            type="button"
            className="arp-btn arp-btn--primary"
            onClick={() => {
              setEditingRule(null);
              setShowRuleModal(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Nova Regra de Alcada
          </button>
        </div>
      </header>

      {/* Active delegation banner */}
      {activeDelegation && (
        <div className="arp-delegation-banner" role="status">
          <UserCheck size={16} aria-hidden="true" />
          <span>
            <strong>Delegacao ativa:</strong> suas aprovacoes estao sendo encaminhadas para{' '}
            <strong>{activeDelegation.delegate.name}</strong> ate{' '}
            {new Date(activeDelegation.endDate).toLocaleDateString('pt-BR')}
          </span>
          <button
            type="button"
            className="arp-btn arp-btn--ghost arp-btn--sm"
            onClick={() => setShowDelegationModal(true)}
          >
            Gerenciar
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="arp-error-banner" role="alert">
          Nao foi possivel carregar as regras. {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="arp-loading" aria-label="Carregando regras de alcada">
          <Loader2 size={24} className="arp-spin" aria-hidden="true" />
          <span>Carregando...</span>
        </div>
      )}

      {/* Rules list */}
      {!isLoading && !error && sortedRules.length === 0 && (
        <div className="arp-empty-state">
          <Settings2 size={48} aria-hidden="true" className="arp-empty-state__icon" />
          <h2 className="arp-empty-state__title">Nenhuma regra configurada</h2>
          <p className="arp-empty-state__body">
            Configure as alcadas para que as requisicoes de compra sejam direcionadas ao aprovador
            correto.
          </p>
          <button
            type="button"
            className="arp-btn arp-btn--primary"
            onClick={() => {
              setEditingRule(null);
              setShowRuleModal(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Nova Regra de Alcada
          </button>
        </div>
      )}

      {!isLoading && sortedRules.length > 0 && (
        <ol className="arp-rules-list" aria-label="Regras de alcada por prioridade">
          {sortedRules.map((rule) => (
            <li
              key={rule.id}
              className={`arp-rule-card${draggedId === rule.id ? ' arp-rule-card--dragging' : ''}${!rule.isActive ? ' arp-rule-card--inactive' : ''}`}
              draggable
              onDragStart={() => handleDragStart(rule.id)}
              onDragOver={(e) => handleDragOver(e, rule.id)}
              onDrop={() => handleDrop(rule.id)}
            >
              {/* Drag handle */}
              <div
                className="arp-rule-card__drag-handle"
                aria-hidden="true"
                title="Arrastar para reordenar"
              >
                <GripVertical size={20} />
              </div>

              {/* Priority badge */}
              <div className="arp-rule-card__priority" aria-label={`Prioridade ${rule.priority}`}>
                {rule.priority}
              </div>

              {/* Main content */}
              <div className="arp-rule-card__content">
                <div className="arp-rule-card__top">
                  <h3 className="arp-rule-card__name">{rule.name}</h3>
                  {!rule.isActive && (
                    <span className="arp-rule-badge arp-rule-badge--inactive">Inativa</span>
                  )}
                </div>

                <dl className="arp-rule-card__meta">
                  <div className="arp-rule-meta-item">
                    <dt className="arp-rule-meta-item__label">Tipo</dt>
                    <dd className="arp-rule-meta-item__value">
                      {rule.requestType ?? 'Todos os tipos'}
                    </dd>
                  </div>

                  <div className="arp-rule-meta-item">
                    <dt className="arp-rule-meta-item__label">Faixa de valor</dt>
                    <dd className="arp-rule-meta-item__value arp-rule-meta-item__value--mono">
                      {formatCurrency(rule.minValue)} –{' '}
                      {rule.maxValue != null ? formatCurrency(rule.maxValue) : 'sem limite'}
                    </dd>
                  </div>

                  <div className="arp-rule-meta-item arp-rule-meta-item--approvers">
                    <dt className="arp-rule-meta-item__label">Aprovadores</dt>
                    <dd className="arp-rule-card__approver-chain">
                      <span className="arp-approver-chip">{rule.approver1.name}</span>
                      {rule.approver2 && (
                        <>
                          <ChevronRight
                            size={14}
                            aria-hidden="true"
                            className="arp-approver-arrow"
                          />
                          <span className="arp-approver-chip">{rule.approver2.name}</span>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Actions */}
              <div className="arp-rule-card__actions">
                <button
                  type="button"
                  className="arp-icon-btn"
                  onClick={() => handleToggleActive(rule)}
                  aria-label={
                    rule.isActive ? `Desativar regra ${rule.name}` : `Ativar regra ${rule.name}`
                  }
                  title={rule.isActive ? 'Desativar' : 'Ativar'}
                >
                  {rule.isActive ? (
                    <ToggleRight
                      size={20}
                      aria-hidden="true"
                      className="arp-icon-btn__icon--active"
                    />
                  ) : (
                    <ToggleLeft size={20} aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  className="arp-icon-btn"
                  onClick={() => {
                    setEditingRule(rule);
                    setShowRuleModal(true);
                  }}
                  aria-label={`Editar regra ${rule.name}`}
                  title="Editar"
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="arp-icon-btn arp-icon-btn--danger"
                  onClick={() => setDeleteRuleId(rule.id)}
                  aria-label={`Excluir regra ${rule.name}`}
                  title="Excluir"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Modals */}
      <ApprovalRuleModal
        isOpen={showRuleModal}
        rule={editingRule}
        existingRules={rules}
        onClose={() => {
          setShowRuleModal(false);
          setEditingRule(null);
        }}
        onSave={handleSaveRule}
      />

      <DelegationModal
        isOpen={showDelegationModal}
        delegations={delegations}
        onClose={() => setShowDelegationModal(false)}
        onCreate={createDelegation}
        onDeactivate={deactivateDelegation}
      />

      <ConfirmModal
        isOpen={deleteRuleId != null}
        title="Excluir esta regra?"
        message="As requisicoes pendentes que dependiam desta regra precisarao ser reavaliadas. Essa acao nao pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeletingRule}
        onConfirm={handleDelete}
        onCancel={() => setDeleteRuleId(null)}
      />
    </main>
  );
}
