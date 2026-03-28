import { useState, useRef, useEffect } from 'react';
import { Briefcase, Plus, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePositions, useStaffingView } from '@/hooks/usePositions';
import CreatePositionModal from '@/components/positions/CreatePositionModal';
import SalaryBandModal from '@/components/positions/SalaryBandModal';
import type { Position } from '@/types/position';
import './PositionsPage.css';

const LIMIT = 20;

function PositionsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showBandModal, setShowBandModal] = useState(false);
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

  const { positions, total, isLoading, error, refetch } = usePositions({
    search: search || undefined,
    page,
    limit: LIMIT,
  });

  const { staffing, isLoading: staffingLoading } = useStaffingView();

  const totalPages = Math.ceil(total / LIMIT);

  const handleOpenBands = (pos: Position) => {
    setSelectedPosition(pos);
    setShowBandModal(true);
  };

  const handleSuccess = () => {
    void refetch();
  };

  return (
    <main className="positions" id="main-content">
      {/* Header */}
      <div className="positions__header">
        <div>
          <h1 className="positions__title">Cargos</h1>
          {total > 0 && (
            <p className="positions__subtitle">
              {total} cargo{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          className="positions__btn positions__btn--primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={16} aria-hidden="true" />
          Cadastrar cargo
        </button>
      </div>

      {/* Search */}
      <div className="positions__toolbar">
        <input
          type="search"
          className="positions__search"
          placeholder="Buscar por nome..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Buscar cargos"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="positions__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="positions__table-wrapper">
          <table className="positions__table" aria-label="Carregando cargos...">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">CBO</th>
                <th scope="col">Adicionais</th>
                <th scope="col">Colaboradores</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="positions__skeleton-row">
                  <td>
                    <div className="positions__skeleton positions__skeleton--name" />
                  </td>
                  <td>
                    <div className="positions__skeleton positions__skeleton--cbo" />
                  </td>
                  <td>
                    <div className="positions__skeleton positions__skeleton--text" />
                  </td>
                  <td>
                    <div className="positions__skeleton positions__skeleton--text" />
                  </td>
                  <td>
                    <div className="positions__skeleton positions__skeleton--text" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && positions.length === 0 && (
        <div className="positions__empty">
          <Briefcase size={48} className="positions__empty-icon" aria-hidden="true" />
          <h2 className="positions__empty-title">Nenhum cargo cadastrado</h2>
          <p className="positions__empty-body">Crie os cargos antes de cadastrar colaboradores.</p>
          <button
            type="button"
            className="positions__btn positions__btn--primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Cadastrar cargo
          </button>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && positions.length > 0 && (
        <>
          <div className="positions__table-wrapper">
            <table className="positions__table" aria-label="Lista de cargos">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">CBO</th>
                  <th scope="col">Adicionais</th>
                  <th scope="col">Colaboradores</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} className="positions__row">
                    <td className="positions__cell-name">{pos.name}</td>
                    <td className="positions__cell-cbo">{pos.cbo || '—'}</td>
                    <td>
                      {pos.additionalTypes.length > 0 ? (
                        <div className="positions__chips">
                          {pos.additionalTypes.map((t) => (
                            <span key={t} className="positions__chip">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{pos._count?.employeeFarms ?? 0}</td>
                    <td>
                      <button
                        type="button"
                        className="positions__action-btn"
                        onClick={() => handleOpenBands(pos)}
                      >
                        Faixas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="positions__pagination" role="navigation" aria-label="Paginação">
              <button
                type="button"
                className="positions__page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="positions__page-info" aria-live="polite">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="positions__page-btn"
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

      {/* Quadro de Lotação */}
      {!staffingLoading && staffing.length > 0 && (
        <section className="positions__staffing" aria-labelledby="staffing-title">
          <h2 id="staffing-title" className="positions__staffing-title">
            Quadro de Lotação
          </h2>
          <div className="positions__table-wrapper">
            <table className="positions__table" aria-label="Quadro de lotação">
              <thead>
                <tr>
                  <th scope="col">Cargo</th>
                  <th scope="col">CBO</th>
                  <th scope="col">Total</th>
                  <th scope="col">Por Fazenda</th>
                </tr>
              </thead>
              <tbody>
                {staffing.map((item) => (
                  <tr key={item.positionId} className="positions__row">
                    <td className="positions__cell-name">{item.positionName}</td>
                    <td className="positions__cell-cbo">{item.cbo || '—'}</td>
                    <td>{item.totalEmployees}</td>
                    <td>
                      {item.byFarm.length > 0 ? (
                        <div className="positions__chips">
                          {item.byFarm.map((f) => (
                            <span key={f.farmId} className="positions__chip">
                              {f.farmName}: {f.count}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="positions__empty-staffing">
                          Nenhum colaborador neste cargo no momento.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CreatePositionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleSuccess}
      />

      <SalaryBandModal
        isOpen={showBandModal}
        position={selectedPosition}
        onClose={() => {
          setShowBandModal(false);
          setSelectedPosition(null);
        }}
        onSuccess={handleSuccess}
      />
    </main>
  );
}

export default PositionsPage;
