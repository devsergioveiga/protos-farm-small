import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Handshake,
  Search,
  Upload,
  Download,
  FileText,
  Pencil,
  Star,
  Trash2,
  CheckCircle2,
  MinusCircle,
  Ban,
  AlertCircle,
  Plus,
  X,
  Trophy,
  Medal,
  Loader2,
} from 'lucide-react';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierForm } from '@/hooks/useSupplierForm';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SupplierModal from '@/components/suppliers/SupplierModal';
import SupplierImportModal from '@/components/suppliers/SupplierImportModal';
import SupplierRatingModal from '@/components/suppliers/SupplierRatingModal';
import type { Supplier, SupplierCategory } from '@/types/supplier';
import { SUPPLIER_CATEGORY_LABELS, SUPPLIER_STATUS_LABELS } from '@/types/supplier';
import { api } from '@/services/api';
import './SuppliersPage.css';

// ─── Debounce hook ───────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Utilities ───────────────────────────────────────────────────────

function formatDocument(doc: string, type: 'PF' | 'PJ'): string {
  const digits = doc.replace(/\D/g, '');
  if (type === 'PJ' && digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (type === 'PF' && digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return doc;
}

function StarRating({ value, count }: { value?: number; count?: number }) {
  if (!value || value === 0) {
    return <span className="suppliers-table__rating-empty">—</span>;
  }
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);
  return (
    <span className="suppliers-table__rating">
      {stars.map((star) => (
        <Star
          key={star}
          size={14}
          aria-hidden="true"
          className={
            star <= Math.round(value)
              ? 'suppliers-table__star suppliers-table__star--filled'
              : 'suppliers-table__star suppliers-table__star--empty'
          }
        />
      ))}
      <span className="suppliers-table__rating-value">{value.toFixed(1)}</span>
      {count !== undefined && <span className="suppliers-table__rating-count">({count})</span>}
    </span>
  );
}

function StatusBadge({ status }: { status: Supplier['status'] }) {
  const config: Record<
    Supplier['status'],
    { icon: React.ReactNode; className: string; label: string }
  > = {
    ACTIVE: {
      icon: <CheckCircle2 size={12} aria-hidden="true" />,
      className: 'badge badge--active',
      label: SUPPLIER_STATUS_LABELS.ACTIVE,
    },
    INACTIVE: {
      icon: <MinusCircle size={12} aria-hidden="true" />,
      className: 'badge badge--inactive',
      label: SUPPLIER_STATUS_LABELS.INACTIVE,
    },
    BLOCKED: {
      icon: <Ban size={12} aria-hidden="true" />,
      className: 'badge badge--blocked',
      label: SUPPLIER_STATUS_LABELS.BLOCKED,
    },
  };
  const { icon, className, label } = config[status];
  return (
    <span className={className}>
      {icon}
      {label}
    </span>
  );
}

function CategoryBadges({ categories }: { categories: SupplierCategory[] }) {
  const MAX_VISIBLE = 2;
  const visible = categories.slice(0, MAX_VISIBLE);
  const overflow = categories.length - MAX_VISIBLE;
  return (
    <span className="suppliers-table__categories">
      {visible.map((cat) => (
        <span key={cat} className="badge badge--category">
          {SUPPLIER_CATEGORY_LABELS[cat]}
        </span>
      ))}
      {overflow > 0 && <span className="badge badge--overflow">+{overflow}</span>}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <tbody aria-busy="true" aria-label="Carregando fornecedores">
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="suppliers-table__skeleton-row">
          <td>
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line skeleton-line--text" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--text" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td />
        </tr>
      ))}
    </tbody>
  );
}

// ─── Mobile Card ─────────────────────────────────────────────────────

function SupplierCard({
  supplier,
  onEdit,
  onDelete,
  onRate,
}: {
  supplier: Supplier;
  onEdit: (s: Supplier) => void;
  onDelete: (s: Supplier) => void;
  onRate: (s: Supplier) => void;
}) {
  const location = [supplier.city, supplier.state].filter(Boolean).join(' / ');
  return (
    <article className="supplier-card">
      <div className="supplier-card__header">
        <div>
          <p className="supplier-card__name">{supplier.name}</p>
          {supplier.tradeName && <p className="supplier-card__trade-name">{supplier.tradeName}</p>}
        </div>
        <StatusBadge status={supplier.status} />
      </div>
      <div className="supplier-card__row">
        <span className="supplier-card__doc">
          {formatDocument(supplier.document, supplier.type)}
        </span>
        {location && <span className="supplier-card__location">{location}</span>}
      </div>
      <div className="supplier-card__categories">
        <CategoryBadges categories={supplier.categories} />
      </div>
      <div className="supplier-card__rating">
        <StarRating value={supplier.averageRating} count={supplier.ratingCount} />
      </div>
      <div className="supplier-card__actions">
        <button
          type="button"
          className="supplier-card__action-btn"
          onClick={() => onEdit(supplier)}
          aria-label={`Editar ${supplier.name}`}
        >
          Editar
        </button>
        <button
          type="button"
          className="supplier-card__action-btn"
          onClick={() => onRate(supplier)}
          aria-label={`Avaliar ${supplier.name}`}
        >
          Avaliar
        </button>
        <button
          type="button"
          className="supplier-card__action-btn supplier-card__action-btn--danger"
          onClick={() => onDelete(supplier)}
          aria-label={`Excluir ${supplier.name}`}
        >
          Excluir
        </button>
      </div>
    </article>
  );
}

// ─── Top Fornecedores ─────────────────────────────────────────────────

interface Top3Supplier extends Supplier {
  averageRating: number;
  ratingCount: number;
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <Trophy
        size={20}
        className="top-supplier-card__rank-icon top-supplier-card__rank-icon--1"
        aria-hidden="true"
      />
    );
  }
  return (
    <Medal
      size={20}
      className={`top-supplier-card__rank-icon top-supplier-card__rank-icon--${rank}`}
      aria-hidden="true"
    />
  );
}

function TopSupplierCard({ supplier, rank }: { supplier: Top3Supplier; rank: number }) {
  return (
    <article className={`top-supplier-card top-supplier-card--${rank}`}>
      <div className="top-supplier-card__rank">
        <RankIcon rank={rank} />
        <span className="top-supplier-card__rank-label">#{rank}</span>
      </div>
      <p className="top-supplier-card__name">{supplier.name}</p>
      <div className="top-supplier-card__stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={16}
            aria-hidden="true"
            className={
              n <= Math.round(supplier.averageRating)
                ? 'suppliers-table__star suppliers-table__star--filled'
                : 'suppliers-table__star suppliers-table__star--empty'
            }
          />
        ))}
      </div>
      <p className="top-supplier-card__average">{supplier.averageRating.toFixed(1)}</p>
      <p className="top-supplier-card__count">({supplier.ratingCount} avaliacoes)</p>
    </article>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

function SuppliersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [supplierToRate, setSupplierToRate] = useState<Supplier | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Top 3 section
  const [top3Category, setTop3Category] = useState('');
  const [top3Suppliers, setTop3Suppliers] = useState<Top3Supplier[]>([]);
  const [isLoadingTop3, setIsLoadingTop3] = useState(false);

  // Export loading
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 400);
  const debouncedCity = useDebounce(cityFilter, 400);

  const LIMIT = 20;

  const { suppliers, total, isLoading, error, refetch } = useSuppliers({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    city: debouncedCity || undefined,
    page: currentPage,
    limit: LIMIT,
  });

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = !!(debouncedSearch || categoryFilter || statusFilter || debouncedCity);

  // Build query string reflecting current filters for export
  function buildFilterQuery(): string {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (debouncedCity) params.set('city', debouncedCity);
    return params.toString();
  }

  // Load Top 3 when category changes
  useEffect(() => {
    let cancelled = false;
    async function loadTop3() {
      setIsLoadingTop3(true);
      try {
        const qs = top3Category ? `?category=${top3Category}` : '';
        const data = await api.get<Top3Supplier[]>(`/org/suppliers/top3${qs}`);
        if (!cancelled) setTop3Suppliers(data);
      } catch {
        if (!cancelled) setTop3Suppliers([]);
      } finally {
        if (!cancelled) setIsLoadingTop3(false);
      }
    }
    void loadTop3();
    return () => {
      cancelled = true;
    };
  }, [top3Category]);

  function refetchTop3() {
    setTop3Category((prev) => {
      // toggle trick to re-trigger the effect with same value
      // Instead, use a dedicated refetch counter
      return prev;
    });
    // Re-run by modifying a counter state
    setTop3RefetchCounter((c) => c + 1);
  }

  const [top3RefetchCounter, setTop3RefetchCounter] = useState(0);

  useEffect(() => {
    if (top3RefetchCounter === 0) return;
    let cancelled = false;
    async function loadTop3() {
      setIsLoadingTop3(true);
      try {
        const qs = top3Category ? `?category=${top3Category}` : '';
        const data = await api.get<Top3Supplier[]>(`/org/suppliers/top3${qs}`);
        if (!cancelled) setTop3Suppliers(data);
      } catch {
        if (!cancelled) setTop3Suppliers([]);
      } finally {
        if (!cancelled) setIsLoadingTop3(false);
      }
    }
    void loadTop3();
    return () => {
      cancelled = true;
    };
  }, [top3RefetchCounter, top3Category]);

  const handleSuccess = useCallback(
    (message: string) => {
      setShowModal(false);
      setSupplierToEdit(null);
      setSuccessMessage(message);
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      void refetch();
      return () => clearTimeout(timer);
    },
    [refetch],
  );

  function showToast(message: string) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  const { deleteSupplier, isSubmitting: isDeleting } = useSupplierForm(() => {
    setSupplierToDelete(null);
    showToast('Fornecedor excluido com sucesso');
    void refetch();
  });

  async function handleDelete() {
    if (!supplierToDelete) return;
    await deleteSupplier(supplierToDelete.id);
  }

  function clearFilters() {
    setSearchInput('');
    setCategoryFilter('');
    setStatusFilter('');
    setCityFilter('');
    setCurrentPage(1);
  }

  async function handleExportCsv() {
    setIsExportingCsv(true);
    try {
      const qs = buildFilterQuery();
      const blob = await api.getBlob(`/org/suppliers/export/csv${qs ? `?${qs}` : ''}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fornecedores.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showToast('Nao foi possivel gerar o arquivo. Tente novamente.');
    } finally {
      setIsExportingCsv(false);
    }
  }

  async function handleExportPdf() {
    setIsExportingPdf(true);
    try {
      const qs = buildFilterQuery();
      const blob = await api.getBlob(`/org/suppliers/export/pdf${qs ? `?${qs}` : ''}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fornecedores.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showToast('Nao foi possivel gerar o arquivo. Tente novamente.');
    } finally {
      setIsExportingPdf(false);
    }
  }

  const categoryOptions = Object.entries(SUPPLIER_CATEGORY_LABELS) as [
    keyof typeof SUPPLIER_CATEGORY_LABELS,
    string,
  ][];

  return (
    <main className="suppliers-page">
      {/* Breadcrumb */}
      <nav className="suppliers-page__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Compras</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Fornecedores</span>
      </nav>

      {/* Success toast */}
      {successMessage && (
        <div className="suppliers-page__success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          {successMessage}
        </div>
      )}

      {/* Page header */}
      <header className="suppliers-page__header">
        <div>
          <h1 className="suppliers-page__title">Fornecedores</h1>
          <p className="suppliers-page__subtitle">
            Cadastre e gerencie os fornecedores da organizacao
          </p>
        </div>
        <button
          type="button"
          className="suppliers-page__new-btn"
          onClick={() => {
            setSupplierToEdit(null);
            setShowModal(true);
          }}
        >
          <Plus size={20} aria-hidden="true" />
          Novo Fornecedor
        </button>
      </header>

      {/* Secondary actions */}
      <div className="suppliers-page__actions">
        <button
          type="button"
          className="suppliers-page__action-btn"
          onClick={() => setShowImportModal(true)}
        >
          <Upload size={20} aria-hidden="true" />
          Importar
        </button>
        <button
          type="button"
          className="suppliers-page__action-btn"
          onClick={() => void handleExportCsv()}
          disabled={isExportingCsv}
          aria-busy={isExportingCsv}
        >
          {isExportingCsv ? (
            <Loader2 size={20} aria-hidden="true" className="suppliers-page__spin" />
          ) : (
            <Download size={20} aria-hidden="true" />
          )}
          Exportar CSV
        </button>
        <button
          type="button"
          className="suppliers-page__action-btn"
          onClick={() => void handleExportPdf()}
          disabled={isExportingPdf}
          aria-busy={isExportingPdf}
        >
          {isExportingPdf ? (
            <Loader2 size={20} aria-hidden="true" className="suppliers-page__spin" />
          ) : (
            <FileText size={20} aria-hidden="true" />
          )}
          Exportar PDF
        </button>
      </div>

      {/* Top Fornecedores section */}
      <section className="suppliers-page__top-section" aria-label="Top Fornecedores">
        <div className="suppliers-page__top-header">
          <h2 className="suppliers-page__top-title">Top Fornecedores</h2>
          <select
            className="suppliers-page__top-select"
            aria-label="Filtrar top fornecedores por categoria"
            value={top3Category}
            onChange={(e) => setTop3Category(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categoryOptions.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {isLoadingTop3 && (
          <div className="suppliers-page__top-loading">
            <div className="skeleton-line skeleton-line--top3-card" />
            <div className="skeleton-line skeleton-line--top3-card" />
            <div className="skeleton-line skeleton-line--top3-card" />
          </div>
        )}

        {!isLoadingTop3 && top3Suppliers.length === 0 && (
          <div className="suppliers-page__top-empty">
            <Star size={24} aria-hidden="true" />
            <div>
              <span className="suppliers-page__top-empty-title">
                Sem avaliacoes nesta categoria
              </span>
              <span className="suppliers-page__top-empty-desc">
                Avalie fornecedores apos receber pedidos para ver o ranking.
              </span>
            </div>
          </div>
        )}

        {!isLoadingTop3 && top3Suppliers.length > 0 && (
          <div className="suppliers-page__top-cards">
            {top3Suppliers.slice(0, 3).map((s, i) => (
              <TopSupplierCard key={s.id} supplier={s} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* Filter bar */}
      <div className="suppliers-page__filters">
        <div className="suppliers-page__search-wrapper">
          <Search size={16} aria-hidden="true" className="suppliers-page__search-icon" />
          <label htmlFor="suppliers-search" className="sr-only">
            Buscar por nome, CNPJ ou nome fantasia
          </label>
          <input
            id="suppliers-search"
            type="search"
            className="suppliers-page__search"
            placeholder="Buscar por nome, CNPJ ou nome fantasia"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="suppliers-page__filter-group">
          <label htmlFor="filter-category" className="sr-only">
            Categoria
          </label>
          <select
            id="filter-category"
            className="suppliers-page__filter-select"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todas as categorias</option>
            {categoryOptions.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="suppliers-page__filter-group">
          <label htmlFor="filter-status" className="sr-only">
            Status
          </label>
          <select
            id="filter-status"
            className="suppliers-page__filter-select suppliers-page__filter-select--sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
            <option value="BLOCKED">Bloqueado</option>
          </select>
        </div>

        <div className="suppliers-page__filter-group">
          <label htmlFor="filter-city" className="sr-only">
            Cidade
          </label>
          <input
            id="filter-city"
            type="text"
            className="suppliers-page__filter-input"
            placeholder="Cidade"
            value={cityFilter}
            onChange={(e) => {
              setCityFilter(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="suppliers-page__chips" role="group" aria-label="Filtros ativos">
          {debouncedSearch && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setSearchInput('')}
              aria-label={`Remover filtro de busca: ${debouncedSearch}`}
            >
              Busca: {debouncedSearch}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {categoryFilter && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setCategoryFilter('')}
              aria-label={`Remover filtro de categoria: ${SUPPLIER_CATEGORY_LABELS[categoryFilter as SupplierCategory]}`}
            >
              Categoria: {SUPPLIER_CATEGORY_LABELS[categoryFilter as SupplierCategory]}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {statusFilter && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setStatusFilter('')}
              aria-label={`Remover filtro de status: ${SUPPLIER_STATUS_LABELS[statusFilter as Supplier['status']]}`}
            >
              Status: {SUPPLIER_STATUS_LABELS[statusFilter as Supplier['status']]}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {debouncedCity && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setCityFilter('')}
              aria-label={`Remover filtro de cidade: ${debouncedCity}`}
            >
              Cidade: {debouncedCity}
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="suppliers-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="suppliers-page__table-wrapper">
        <table className="suppliers-table">
          <caption className="sr-only">Lista de fornecedores</caption>
          <thead>
            <tr>
              <th scope="col">Nome / Razao Social</th>
              <th scope="col">CNPJ / CPF</th>
              <th scope="col">Categorias</th>
              <th scope="col">Status</th>
              <th scope="col">Rating</th>
              <th scope="col">
                <span className="sr-only">Acoes</span>
              </th>
            </tr>
          </thead>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td>
                    <p className="suppliers-table__name">{supplier.name}</p>
                    {supplier.tradeName && (
                      <p className="suppliers-table__trade-name">{supplier.tradeName}</p>
                    )}
                  </td>
                  <td>
                    <span className="suppliers-table__doc">
                      {formatDocument(supplier.document, supplier.type)}
                    </span>
                  </td>
                  <td>
                    <CategoryBadges categories={supplier.categories} />
                  </td>
                  <td>
                    <StatusBadge status={supplier.status} />
                  </td>
                  <td>
                    <StarRating value={supplier.averageRating} count={supplier.ratingCount} />
                  </td>
                  <td className="suppliers-table__actions">
                    <button
                      type="button"
                      className="suppliers-table__icon-btn"
                      aria-label={`Editar ${supplier.name}`}
                      onClick={() => {
                        setSupplierToEdit(supplier);
                        setShowModal(true);
                      }}
                    >
                      <Pencil size={20} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="suppliers-table__icon-btn"
                      aria-label={`Avaliar ${supplier.name}`}
                      onClick={() => setSupplierToRate(supplier)}
                    >
                      <Star size={20} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="suppliers-table__icon-btn suppliers-table__icon-btn--danger"
                      aria-label={`Excluir ${supplier.name}`}
                      onClick={() => setSupplierToDelete(supplier)}
                    >
                      <Trash2 size={20} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      {!isLoading && suppliers.length > 0 && (
        <div className="suppliers-page__cards" aria-label="Lista de fornecedores">
          {suppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onEdit={(s) => {
                setSupplierToEdit(s);
                setShowModal(true);
              }}
              onDelete={(s) => setSupplierToDelete(s)}
              onRate={(s) => setSupplierToRate(s)}
            />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!isLoading && !error && suppliers.length === 0 && !hasFilters && (
        <div className="suppliers-page__empty">
          <Handshake size={64} aria-hidden="true" className="suppliers-page__empty-icon" />
          <h2 className="suppliers-page__empty-title">Nenhum fornecedor cadastrado</h2>
          <p className="suppliers-page__empty-desc">
            Adicione fornecedores para iniciar o ciclo de compras. Voce tambem pode importar uma
            lista em CSV ou Excel.
          </p>
          <button
            type="button"
            className="suppliers-page__new-btn"
            onClick={() => {
              setSupplierToEdit(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Cadastrar primeiro fornecedor
          </button>
        </div>
      )}

      {!isLoading && !error && suppliers.length === 0 && hasFilters && (
        <div className="suppliers-page__empty">
          <Search size={64} aria-hidden="true" className="suppliers-page__empty-icon" />
          <h2 className="suppliers-page__empty-title">Nenhum fornecedor encontrado</h2>
          <p className="suppliers-page__empty-desc">
            Nenhum fornecedor corresponde aos filtros aplicados. Tente ajustar a busca ou limpar os
            filtros.
          </p>
          <button type="button" className="suppliers-page__clear-btn" onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="suppliers-page__pagination">
          <button
            type="button"
            className="suppliers-page__page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            aria-label="Pagina anterior"
          >
            Anterior
          </button>
          <span className="suppliers-page__page-info">
            Pagina {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="suppliers-page__page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            aria-label="Proxima pagina"
          >
            Proxima
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <SupplierModal
        isOpen={showModal}
        supplier={supplierToEdit ?? undefined}
        onClose={() => {
          setShowModal(false);
          setSupplierToEdit(null);
        }}
        onSuccess={(msg) => handleSuccess(msg)}
      />

      {/* Import Modal */}
      <SupplierImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={(msg) => {
          setShowImportModal(false);
          showToast(msg);
          void refetch();
        }}
      />

      {/* Rating Modal */}
      {supplierToRate && (
        <SupplierRatingModal
          isOpen={!!supplierToRate}
          supplier={supplierToRate}
          onClose={() => setSupplierToRate(null)}
          onSuccess={() => {
            setSupplierToRate(null);
            showToast('Avaliacao registrada com sucesso');
            void refetch();
            refetchTop3();
          }}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!supplierToDelete}
        title="Excluir fornecedor?"
        message="Esta acao nao pode ser desfeita. O fornecedor e suas avaliacoes serao removidos."
        confirmLabel="Excluir fornecedor"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setSupplierToDelete(null)}
      />
    </main>
  );
}

export default SuppliersPage;
