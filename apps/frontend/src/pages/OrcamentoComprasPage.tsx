import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlusCircle,
  AlertCircle,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import {
  useBudgetExecution,
  useBudgetDeviations,
  createPurchaseBudget,
  updatePurchaseBudget,
  deletePurchaseBudget,
  CATEGORY_LABELS,
  type BudgetExecutionRow,
  type BudgetDeviation,
  type CreatePurchaseBudgetInput,
  type BudgetPeriodType,
} from '@/hooks/usePurchaseBudgets';
import { useFarmContext } from '@/stores/FarmContext';
import ConfirmModal from '@/components/ui/ConfirmModal';
import './OrcamentoComprasPage.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getProgressColor(percent: number): string {
  if (percent > 100) return 'var(--color-error-600)';
  if (percent >= 80) return '#F9A825';
  return 'var(--color-primary-600)';
}

function getProgressWidth(percent: number): string {
  return `${Math.min(percent, 100)}%`;
}

function getDefaultPeriodDates(type: BudgetPeriodType): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const mm = String(m).padStart(2, '0');

  switch (type) {
    case 'MENSAL': {
      const lastDay = new Date(y, m, 0).getDate();
      return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${lastDay}` };
    }
    case 'TRIMESTRAL': {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      const qEnd = qStart + 2;
      const lastDay = new Date(y, qEnd, 0).getDate();
      return {
        start: `${y}-${String(qStart).padStart(2, '0')}-01`,
        end: `${y}-${String(qEnd).padStart(2, '0')}-${lastDay}`,
      };
    }
    case 'SAFRA': {
      return { start: `${y}-07-01`, end: `${y + 1}-06-30` };
    }
    case 'ANUAL':
    default: {
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
  }
}

const PERIOD_TYPE_OPTIONS: Array<{ value: BudgetPeriodType; label: string }> = [
  { value: 'MENSAL', label: 'Mensal' },
  { value: 'TRIMESTRAL', label: 'Trimestral' },
  { value: 'SAFRA', label: 'Safra' },
  { value: 'ANUAL', label: 'Anual' },
];

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  const color = getProgressColor(percent);
  const width = getProgressWidth(percent);
  return (
    <div className="orcamento-compras-page__progress-track" title={`${percent.toFixed(1)}%`}>
      <div
        className="orcamento-compras-page__progress-fill"
        style={{ width, background: color }}
        aria-hidden="true"
      />
      <span className="orcamento-compras-page__progress-label" style={{ color }}>
        {percent.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Create Budget Modal ──────────────────────────────────────────────────────

interface CreateBudgetFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateBudgetForm({ onClose, onSuccess }: CreateBudgetFormProps) {
  const { farms } = useFarmContext();
  const [form, setForm] = useState<{
    category: string;
    periodType: BudgetPeriodType;
    periodStart: string;
    periodEnd: string;
    budgetedAmount: string;
    farmId: string;
  }>(() => {
    const dates = getDefaultPeriodDates('MENSAL');
    return {
      category: 'SEMENTE',
      periodType: 'MENSAL',
      periodStart: dates.start,
      periodEnd: dates.end,
      budgetedAmount: '',
      farmId: '',
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handlePeriodTypeChange(value: BudgetPeriodType) {
    const dates = getDefaultPeriodDates(value);
    setForm((f) => ({ ...f, periodType: value, periodStart: dates.start, periodEnd: dates.end }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.budgetedAmount || parseFloat(form.budgetedAmount) <= 0) {
      setError('Informe um valor orçado válido');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const input: CreatePurchaseBudgetInput = {
        category: form.category,
        periodType: form.periodType,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        budgetedAmount: parseFloat(form.budgetedAmount),
        farmId: form.farmId || undefined,
      };
      await createPurchaseBudget(input);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o orçamento');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="orcamento-compras-page__modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-budget-title"
    >
      <div className="orcamento-compras-page__modal">
        <div className="orcamento-compras-page__modal-header">
          <h2 id="create-budget-title" className="orcamento-compras-page__modal-title">
            Novo Orçamento
          </h2>
          <button
            type="button"
            className="orcamento-compras-page__modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="orcamento-compras-page__modal-body">
          <div className="orcamento-compras-page__form-group">
            <label htmlFor="budget-category">Categoria *</label>
            <select
              id="budget-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              required
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="orcamento-compras-page__form-group">
            <label htmlFor="budget-farm">Fazenda</label>
            <select
              id="budget-farm"
              value={form.farmId}
              onChange={(e) => setForm((f) => ({ ...f, farmId: e.target.value }))}
            >
              <option value="">Todas as fazendas</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </div>

          <div className="orcamento-compras-page__form-group">
            <label htmlFor="budget-period-type">Tipo de Período *</label>
            <select
              id="budget-period-type"
              value={form.periodType}
              onChange={(e) => handlePeriodTypeChange(e.target.value as BudgetPeriodType)}
              required
            >
              {PERIOD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="orcamento-compras-page__form-row">
            <div className="orcamento-compras-page__form-group">
              <label htmlFor="budget-start">Início *</label>
              <input
                id="budget-start"
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                required
              />
            </div>
            <div className="orcamento-compras-page__form-group">
              <label htmlFor="budget-end">Fim *</label>
              <input
                id="budget-end"
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="orcamento-compras-page__form-group">
            <label htmlFor="budget-amount">Valor Orçado (R$) *</label>
            <input
              id="budget-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={form.budgetedAmount}
              onChange={(e) => setForm((f) => ({ ...f, budgetedAmount: e.target.value }))}
              required
            />
          </div>

          {error && (
            <div className="orcamento-compras-page__form-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="orcamento-compras-page__modal-footer">
            <button
              type="button"
              className="orcamento-compras-page__btn orcamento-compras-page__btn--secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="orcamento-compras-page__btn orcamento-compras-page__btn--primary"
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : 'Salvar orçamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inline Edit Cell ─────────────────────────────────────────────────────────

interface InlineEditCellProps {
  value: number;
  budgetId: string;
  onSaved: () => void;
}

function InlineEditCell({ value, budgetId, onSaved }: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function save() {
    const parsed = parseFloat(editValue);
    if (isNaN(parsed) || parsed <= 0) {
      setEditing(false);
      setEditValue(String(value));
      return;
    }
    if (parsed === value) {
      setEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await updatePurchaseBudget(budgetId, { budgetedAmount: parsed });
      onSaved();
    } catch {
      // revert
    } finally {
      setIsSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <span className="orcamento-compras-page__inline-edit">
        <input
          ref={inputRef}
          type="number"
          min="0.01"
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') {
              setEditing(false);
              setEditValue(String(value));
            }
          }}
          disabled={isSaving}
          className="orcamento-compras-page__inline-input"
          aria-label="Editar valor orçado"
        />
        <button
          type="button"
          className="orcamento-compras-page__inline-btn"
          onClick={() => void save()}
          aria-label="Confirmar edição"
        >
          <Check size={14} aria-hidden="true" />
        </button>
      </span>
    );
  }

  return (
    <span className="orcamento-compras-page__editable-cell" title="Clique para editar">
      {formatBRL(value)}
      <button
        type="button"
        className="orcamento-compras-page__edit-icon-btn"
        onClick={() => setEditing(true)}
        aria-label="Editar valor orçado"
      >
        <Edit2 size={12} aria-hidden="true" />
      </button>
    </span>
  );
}

// ─── Execution Tab ────────────────────────────────────────────────────────────

interface ExecutionTabProps {
  execution: BudgetExecutionRow[];
  isLoading: boolean;
  onRefetch: () => void;
  onCreateNew: () => void;
}

function ExecutionTab({ execution, isLoading, onRefetch, onCreateNew }: ExecutionTabProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deletePurchaseBudget(deleteId);
      onRefetch();
    } catch {
      // ignore
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="orcamento-compras-page__table-wrapper">
        {[1, 2, 3].map((i) => (
          <div key={i} className="orcamento-compras-page__skeleton" />
        ))}
      </div>
    );
  }

  if (execution.length === 0) {
    return (
      <div className="orcamento-compras-page__empty">
        <TrendingUp size={48} className="orcamento-compras-page__empty-icon" aria-hidden="true" />
        <h3 className="orcamento-compras-page__empty-title">
          Nenhum orçamento definido para o período selecionado
        </h3>
        <p className="orcamento-compras-page__empty-desc">
          Defina orçamentos por categoria para acompanhar a execução orçamentária.
        </p>
        <button
          type="button"
          className="orcamento-compras-page__btn orcamento-compras-page__btn--primary"
          onClick={onCreateNew}
        >
          <PlusCircle size={16} aria-hidden="true" />
          Criar primeiro orçamento
        </button>
      </div>
    );
  }

  // Totals row
  const totals = execution.reduce(
    (acc, row) => ({
      budgetedAmount: acc.budgetedAmount + row.budgetedAmount,
      requisitado: acc.requisitado + row.requisitado,
      comprado: acc.comprado + row.comprado,
      pago: acc.pago + row.pago,
    }),
    { budgetedAmount: 0, requisitado: 0, comprado: 0, pago: 0 },
  );
  const totalPercent =
    totals.budgetedAmount > 0 ? (totals.comprado / totals.budgetedAmount) * 100 : 0;

  return (
    <>
      <div className="orcamento-compras-page__table-wrapper">
        <table className="orcamento-compras-page__table">
          <thead>
            <tr>
              <th scope="col">Categoria</th>
              <th scope="col">Fazenda</th>
              <th scope="col">Orçado</th>
              <th scope="col">Requisitado</th>
              <th scope="col">Comprado</th>
              <th scope="col">Pago</th>
              <th scope="col">% Utilizado</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {execution.map((row) => (
              <tr key={row.budgetId} className="orcamento-compras-page__table-row">
                <td data-label="Categoria">
                  {row.categoryLabel || CATEGORY_LABELS[row.category] || row.category}
                </td>
                <td data-label="Fazenda">{row.farmName || 'Todas'}</td>
                <td data-label="Orçado">
                  <InlineEditCell
                    value={row.budgetedAmount}
                    budgetId={row.budgetId}
                    onSaved={onRefetch}
                  />
                </td>
                <td data-label="Requisitado">{formatBRL(row.requisitado)}</td>
                <td data-label="Comprado">{formatBRL(row.comprado)}</td>
                <td data-label="Pago">{formatBRL(row.pago)}</td>
                <td data-label="% Utilizado">
                  <ProgressBar percent={row.percentUsed} />
                </td>
                <td data-label="Ações">
                  <button
                    type="button"
                    className="orcamento-compras-page__delete-btn"
                    onClick={() => setDeleteId(row.budgetId)}
                    aria-label={`Excluir orçamento de ${row.categoryLabel || row.category}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="orcamento-compras-page__totals-row">
              <td colSpan={2}>
                <strong>Total</strong>
              </td>
              <td>{formatBRL(totals.budgetedAmount)}</td>
              <td>{formatBRL(totals.requisitado)}</td>
              <td>{formatBRL(totals.comprado)}</td>
              <td>{formatBRL(totals.pago)}</td>
              <td>
                <ProgressBar percent={totalPercent} />
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="orcamento-compras-page__cards">
        {execution.map((row) => (
          <div key={row.budgetId} className="orcamento-compras-page__card">
            <div className="orcamento-compras-page__card-header">
              <span className="orcamento-compras-page__card-category">
                {row.categoryLabel || CATEGORY_LABELS[row.category] || row.category}
              </span>
              <button
                type="button"
                className="orcamento-compras-page__delete-btn"
                onClick={() => setDeleteId(row.budgetId)}
                aria-label={`Excluir orçamento de ${row.categoryLabel || row.category}`}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
            {row.farmName && (
              <div className="orcamento-compras-page__card-farm">{row.farmName}</div>
            )}
            <div className="orcamento-compras-page__card-values">
              <div>
                <span className="orcamento-compras-page__card-label">Orçado</span>
                <span>{formatBRL(row.budgetedAmount)}</span>
              </div>
              <div>
                <span className="orcamento-compras-page__card-label">Comprado</span>
                <span>{formatBRL(row.comprado)}</span>
              </div>
            </div>
            <ProgressBar percent={row.percentUsed} />
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir orçamento"
        message="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}

// ─── Deviations Tab ───────────────────────────────────────────────────────────

interface DeviationsTabProps {
  deviations: BudgetDeviation[];
  isLoading: boolean;
}

function DeviationsTab({ deviations, isLoading }: DeviationsTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="orcamento-compras-page__table-wrapper">
        {[1, 2].map((i) => (
          <div key={i} className="orcamento-compras-page__skeleton" />
        ))}
      </div>
    );
  }

  if (deviations.length === 0) {
    return (
      <div className="orcamento-compras-page__empty">
        <TrendingUp size={48} className="orcamento-compras-page__empty-icon" aria-hidden="true" />
        <h3 className="orcamento-compras-page__empty-title">Nenhum desvio orçamentário</h3>
        <p className="orcamento-compras-page__empty-desc">
          Todas as categorias estão dentro do orçamento definido.
        </p>
      </div>
    );
  }

  return (
    <div className="orcamento-compras-page__table-wrapper">
      <table className="orcamento-compras-page__table">
        <thead>
          <tr>
            <th scope="col" style={{ width: 32 }} />
            <th scope="col">Categoria</th>
            <th scope="col">Orçado</th>
            <th scope="col">Comprado</th>
            <th scope="col">Excedente</th>
            <th scope="col">% Excedido</th>
          </tr>
        </thead>
        <tbody>
          {deviations.map((row) => (
            <>
              <tr
                key={row.budgetId}
                className="orcamento-compras-page__deviation-row"
                onClick={() => toggleRow(row.budgetId)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  {expanded.has(row.budgetId) ? (
                    <ChevronDown size={16} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={16} aria-hidden="true" />
                  )}
                </td>
                <td data-label="Categoria">
                  {row.categoryLabel || CATEGORY_LABELS[row.category] || row.category}
                </td>
                <td data-label="Orçado">{formatBRL(row.budgetedAmount)}</td>
                <td data-label="Comprado">{formatBRL(row.comprado)}</td>
                <td data-label="Excedente" className="orcamento-compras-page__excedente">
                  {formatBRL(row.excedente)}
                </td>
                <td data-label="% Excedido">
                  <span className="orcamento-compras-page__pct-badge">
                    {row.percentExcedido.toFixed(1)}%
                  </span>
                </td>
              </tr>
              {expanded.has(row.budgetId) && row.contributions && row.contributions.length > 0 && (
                <tr
                  key={`${row.budgetId}-contributions`}
                  className="orcamento-compras-page__contributions-row"
                >
                  <td colSpan={6}>
                    <table className="orcamento-compras-page__contributions-table">
                      <thead>
                        <tr>
                          <th scope="col">Tipo</th>
                          <th scope="col">Número</th>
                          <th scope="col">Data</th>
                          <th scope="col">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.contributions.map((c) => (
                          <tr key={c.id}>
                            <td>{c.type === 'RC' ? 'Requisição' : 'Pedido'}</td>
                            <td>{c.number}</td>
                            <td>{new Date(c.date).toLocaleDateString('pt-BR')}</td>
                            <td>{formatBRL(c.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'execucao' | 'desvios';

export default function OrcamentoComprasPage() {
  const { farms } = useFarmContext();
  const [activeTab, setActiveTab] = useState<TabKey>('execucao');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [farmId, setFarmId] = useState('');
  const [periodType, setPeriodType] = useState('MENSAL');
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
  });

  const executionFilters = {
    farmId: farmId || undefined,
    periodStart: periodStart || undefined,
    periodEnd: periodEnd || undefined,
  };

  const {
    execution,
    isLoading: executionLoading,
    refetch: refetchExecution,
  } = useBudgetExecution(executionFilters);
  const {
    deviations,
    isLoading: deviationsLoading,
    refetch: refetchDeviations,
  } = useBudgetDeviations(executionFilters);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  function handlePeriodTypeChange(value: string) {
    setPeriodType(value);
    const dates = getDefaultPeriodDates(value as BudgetPeriodType);
    setPeriodStart(dates.start);
    setPeriodEnd(dates.end);
  }

  function handleCreateSuccess() {
    setShowCreateModal(false);
    showToast('Orçamento criado com sucesso');
    refetchExecution();
    refetchDeviations();
  }

  return (
    <main className="orcamento-compras-page" id="main-content">
      <header className="orcamento-compras-page__header">
        <div className="orcamento-compras-page__header-left">
          <h1 className="orcamento-compras-page__title">
            <TrendingUp size={24} aria-hidden="true" />
            Orçamento de Compras
          </h1>
          <p className="orcamento-compras-page__subtitle">
            Acompanhe a execução orçamentária por categoria
          </p>
        </div>
        <button
          type="button"
          className="orcamento-compras-page__btn orcamento-compras-page__btn--primary"
          onClick={() => setShowCreateModal(true)}
        >
          <PlusCircle size={16} aria-hidden="true" />
          Novo Orçamento
        </button>
      </header>

      {/* Filters */}
      <div className="orcamento-compras-page__filters" role="search" aria-label="Filtros">
        <div className="orcamento-compras-page__filter-group">
          <label htmlFor="filter-farm">Fazenda</label>
          <select id="filter-farm" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
            <option value="">Todas as fazendas</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
        </div>

        <div className="orcamento-compras-page__filter-group">
          <label htmlFor="filter-period-type">Tipo de período</label>
          <select
            id="filter-period-type"
            value={periodType}
            onChange={(e) => handlePeriodTypeChange(e.target.value)}
          >
            {PERIOD_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="orcamento-compras-page__filter-group">
          <label htmlFor="filter-period-start">Início</label>
          <input
            id="filter-period-start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </div>

        <div className="orcamento-compras-page__filter-group">
          <label htmlFor="filter-period-end">Fim</label>
          <input
            id="filter-period-end"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="orcamento-compras-page__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`orcamento-compras-page__tab ${activeTab === 'execucao' ? 'orcamento-compras-page__tab--active' : ''}`}
          aria-selected={activeTab === 'execucao'}
          onClick={() => setActiveTab('execucao')}
        >
          Execução Orçamentária
        </button>
        <button
          type="button"
          role="tab"
          className={`orcamento-compras-page__tab ${activeTab === 'desvios' ? 'orcamento-compras-page__tab--active' : ''}`}
          aria-selected={activeTab === 'desvios'}
          onClick={() => setActiveTab('desvios')}
        >
          Desvios
          {deviations.length > 0 && (
            <span className="orcamento-compras-page__tab-badge">{deviations.length}</span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'execucao' && (
        <ExecutionTab
          execution={execution}
          isLoading={executionLoading}
          onRefetch={refetchExecution}
          onCreateNew={() => setShowCreateModal(true)}
        />
      )}

      {activeTab === 'desvios' && (
        <DeviationsTab deviations={deviations} isLoading={deviationsLoading} />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateBudgetForm
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="orcamento-compras-page__toast">
          {toast}
        </div>
      )}
    </main>
  );
}
