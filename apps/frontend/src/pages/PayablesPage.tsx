import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Plus,
  AlertCircle,
  FileText,
  MoreVertical,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Banknote,
  CalendarDays,
  Receipt,
} from 'lucide-react';
import { usePayables, usePayablesAging, usePayableCalendar } from '@/hooks/usePayables';
import type {
  Payable,
  PayableStatus,
  PayableCategory,
  AgingBucket,
  CalendarDay,
} from '@/hooks/usePayables';
import { useFarms } from '@/hooks/useFarms';
import PayableModal from '@/components/payables/PayableModal';
import PaymentModal from '@/components/payables/PaymentModal';
import BatchPaymentModal from '@/components/payables/BatchPaymentModal';
import CnabRetornoModal from '@/components/payables/CnabRetornoModal';
import { api } from '@/services/api';
import './PayablesPage.css';

// ─── Constants ────────────────────────────────────────────────────

const STATUS_LABELS: Record<PayableStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado',
  PARTIAL: 'Parcial',
};

const CATEGORY_LABELS: Record<PayableCategory, string> = {
  SUPPLIER: 'Fornecedor',
  EMPLOYEE: 'Funcionário',
  TAXES: 'Impostos',
  UTILITIES: 'Serviços básicos',
  MAINTENANCE: 'Manutenção',
  FUEL: 'Combustível',
  FEED: 'Ração/Alimentação',
  VETERINARY: 'Veterinário',
  AGROCHEMICAL: 'Defensivo',
  FERTILIZER: 'Fertilizante',
  SEED: 'Semente',
  EQUIPMENT: 'Equipamento',
  FINANCE: 'Financeiro',
  ASSET_ACQUISITION: 'Aquisicao de Ativo',
  OTHER: 'Outros',
};

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ─── Status badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: PayableStatus }) {
  const icons: Record<PayableStatus, React.ElementType> = {
    PENDING: Clock,
    PAID: CheckCircle2,
    OVERDUE: AlertCircle,
    CANCELLED: XCircle,
    PARTIAL: Clock,
  };
  const Icon = icons[status];
  return (
    <span className={`cp-page__status-badge cp-page__status-badge--${status.toLowerCase()}`}>
      <Icon size={12} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="cp-page__skeleton-row" aria-hidden="true">
      <td>
        <div className="cp-page__skeleton-cell" style={{ width: 18, height: 18 }} />
      </td>
      <td>
        <div className="cp-page__skeleton-cell" style={{ width: '80%' }} />
      </td>
      <td>
        <div className="cp-page__skeleton-cell" style={{ width: '60%' }} />
      </td>
      <td>
        <div className="cp-page__skeleton-cell" style={{ width: '70%' }} />
      </td>
      <td>
        <div className="cp-page__skeleton-cell" style={{ width: '50%' }} />
      </td>
      <td>
        <div className="cp-page__skeleton-cell" style={{ width: '40%' }} />
      </td>
      <td>
        <div className="cp-page__skeleton-cell" style={{ width: '60%' }} />
      </td>
      <td>
        <div className="cp-page__skeleton-cell" style={{ width: 32, height: 32 }} />
      </td>
    </tr>
  );
}

// ─── Row actions dropdown ─────────────────────────────────────────

interface RowActionsProps {
  payable: Payable;
  onEdit: () => void;
  onPay: () => void;
  onReverse: () => void;
  onDelete: () => void;
}

function RowActions({ payable, onEdit, onPay, onReverse, onDelete }: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const canPay =
    payable.status === 'PENDING' || payable.status === 'OVERDUE' || payable.status === 'PARTIAL';
  const canReverse = payable.status === 'PAID' || payable.status === 'PARTIAL';

  return (
    <div className="cp-page__row-actions" ref={ref}>
      <button
        type="button"
        className="cp-page__row-actions-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Ações para ${payable.supplierName}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="cp-page__row-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="cp-page__row-dropdown-item"
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
          >
            <FileText size={14} aria-hidden="true" />
            Editar
          </button>
          {canPay && (
            <button
              type="button"
              role="menuitem"
              className="cp-page__row-dropdown-item"
              onClick={() => {
                onPay();
                setOpen(false);
              }}
            >
              <CreditCard size={14} aria-hidden="true" />
              Dar baixa
            </button>
          )}
          {canReverse && (
            <button
              type="button"
              role="menuitem"
              className="cp-page__row-dropdown-item"
              onClick={() => {
                onReverse();
                setOpen(false);
              }}
            >
              <Banknote size={14} aria-hidden="true" />
              Estornar
            </button>
          )}
          <div className="cp-page__row-dropdown-divider" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            className="cp-page__row-dropdown-item cp-page__row-dropdown-item--danger"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          >
            <XCircle size={14} aria-hidden="true" />
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Aging tab ────────────────────────────────────────────────────

interface AgingTabProps {
  farmId?: string;
  onBucketClick: (bucket: string) => void;
}

function AgingTab({ farmId, onBucketClick }: AgingTabProps) {
  const { aging, loading, error } = usePayablesAging(farmId);

  if (loading) {
    return (
      <div className="cp-page__aging-table-wrap" aria-busy="true">
        <table className="cp-page__aging-table">
          <thead>
            <tr>
              <th scope="col">Faixa</th>
              <th scope="col" className="cp-page__col-right">
                Qtd
              </th>
              <th scope="col" className="cp-page__col-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <tr key={i} aria-hidden="true">
                <td>
                  <div className="cp-page__skeleton-cell" style={{ width: '60%' }} />
                </td>
                <td>
                  <div className="cp-page__skeleton-cell" style={{ width: '40%' }} />
                </td>
                <td>
                  <div className="cp-page__skeleton-cell" style={{ width: '70%' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-page__error" role="alert">
        <AlertCircle size={20} aria-hidden="true" />
        {error}
      </div>
    );
  }

  if (!aging) return null;

  return (
    <>
      {aging.overdueCount > 0 && (
        <div className="cp-page__aging-summary" role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <span>
            <strong>{aging.overdueCount}</strong>{' '}
            {aging.overdueCount === 1 ? 'título vencido' : 'títulos vencidos'} totalizando{' '}
            <strong>{formatBRL(aging.overdueTotal)}</strong>
          </span>
        </div>
      )}
      <div className="cp-page__aging-table-wrap">
        <table className="cp-page__aging-table">
          <caption className="sr-only">
            Tabela de aging de contas a pagar por faixa de vencimento
          </caption>
          <thead>
            <tr>
              <th scope="col">Faixa</th>
              <th scope="col" className="cp-page__col-right">
                Qtd
              </th>
              <th scope="col" className="cp-page__col-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {aging.buckets.map((b: AgingBucket) => (
              <tr
                key={b.bucket}
                className={`cp-page__aging-row${b.bucket === 'OVERDUE' ? ' cp-page__aging-row--overdue' : ''}`}
                onClick={() => onBucketClick(b.bucket)}
                tabIndex={0}
                role="button"
                aria-label={`Filtrar por ${b.label}: ${b.count} títulos, ${formatBRL(b.total)}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onBucketClick(b.bucket);
                }}
              >
                <td>{b.label}</td>
                <td className="cp-page__col-right">{b.count}</td>
                <td className={`cp-page__col-right cp-page__aging-amount`}>{formatBRL(b.total)}</td>
              </tr>
            ))}
            <tr className="cp-page__aging-row--total">
              <td>Total</td>
              <td className="cp-page__col-right">{aging.grandCount}</td>
              <td className={`cp-page__col-right cp-page__aging-amount`}>
                {formatBRL(aging.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Calendar tab ─────────────────────────────────────────────────

interface CalendarTabProps {
  farmId?: string;
}

function CalendarTab({ farmId }: CalendarTabProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
  const [openDay, setOpenDay] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { days, loading } = usePayableCalendar(year, month, farmId);

  // Close popover on outside click
  useEffect(() => {
    if (openDay === null) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenDay(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDay]);

  const prevMonth = useCallback(() => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setOpenDay(null);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setOpenDay(null);
  }, [month]);

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Map days data by day number
  const dayMap = new Map<number, CalendarDay>();
  days.forEach((d) => dayMap.set(d.day, d));

  // Build grid cells (blanks + days)
  const cells: Array<{ type: 'blank' } | { type: 'day'; dayNum: number }> = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'blank' });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: 'day', dayNum: d });

  const isToday = (dayNum: number) =>
    year === today.getFullYear() && month === today.getMonth() + 1 && dayNum === today.getDate();

  return (
    <>
      <div className="cp-page__calendar-header">
        <button
          type="button"
          className="cp-page__calendar-nav-btn"
          onClick={prevMonth}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="cp-page__calendar-month-label">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button
          type="button"
          className="cp-page__calendar-nav-btn"
          onClick={nextMonth}
          aria-label="Próximo mês"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="cp-page__aging-table-wrap" style={{ padding: 32, textAlign: 'center' }}>
          <span
            className="cp-page__skeleton-cell"
            style={{ width: '40%', display: 'inline-block' }}
          />
        </div>
      ) : (
        <div
          className="cp-page__calendar-grid"
          aria-label={`Calendário de vencimentos: ${MONTH_NAMES[month - 1]} ${year}`}
        >
          <div className="cp-page__calendar-weekdays" aria-hidden="true">
            {WEEKDAY_LABELS.map((wl) => (
              <div key={wl} className="cp-page__calendar-weekday">
                {wl}
              </div>
            ))}
          </div>
          <div className="cp-page__calendar-days">
            {cells.map((cell, idx) => {
              if (cell.type === 'blank') {
                return (
                  <div
                    key={`blank-${idx}`}
                    className="cp-page__calendar-day cp-page__calendar-day--empty"
                    aria-hidden="true"
                  />
                );
              }
              const { dayNum } = cell;
              const dayData = dayMap.get(dayNum);
              const hasPayables = dayData && dayData.count > 0;

              return (
                <div
                  key={dayNum}
                  className={[
                    'cp-page__calendar-day',
                    hasPayables ? 'cp-page__calendar-day--has-payables' : '',
                    isToday(dayNum) ? 'cp-page__calendar-day--today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => hasPayables && setOpenDay(openDay === dayNum ? null : dayNum)}
                  role={hasPayables ? 'button' : undefined}
                  tabIndex={hasPayables ? 0 : undefined}
                  aria-label={
                    hasPayables
                      ? `Dia ${dayNum}: ${dayData.count} vencimento${dayData.count > 1 ? 's' : ''}, total ${formatBRL(dayData.total)}`
                      : `Dia ${dayNum}`
                  }
                  onKeyDown={(e) => {
                    if (hasPayables && (e.key === 'Enter' || e.key === ' ')) {
                      setOpenDay(openDay === dayNum ? null : dayNum);
                    }
                  }}
                  style={{ position: 'relative' }}
                >
                  <span className="cp-page__calendar-day-num">{dayNum}</span>
                  {hasPayables && (
                    <span className="cp-page__calendar-dot">
                      <span className="cp-page__calendar-dot-indicator" aria-hidden="true" />
                      {dayData.count}
                    </span>
                  )}
                  {openDay === dayNum && dayData && (
                    <div
                      className="cp-page__calendar-popover"
                      ref={popoverRef}
                      role="tooltip"
                      aria-live="polite"
                    >
                      <p className="cp-page__calendar-popover-title">
                        Vencimentos em {dayNum}/{month}/{year}
                      </p>
                      {dayData.payables.map((p) => (
                        <div key={p.id} className="cp-page__calendar-popover-item">
                          <span className="cp-page__calendar-popover-supplier">
                            {p.supplierName}
                          </span>
                          <span className="cp-page__calendar-popover-amount">
                            {formatBRL(p.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

type TabId = 'titulos' | 'aging' | 'calendario';

export default function PayablesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('titulos');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [farmFilter, setFarmFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [showPayableModal, setShowPayableModal] = useState(false);
  const [editPayableId, setEditPayableId] = useState<string | undefined>();
  const [paymentPayable, setPaymentPayable] = useState<Payable | null>(null);
  const [showBatchPayment, setShowBatchPayment] = useState(false);
  const [showCnabRetorno, setShowCnabRetorno] = useState(false);
  const [deleteConfirmPayable, setDeleteConfirmPayable] = useState<Payable | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const { farms } = useFarms();
  const { payables, meta, loading, error, refetch } = usePayables({
    farmId: farmFilter || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: search || undefined,
    page,
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleBucketClick = useCallback((bucket: string) => {
    setActiveTab('titulos');
    // Map bucket to status filter
    const bucketStatusMap: Record<string, string> = {
      OVERDUE: 'OVERDUE',
      D7: 'PENDING',
      D15: 'PENDING',
      D30: 'PENDING',
      D60: 'PENDING',
      D90: 'PENDING',
      D90PLUS: 'PENDING',
    };
    setStatusFilter(bucketStatusMap[bucket] ?? '');
    setPage(1);
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(payables.map((p) => p.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [payables],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setShowPayableModal(false);
    setEditPayableId(undefined);
    void refetch();
    showToast('Conta a pagar registrada com sucesso');
  }, [refetch, showToast]);

  const handleEditSuccess = useCallback(() => {
    setShowPayableModal(false);
    setEditPayableId(undefined);
    void refetch();
    showToast('Conta a pagar atualizada com sucesso');
  }, [refetch, showToast]);

  const handlePaymentSuccess = useCallback(() => {
    setPaymentPayable(null);
    void refetch();
    showToast('Baixa registrada com sucesso');
  }, [refetch, showToast]);

  const handleBatchSuccess = useCallback(() => {
    setShowBatchPayment(false);
    setSelectedIds(new Set());
    void refetch();
    showToast('Baixa em lote registrada com sucesso');
  }, [refetch, showToast]);

  const handleCnabSuccess = useCallback(() => {
    setShowCnabRetorno(false);
    void refetch();
    showToast('Retorno CNAB processado com sucesso');
  }, [refetch, showToast]);

  const handleReverse = useCallback(
    async (payable: Payable) => {
      try {
        await api.post(`/org/payables/${payable.id}/reverse`, {});
        void refetch();
        showToast('Estorno realizado com sucesso');
      } catch {
        showToast('Não foi possível estornar. Verifique sua conexão.');
      }
    },
    [refetch, showToast],
  );

  const handleDelete = useCallback(
    async (payable: Payable) => {
      try {
        await api.delete(`/org/payables/${payable.id}`);
        void refetch();
        setDeleteConfirmPayable(null);
        showToast('Conta a pagar removida');
      } catch {
        showToast('Não foi possível remover. Verifique sua conexão.');
      }
    },
    [refetch, showToast],
  );

  const selectedPayables = payables.filter((p) => selectedIds.has(p.id));
  const allSelected = payables.length > 0 && payables.every((p) => selectedIds.has(p.id));

  return (
    <main className="cp-page" id="main-content">
      {toast && (
        <div className="cp-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirmPayable && (
        <div
          className="cp-page__confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar exclusão"
        >
          <div className="cp-page__confirm-panel">
            <h3 className="cp-page__confirm-title">Remover conta a pagar?</h3>
            <p className="cp-page__confirm-text">
              O título de <strong>{deleteConfirmPayable.supplierName}</strong> no valor de{' '}
              <strong>{formatBRL(deleteConfirmPayable.totalAmount)}</strong> será removido. Esta
              ação não pode ser desfeita.
            </p>
            <div className="cp-page__confirm-actions">
              <button
                type="button"
                className="cp-page__confirm-cancel"
                onClick={() => setDeleteConfirmPayable(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cp-page__confirm-danger"
                onClick={() => void handleDelete(deleteConfirmPayable)}
              >
                <XCircle size={16} aria-hidden="true" />
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="cp-page__header">
        <div>
          <h1 className="cp-page__title">Contas a pagar</h1>
          <p className="cp-page__subtitle">Gerencie títulos, dê baixas e acompanhe vencimentos</p>
        </div>
        <button
          type="button"
          className="cp-page__btn-primary"
          onClick={() => {
            setEditPayableId(undefined);
            setShowPayableModal(true);
          }}
        >
          <Plus size={20} aria-hidden="true" />
          Nova conta a pagar
        </button>
      </header>

      {/* Tabs */}
      <div className="cp-page__tabs" role="tablist" aria-label="Visualizações">
        {(
          [
            { id: 'titulos', label: 'Títulos', icon: Receipt },
            { id: 'aging', label: 'Aging', icon: CalendarDays },
            { id: 'calendario', label: 'Calendário', icon: CalendarDays },
          ] as { id: TabId; label: string; icon: React.ElementType }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`cp-page__tab${activeTab === id ? ' cp-page__tab--active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={16} aria-hidden="true" style={{ marginRight: 6, display: 'inline' }} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Títulos ── */}
      {activeTab === 'titulos' && (
        <section aria-label="Lista de títulos">
          {/* Filters */}
          <div className="cp-page__filters">
            <div className="cp-page__filter-group">
              <label htmlFor="cp-status" className="cp-page__filter-label">
                Status
              </label>
              <select
                id="cp-status"
                className="cp-page__filter-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendente</option>
                <option value="OVERDUE">Vencido</option>
                <option value="PAID">Pago</option>
                <option value="PARTIAL">Parcial</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>

            <div className="cp-page__filter-group">
              <label htmlFor="cp-category" className="cp-page__filter-label">
                Categoria
              </label>
              <select
                id="cp-category"
                className="cp-page__filter-select"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {(Object.keys(CATEGORY_LABELS) as PayableCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div className="cp-page__filter-group">
              <label htmlFor="cp-farm" className="cp-page__filter-label">
                Fazenda
              </label>
              <select
                id="cp-farm"
                className="cp-page__filter-select"
                value={farmFilter}
                onChange={(e) => {
                  setFarmFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="cp-page__filter-group">
              <label htmlFor="cp-start" className="cp-page__filter-label">
                De
              </label>
              <input
                id="cp-start"
                type="date"
                className="cp-page__filter-input"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="cp-page__filter-group">
              <label htmlFor="cp-end" className="cp-page__filter-label">
                Até
              </label>
              <input
                id="cp-end"
                type="date"
                className="cp-page__filter-input"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="cp-page__filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="cp-search" className="cp-page__filter-label">
                Busca
              </label>
              <input
                id="cp-search"
                type="search"
                className="cp-page__filter-input"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Fornecedor ou descrição..."
              />
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="cp-page__bulk-actions" role="status">
              <span className="cp-page__bulk-count">
                {selectedIds.size}{' '}
                {selectedIds.size === 1 ? 'título selecionado' : 'títulos selecionados'}
              </span>
              <button
                type="button"
                className="cp-page__bulk-btn"
                onClick={() => setShowBatchPayment(true)}
              >
                <CreditCard size={14} aria-hidden="true" />
                Baixar selecionados
              </button>
              <button
                type="button"
                className="cp-page__bulk-btn"
                onClick={() => setShowCnabRetorno(true)}
              >
                <FileText size={14} aria-hidden="true" />
                Gerar CNAB
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="cp-page__error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Table */}
          <div className="cp-page__table-wrap">
            <table className="cp-page__table">
              <caption className="sr-only">Lista de contas a pagar</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      className="cp-page__checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th scope="col">Fornecedor</th>
                  <th scope="col">Descrição</th>
                  <th scope="col" className="cp-page__col-right">
                    Valor
                  </th>
                  <th scope="col">Vencimento</th>
                  <th scope="col">Status</th>
                  <th scope="col">Parcela</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </>
                )}
                {!loading && payables.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="cp-page__empty">
                        <div className="cp-page__empty-icon" aria-hidden="true">
                          <Receipt size={48} />
                        </div>
                        <h2 className="cp-page__empty-title">Nenhuma conta a pagar encontrada</h2>
                        <p className="cp-page__empty-desc">
                          Registre sua primeira conta a pagar ou ajuste os filtros
                        </p>
                        <button
                          type="button"
                          className="cp-page__btn-primary"
                          onClick={() => {
                            setEditPayableId(undefined);
                            setShowPayableModal(true);
                          }}
                        >
                          <Plus size={20} aria-hidden="true" />
                          Nova conta a pagar
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading &&
                  payables.map((payable) => (
                    <tr key={payable.id}>
                      <td data-label="">
                        <input
                          type="checkbox"
                          className="cp-page__checkbox"
                          checked={selectedIds.has(payable.id)}
                          onChange={() => toggleSelect(payable.id)}
                          aria-label={`Selecionar ${payable.supplierName}`}
                        />
                      </td>
                      <td data-label="Fornecedor">
                        <strong>{payable.supplierName}</strong>
                        {payable.farmName && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-neutral-500, #9e9e9e)',
                              marginTop: 2,
                            }}
                          >
                            {payable.farmName}
                          </div>
                        )}
                      </td>
                      <td data-label="Descrição">
                        {(payable.description ?? payable.category)
                          ? CATEGORY_LABELS[payable.category]
                          : '—'}
                      </td>
                      <td data-label="Valor" className={`cp-page__col-right cp-page__col-mono`}>
                        {formatBRL(payable.totalAmount)}
                      </td>
                      <td data-label="Vencimento" className="cp-page__col-nowrap">
                        {formatDate(payable.dueDate)}
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={payable.status} />
                      </td>
                      <td data-label="Parcela">
                        {payable.installmentCount > 1
                          ? `${payable.installmentNumber}/${payable.installmentCount}`
                          : '—'}
                      </td>
                      <td>
                        <RowActions
                          payable={payable}
                          onEdit={() => {
                            setEditPayableId(payable.id);
                            setShowPayableModal(true);
                          }}
                          onPay={() => setPaymentPayable(payable)}
                          onReverse={() => void handleReverse(payable)}
                          onDelete={() => setDeleteConfirmPayable(payable)}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="cp-page__pagination" aria-label="Paginação">
              <button
                type="button"
                className="cp-page__page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="cp-page__page-info">
                Página {page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="cp-page__page-btn"
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                aria-label="Próxima página"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </section>
      )}

      {/* ── Tab: Aging ── */}
      {activeTab === 'aging' && (
        <section aria-label="Aging de contas a pagar">
          <AgingTab farmId={farmFilter || undefined} onBucketClick={handleBucketClick} />
        </section>
      )}

      {/* ── Tab: Calendário ── */}
      {activeTab === 'calendario' && (
        <section aria-label="Calendário de vencimentos">
          <CalendarTab farmId={farmFilter || undefined} />
        </section>
      )}

      {/* Modals */}
      <PayableModal
        isOpen={showPayableModal}
        onClose={() => {
          setShowPayableModal(false);
          setEditPayableId(undefined);
        }}
        onSuccess={editPayableId ? handleEditSuccess : handleCreateSuccess}
        payableId={editPayableId}
      />

      {paymentPayable && (
        <PaymentModal
          payable={paymentPayable}
          onClose={() => setPaymentPayable(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showBatchPayment && (
        <BatchPaymentModal
          payableIds={Array.from(selectedIds)}
          payables={selectedPayables}
          onClose={() => setShowBatchPayment(false)}
          onSuccess={handleBatchSuccess}
        />
      )}

      {showCnabRetorno && (
        <CnabRetornoModal onClose={() => setShowCnabRetorno(false)} onSuccess={handleCnabSuccess} />
      )}
    </main>
  );
}
