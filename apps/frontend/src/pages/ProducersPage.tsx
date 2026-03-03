import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Plus, AlertCircle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useProducers } from '@/hooks/useProducers';
import PermissionGate from '@/components/auth/PermissionGate';
import ProducerPFFormModal from '@/components/producer-form/ProducerPFFormModal';
import ProducerPJFormModal from '@/components/producer-form/ProducerPJFormModal';
import ProducerDetailModal from '@/components/producer-detail/ProducerDetailModal';
import type { ProducerListItem, ProducerType } from '@/types/producer';
import './ProducersPage.css';

const TYPE_LABELS: Record<ProducerType, string> = {
  PF: 'Pessoa Física',
  PJ: 'Pessoa Jurídica',
  SOCIEDADE_EM_COMUM: 'Sociedade',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

function formatDocument(doc: string | null, type: ProducerType): string {
  if (!doc) return '—';
  const digits = doc.replace(/\D/g, '');
  if (type === 'PJ' && digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return doc;
}

function ProducersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCreatePFModal, setShowCreatePFModal] = useState(false);
  const [showCreatePJModal, setShowCreatePJModal] = useState(false);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);

  const { producers, meta, isLoading, error, refetch } = useProducers({
    page,
    search: search || undefined,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showNewDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNewDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewDropdown]);

  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowNewDropdown(false);
    }
  }, []);

  const handleRowClick = (producer: ProducerListItem) => {
    setSelectedProducerId(producer.id);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, producer: ProducerListItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(producer);
    }
  };

  // ─── Loading ───────────────────────────────────────────────────
  if (isLoading && producers.length === 0) {
    return (
      <section className="producers" aria-live="polite">
        <div
          className="producers__skeleton"
          style={{ width: '200px', height: '32px', marginBottom: '24px' }}
        />
        <div
          className="producers__skeleton"
          style={{ width: '100%', height: '48px', marginBottom: '16px' }}
        />
        <div className="producers__skeleton" style={{ width: '100%', height: '300px' }} />
      </section>
    );
  }

  return (
    <section className="producers">
      <header className="producers__header">
        <div>
          <h1 className="producers__title">Produtores</h1>
          <p className="producers__subtitle">Gerencie os produtores rurais da organização</p>
        </div>
        <PermissionGate permission="producers:create">
          <div
            className="producers__new-dropdown"
            ref={dropdownRef}
            onKeyDown={handleDropdownKeyDown}
          >
            <button
              type="button"
              className="producers__btn producers__btn--primary"
              aria-haspopup="true"
              aria-expanded={showNewDropdown}
              onClick={() => setShowNewDropdown((prev) => !prev)}
            >
              <Plus aria-hidden="true" size={20} />
              Novo produtor
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            {showNewDropdown && (
              <ul className="producers__dropdown-menu" role="menu">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="producers__dropdown-item"
                    onClick={() => {
                      setShowNewDropdown(false);
                      setShowCreatePFModal(true);
                    }}
                  >
                    Pessoa Física
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="producers__dropdown-item"
                    onClick={() => {
                      setShowNewDropdown(false);
                      setShowCreatePJModal(true);
                    }}
                  >
                    Pessoa Jurídica
                  </button>
                </li>
              </ul>
            )}
          </div>
        </PermissionGate>
      </header>

      {error && (
        <div className="producers__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="producers__toolbar">
        <label htmlFor="producer-search" className="sr-only">
          Buscar produtores
        </label>
        <input
          id="producer-search"
          type="text"
          className="producers__search"
          placeholder="Buscar por nome ou CPF/CNPJ..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <label htmlFor="producer-type-filter" className="sr-only">
          Filtrar por tipo
        </label>
        <select
          id="producer-type-filter"
          className="producers__filter-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os tipos</option>
          <option value="PF">Pessoa Física</option>
          <option value="PJ">Pessoa Jurídica</option>
          <option value="SOCIEDADE_EM_COMUM">Sociedade</option>
        </select>
        <label htmlFor="producer-status-filter" className="sr-only">
          Filtrar por status
        </label>
        <select
          id="producer-status-filter"
          className="producers__filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </select>
      </div>

      {/* Content */}
      {producers.length === 0 && !isLoading ? (
        <div className="producers__empty">
          <Users size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="producers__empty-title">Nenhum produtor encontrado</h2>
          <p className="producers__empty-desc">
            {search || typeFilter || statusFilter
              ? 'Tente ajustar os filtros de busca.'
              : 'Cadastre o primeiro produtor para começar.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="producers__table-wrapper">
            <table className="producers__table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">CPF/CNPJ</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Status</th>
                  <th scope="col">Fazendas</th>
                  <th scope="col">IEs</th>
                </tr>
              </thead>
              <tbody>
                {producers.map((producer) => (
                  <tr
                    key={producer.id}
                    className="producers__table-row"
                    onClick={() => handleRowClick(producer)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalhes de ${producer.name}`}
                    onKeyDown={(e) => handleRowKeyDown(e, producer)}
                  >
                    <td>
                      <span className="producers__producer-name">{producer.name}</span>
                    </td>
                    <td>
                      <span className="producers__document">
                        {formatDocument(producer.document, producer.type)}
                      </span>
                    </td>
                    <td>
                      <span className="producers__badge producers__badge--type">
                        {TYPE_LABELS[producer.type]}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`producers__badge producers__badge--${producer.status.toLowerCase()}`}
                      >
                        {STATUS_LABELS[producer.status]}
                      </span>
                    </td>
                    <td>
                      <span className="producers__count">{producer._count.farmLinks}</span>
                    </td>
                    <td>
                      <span className="producers__count">{producer._count.stateRegistrations}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="producers__cards">
            {producers.map((producer) => (
              <div
                key={producer.id}
                className="producers__card"
                onClick={() => handleRowClick(producer)}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes de ${producer.name}`}
                onKeyDown={(e) => handleRowKeyDown(e, producer)}
              >
                <div className="producers__card-header">
                  <h3 className="producers__card-name">{producer.name}</h3>
                  <span
                    className={`producers__badge producers__badge--${producer.status.toLowerCase()}`}
                  >
                    {STATUS_LABELS[producer.status]}
                  </span>
                </div>
                <div className="producers__card-row">
                  <span className="producers__card-label">CPF/CNPJ</span>
                  <span className="producers__card-value">
                    {formatDocument(producer.document, producer.type)}
                  </span>
                </div>
                <div className="producers__card-row">
                  <span className="producers__card-label">Tipo</span>
                  <span className="producers__card-value">
                    <span className="producers__badge producers__badge--type">
                      {TYPE_LABELS[producer.type]}
                    </span>
                  </span>
                </div>
                <div className="producers__card-counts">
                  <span>{producer._count.farmLinks} fazenda(s)</span>
                  <span>{producer._count.stateRegistrations} IE(s)</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="producers__pagination" aria-label="Paginação de produtores">
              <button
                type="button"
                className="producers__pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Anterior
              </button>
              <span>
                Página {meta.page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="producers__pagination-btn"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </nav>
          )}
        </>
      )}
      <ProducerPFFormModal
        isOpen={showCreatePFModal}
        onClose={() => setShowCreatePFModal(false)}
        onSuccess={() => {
          setShowCreatePFModal(false);
          void refetch();
        }}
      />
      <ProducerPJFormModal
        isOpen={showCreatePJModal}
        onClose={() => setShowCreatePJModal(false)}
        onSuccess={() => {
          setShowCreatePJModal(false);
          void refetch();
        }}
      />
      <ProducerDetailModal
        producerId={selectedProducerId}
        onClose={() => setSelectedProducerId(null)}
        onStatusChange={() => void refetch()}
      />
    </section>
  );
}

export default ProducersPage;
