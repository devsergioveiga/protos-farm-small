import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound, Plus, Upload, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/stores/AuthContext';
import EmployeeStatusBadge from '@/components/employees/EmployeeStatusBadge';
import CreateEmployeeModal from '@/components/employees/CreateEmployeeModal';
import type { Employee, EmployeeStatus } from '@/types/employee';
import './EmployeesPage.css';

const STATUS_OPTIONS: { value: EmployeeStatus | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'AFASTADO', label: 'Afastado' },
  { value: 'FERIAS', label: 'Férias' },
  { value: 'DESLIGADO', label: 'Desligado' },
];

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

const LIMIT = 20;

function EmployeesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { employees, total, isLoading, error, refetch } = useEmployees({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    limit: LIMIT,
  });

  const totalPages = Math.ceil(total / LIMIT);

  const handleRowClick = (employee: Employee) => {
    navigate(`/employees/${employee.id}`);
  };

  const handleCreateSuccess = () => {
    void refetch();
  };

  const hasFilters = !!search || !!statusFilter;

  return (
    <main className="employees" id="main-content">
      {/* Header */}
      <div className="employees__header">
        <div>
          <h1 className="employees__title">Colaboradores</h1>
          {total > 0 && (
            <p className="employees__subtitle">
              {total} colaborador{total !== 1 ? 'es' : ''} cadastrado{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="employees__header-actions">
          <button
            type="button"
            className="employees__btn employees__btn--secondary"
            onClick={() => {
              /* bulk import — Plan 04 */
            }}
          >
            <Upload size={16} aria-hidden="true" />
            Importar
          </button>
          <button
            type="button"
            className="employees__btn employees__btn--primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Cadastrar colaborador
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="employees__toolbar">
        <input
          type="search"
          className="employees__search"
          placeholder="Buscar por nome, CPF ou matrícula..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Buscar colaboradores"
        />
        <select
          className="employees__filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as EmployeeStatus | '');
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="employees__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading state — skeleton */}
      {isLoading && (
        <div className="employees__table-wrapper">
          <table className="employees__table" aria-label="Carregando colaboradores...">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">CPF</th>
                <th scope="col">Cargo</th>
                <th scope="col">Fazenda</th>
                <th scope="col">STATUS</th>
                <th scope="col">Admissão</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="employees__skeleton-row">
                  <td>
                    <div className="employees__skeleton employees__skeleton--name" />
                  </td>
                  <td>
                    <div className="employees__skeleton employees__skeleton--cpf" />
                  </td>
                  <td>
                    <div className="employees__skeleton employees__skeleton--text" />
                  </td>
                  <td>
                    <div className="employees__skeleton employees__skeleton--text" />
                  </td>
                  <td>
                    <div className="employees__skeleton employees__skeleton--badge" />
                  </td>
                  <td>
                    <div className="employees__skeleton employees__skeleton--date" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && employees.length === 0 && (
        <div className="employees__empty">
          <UserRound
            size={48}
            className="employees__empty-icon"
            aria-hidden="true"
          />
          <h2 className="employees__empty-title">
            {hasFilters ? 'Nenhum resultado encontrado' : 'Nenhum colaborador cadastrado'}
          </h2>
          <p className="employees__empty-body">
            {hasFilters
              ? 'Tente ajustar os filtros ou limpar a busca.'
              : 'Cadastre o primeiro colaborador da fazenda ou importe uma lista em massa.'}
          </p>
          {!hasFilters && (
            <div className="employees__empty-actions">
              <button
                type="button"
                className="employees__btn employees__btn--primary"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} aria-hidden="true" />
                Cadastrar colaborador
              </button>
              <button
                type="button"
                className="employees__btn employees__btn--secondary"
                onClick={() => {
                  /* bulk import — Plan 04 */
                }}
              >
                <Upload size={16} aria-hidden="true" />
                Importar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && employees.length > 0 && (
        <>
          <div className="employees__table-wrapper">
            <table className="employees__table" aria-label="Lista de colaboradores">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">CPF</th>
                  <th scope="col">Cargo</th>
                  <th scope="col">Fazenda</th>
                  <th scope="col">STATUS</th>
                  <th scope="col">Admissão</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const activeFarm = emp.farms?.find((f) => !f.endDate);
                  const activePosition = emp.contracts?.find((c) => c.isActive)?.position;
                  return (
                    <tr
                      key={emp.id}
                      className="employees__row"
                      onClick={() => handleRowClick(emp)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Ver ficha de ${emp.name}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleRowClick(emp);
                      }}
                    >
                      <td className="employees__cell-name">
                        <div className="employees__avatar" aria-label="Foto não disponível">
                          <UserRound size={20} aria-hidden="true" />
                        </div>
                        <span>{emp.name}</span>
                      </td>
                      <td className="employees__cell-cpf">{formatCPF(emp.cpf)}</td>
                      <td>{activePosition?.name ?? emp.farms?.[0]?.position?.name ?? '—'}</td>
                      <td>{activeFarm?.farm?.name ?? '—'}</td>
                      <td>
                        <EmployeeStatusBadge status={emp.status} />
                      </td>
                      <td>{formatDate(emp.admissionDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="employees__pagination" role="navigation" aria-label="Paginação">
              <button
                type="button"
                className="employees__page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="employees__page-info" aria-live="polite">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="employees__page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Próxima página"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Mobile card view (handled via CSS) */}
      <div className="employees__cards" aria-hidden={employees.length === 0}>
        {!isLoading &&
          !error &&
          employees.map((emp) => {
            const activePosition = emp.contracts?.find((c) => c.isActive)?.position;
            return (
              <div
                key={`card-${emp.id}`}
                className="employees__card"
                onClick={() => handleRowClick(emp)}
                tabIndex={-1}
                role="button"
                aria-label={`Ver ficha de ${emp.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleRowClick(emp);
                }}
              >
                <div className="employees__card-header">
                  <div className="employees__avatar employees__avatar--lg" aria-label="Foto não disponível">
                    <UserRound size={24} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="employees__card-name">{emp.name}</div>
                    <div className="employees__card-position">
                      {activePosition?.name ?? '—'}
                    </div>
                  </div>
                </div>
                <EmployeeStatusBadge status={emp.status} />
              </div>
            );
          })}
      </div>

      <CreateEmployeeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </main>
  );
}

export default EmployeesPage;
