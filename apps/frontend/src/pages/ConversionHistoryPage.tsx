import { useState, useRef, useCallback, useMemo } from 'react';
import {
  ArrowRightLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Download,
  Calendar,
  MapPin,
  PackageCheck,
  PackageMinus,
  Hash,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useConversionHistory } from '@/hooks/useConversionHistory';
import type { ConversionHistoryItem, OperationType } from '@/types/conversion-history';
import { OPERATION_TYPE_OPTIONS } from '@/types/conversion-history';
import './ConversionHistoryPage.css';

function ConversionHistoryPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [operationFilter, setOperationFilter] = useState<OperationType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { items, meta, isLoading, error } = useConversionHistory({
    farmId: selectedFarmId,
    operationType: operationFilter || undefined,
    productName: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const handleExportCsv = useCallback(() => {
    const query = new URLSearchParams();
    if (selectedFarmId) query.set('farmId', selectedFarmId);
    if (operationFilter) query.set('operationType', operationFilter);
    if (search) query.set('productName', search);
    if (dateFrom) query.set('dateFrom', dateFrom);
    if (dateTo) query.set('dateTo', dateTo);
    const qs = query.toString();
    window.open(`/api/org/conversion-history/export${qs ? `?${qs}` : ''}`, '_blank');
  }, [selectedFarmId, operationFilter, search, dateFrom, dateTo]);

  const stats = useMemo(() => {
    if (!meta) return null;
    const byType = { PESTICIDE: 0, FERTILIZER: 0, SOIL_PREP: 0 };
    for (const item of items) {
      byType[item.operationType]++;
    }
    return { total: meta.total, byType };
  }, [items, meta]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const getBadgeClass = (type: OperationType) => {
    switch (type) {
      case 'PESTICIDE':
        return 'conv-history__badge--pesticide';
      case 'FERTILIZER':
        return 'conv-history__badge--fertilizer';
      case 'SOIL_PREP':
        return 'conv-history__badge--soil-prep';
    }
  };

  if (!selectedFarmId) {
    return (
      <section className="conv-history">
        <div className="conv-history__empty">
          <ArrowRightLeft size={64} aria-hidden="true" />
          <h2 className="conv-history__empty-title">Selecione uma fazenda</h2>
          <p className="conv-history__empty-desc">
            Escolha uma fazenda no seletor acima para ver o histórico de conversões.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="conv-history">
      <div className="conv-history__header">
        <div>
          <h1 className="conv-history__title">Histórico de conversões</h1>
          <p className="conv-history__subtitle">
            Auditoria de conversões dose → quantidade em{' '}
            {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="conv-history__header-actions">
          <button
            type="button"
            className="conv-history__btn conv-history__btn--ghost"
            onClick={handleExportCsv}
            aria-label="Exportar histórico CSV"
          >
            <Download size={20} aria-hidden="true" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="conv-history__toolbar">
        <div className="conv-history__search-wrapper">
          <Search size={16} aria-hidden="true" className="conv-history__search-icon" />
          <input
            type="search"
            className="conv-history__search"
            placeholder="Buscar por produto..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar por nome do produto"
          />
        </div>
        <select
          className="conv-history__filter-select"
          value={operationFilter}
          onChange={(e) => {
            setOperationFilter(e.target.value as OperationType | '');
            setPage(1);
          }}
          aria-label="Filtrar por tipo de operação"
        >
          <option value="">Todas as operações</option>
          {OPERATION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label className="conv-history__sr-only" htmlFor="conv-date-from">
          Data início
        </label>
        <input
          id="conv-date-from"
          type="date"
          className="conv-history__date-input"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          aria-label="Data início"
        />
        <label className="conv-history__sr-only" htmlFor="conv-date-to">
          Data fim
        </label>
        <input
          id="conv-date-to"
          type="date"
          className="conv-history__date-input"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          aria-label="Data fim"
        />
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="conv-history__stats">
          <div className="conv-history__stat">
            <Hash size={20} aria-hidden="true" className="conv-history__stat-icon" />
            <div>
              <div className="conv-history__stat-value">{stats.total}</div>
              <div className="conv-history__stat-label">CONVERSÕES</div>
            </div>
          </div>
          {stats.byType.PESTICIDE > 0 && (
            <div className="conv-history__stat">
              <div>
                <div className="conv-history__stat-value">{stats.byType.PESTICIDE}</div>
                <div className="conv-history__stat-label">DEFENSIVOS</div>
              </div>
            </div>
          )}
          {stats.byType.FERTILIZER > 0 && (
            <div className="conv-history__stat">
              <div>
                <div className="conv-history__stat-value">{stats.byType.FERTILIZER}</div>
                <div className="conv-history__stat-label">ADUBAÇÕES</div>
              </div>
            </div>
          )}
          {stats.byType.SOIL_PREP > 0 && (
            <div className="conv-history__stat">
              <div>
                <div className="conv-history__stat-value">{stats.byType.SOIL_PREP}</div>
                <div className="conv-history__stat-label">PREPARO SOLO</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="conv-history__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="conv-history__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="conv-history__skeleton conv-history__skeleton--card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !isLoading && !error && (
        <div className="conv-history__empty">
          <ArrowRightLeft size={64} aria-hidden="true" />
          <h2 className="conv-history__empty-title">Nenhuma conversão encontrada</h2>
          <p className="conv-history__empty-desc">
            Conversões são registradas automaticamente ao criar operações de campo com dose e
            produto vinculado ao estoque.
          </p>
        </div>
      )}

      {/* Cards grid */}
      {items.length > 0 && !isLoading && (
        <div className="conv-history__grid">
          {items.map((item) => (
            <ConversionCard
              key={item.id}
              item={item}
              getBadgeClass={getBadgeClass}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="conv-history__pagination" aria-label="Paginação do histórico">
          <button
            type="button"
            className="conv-history__btn conv-history__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="conv-history__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="conv-history__btn conv-history__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}
    </section>
  );
}

// ─── Card component ─────────────────────────────────────────────────

interface ConversionCardProps {
  item: ConversionHistoryItem;
  getBadgeClass: (type: OperationType) => string;
  formatDate: (iso: string) => string;
}

function ConversionCard({ item, getBadgeClass, formatDate }: ConversionCardProps) {
  return (
    <div className="conv-history__card">
      <div className="conv-history__card-header">
        <h3 className="conv-history__card-product">{item.productName}</h3>
        <span className={`conv-history__badge ${getBadgeClass(item.operationType)}`}>
          {item.operationLabel}
        </span>
      </div>

      <div className="conv-history__card-details">
        <span className="conv-history__card-detail">
          <MapPin size={14} aria-hidden="true" />
          <span className="conv-history__card-detail-label">Talhão:</span>
          {item.fieldPlotName}
        </span>
        <span className="conv-history__card-detail">
          <Calendar size={14} aria-hidden="true" />
          <span className="conv-history__card-detail-label">Data:</span>
          {formatDate(item.appliedAt)}
        </span>
        <span className="conv-history__card-detail">
          <span className="conv-history__card-detail-label">Área:</span>
          {item.areaHa.toFixed(2)} ha
        </span>
        <span className="conv-history__card-detail">
          <span className="conv-history__card-detail-label">Por:</span>
          {item.recorderName}
        </span>
      </div>

      <div className="conv-history__formula">
        <ArrowRightLeft size={16} aria-hidden="true" className="conv-history__formula-icon" />
        <span className="conv-history__formula-text">{item.conversionFormula}</span>
      </div>

      <span
        className={`conv-history__stock-badge ${item.stockOutputId ? 'conv-history__stock-badge--yes' : 'conv-history__stock-badge--no'}`}
      >
        {item.stockOutputId ? (
          <>
            <PackageCheck size={12} aria-hidden="true" />
            Baixa no estoque
          </>
        ) : (
          <>
            <PackageMinus size={12} aria-hidden="true" />
            Sem baixa no estoque
          </>
        )}
      </span>
    </div>
  );
}

export default ConversionHistoryPage;
