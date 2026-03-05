import { useState, useEffect, useRef } from 'react';
import { Beef, Plus, Upload, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAnimals } from '@/hooks/useAnimals';
import { useBreeds } from '@/hooks/useBreeds';
import { useFarmContext } from '@/stores/FarmContext';
import PermissionGate from '@/components/auth/PermissionGate';
import CreateAnimalModal from '@/components/animals/CreateAnimalModal';
import AnimalBulkImportModal from '@/components/animal-bulk-import/AnimalBulkImportModal';
import type { AnimalListItem, AnimalSex, AnimalCategory } from '@/types/animal';
import { SEX_LABELS, CATEGORY_LABELS } from '@/types/animal';
import './AnimalsPage.css';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function AnimalsPage() {
  const { selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [breedFilter, setBreedFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  const { animals, meta, isLoading, error, refetch } = useAnimals({
    farmId: selectedFarm?.id ?? null,
    page,
    search: search || undefined,
    sex: sexFilter || undefined,
    category: categoryFilter || undefined,
    breedId: breedFilter || undefined,
  });

  const { breeds } = useBreeds();

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

  // Reset page when farm changes
  useEffect(() => {
    setPage(1);
    setSearch('');
    setSearchInput('');
    setSexFilter('');
    setCategoryFilter('');
    setBreedFilter('');
  }, [selectedFarm?.id]);

  const handleRowClick = (animal: AnimalListItem) => {
    // Future: open detail modal
    void animal;
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, animal: AnimalListItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(animal);
    }
  };

  if (!selectedFarm) {
    return (
      <section className="animals">
        <div className="animals__empty">
          <Beef size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="animals__empty-title">Selecione uma fazenda</h2>
          <p className="animals__empty-desc">
            Escolha uma fazenda no seletor acima para visualizar o rebanho.
          </p>
        </div>
      </section>
    );
  }

  if (isLoading && animals.length === 0) {
    return (
      <section className="animals" aria-live="polite">
        <div
          className="animals__skeleton"
          style={{ width: '200px', height: '32px', marginBottom: '24px' }}
        />
        <div
          className="animals__skeleton"
          style={{ width: '100%', height: '48px', marginBottom: '16px' }}
        />
        <div className="animals__skeleton" style={{ width: '100%', height: '300px' }} />
      </section>
    );
  }

  return (
    <section className="animals">
      <header className="animals__header">
        <div>
          <h1 className="animals__title">Animais</h1>
          <p className="animals__subtitle">Rebanho de {selectedFarm.name}</p>
        </div>
        <div className="animals__header-actions">
          <PermissionGate permission="animals:create">
            <button
              type="button"
              className="animals__btn animals__btn--secondary"
              onClick={() => setShowBulkImportModal(true)}
            >
              <Upload aria-hidden="true" size={20} />
              Importar animais
            </button>
          </PermissionGate>
          <PermissionGate permission="animals:create">
            <button
              type="button"
              className="animals__btn animals__btn--primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus aria-hidden="true" size={20} />
              Novo animal
            </button>
          </PermissionGate>
        </div>
      </header>

      {error && (
        <div className="animals__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="animals__toolbar">
        <label htmlFor="animal-search" className="sr-only">
          Buscar animais
        </label>
        <input
          id="animal-search"
          type="text"
          className="animals__search"
          placeholder="Buscar por brinco, nome ou RFID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <label htmlFor="animal-sex-filter" className="sr-only">
          Filtrar por sexo
        </label>
        <select
          id="animal-sex-filter"
          className="animals__filter-select"
          value={sexFilter}
          onChange={(e) => {
            setSexFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os sexos</option>
          <option value="MALE">Macho</option>
          <option value="FEMALE">Fêmea</option>
        </select>
        <label htmlFor="animal-category-filter" className="sr-only">
          Filtrar por categoria
        </label>
        <select
          id="animal-category-filter"
          className="animals__filter-select"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="animal-breed-filter" className="sr-only">
          Filtrar por raça
        </label>
        <select
          id="animal-breed-filter"
          className="animals__filter-select"
          value={breedFilter}
          onChange={(e) => {
            setBreedFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as raças</option>
          {breeds.map((breed) => (
            <option key={breed.id} value={breed.id}>
              {breed.name}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {animals.length === 0 && !isLoading ? (
        <div className="animals__empty">
          <Beef size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="animals__empty-title">Nenhum animal encontrado</h2>
          <p className="animals__empty-desc">
            {search || sexFilter || categoryFilter || breedFilter
              ? 'Tente ajustar os filtros de busca.'
              : 'Cadastre o primeiro animal para começar.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="animals__table-wrapper">
            <table className="animals__table">
              <thead>
                <tr>
                  <th scope="col">Brinco</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Sexo</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Raça</th>
                  <th scope="col">Nascimento</th>
                </tr>
              </thead>
              <tbody>
                {animals.map((animal) => (
                  <tr
                    key={animal.id}
                    className="animals__table-row"
                    onClick={() => handleRowClick(animal)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalhes de ${animal.earTag}`}
                    onKeyDown={(e) => handleRowKeyDown(e, animal)}
                  >
                    <td>
                      <span className="animals__ear-tag">{animal.earTag}</span>
                    </td>
                    <td>{animal.name ?? '—'}</td>
                    <td>
                      <span
                        className={`animals__badge animals__badge--sex-${animal.sex.toLowerCase()}`}
                      >
                        {SEX_LABELS[animal.sex]}
                      </span>
                    </td>
                    <td>
                      <span className="animals__badge animals__badge--category">
                        {CATEGORY_LABELS[animal.category as AnimalCategory]}
                      </span>
                    </td>
                    <td>
                      <span className="animals__breed-summary">{animal.breedSummary ?? '—'}</span>
                    </td>
                    <td>{formatDate(animal.birthDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="animals__cards">
            {animals.map((animal) => (
              <div
                key={animal.id}
                className="animals__card"
                onClick={() => handleRowClick(animal)}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes de ${animal.earTag}`}
                onKeyDown={(e) => handleRowKeyDown(e, animal)}
              >
                <div className="animals__card-header">
                  <h3 className="animals__card-name">
                    {animal.earTag} {animal.name ? `— ${animal.name}` : ''}
                  </h3>
                  <span
                    className={`animals__badge animals__badge--sex-${animal.sex.toLowerCase()}`}
                  >
                    {SEX_LABELS[animal.sex as AnimalSex]}
                  </span>
                </div>
                <div className="animals__card-row">
                  <span className="animals__card-label">Categoria</span>
                  <span className="animals__card-value">
                    {CATEGORY_LABELS[animal.category as AnimalCategory]}
                  </span>
                </div>
                <div className="animals__card-row">
                  <span className="animals__card-label">Raça</span>
                  <span className="animals__card-value">{animal.breedSummary ?? '—'}</span>
                </div>
                <div className="animals__card-row">
                  <span className="animals__card-label">Nascimento</span>
                  <span className="animals__card-value">{formatDate(animal.birthDate)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="animals__pagination" aria-label="Paginação de animais">
              <button
                type="button"
                className="animals__pagination-btn"
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
                className="animals__pagination-btn"
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

      <CreateAnimalModal
        isOpen={showCreateModal}
        farmId={selectedFarm.id}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          void refetch();
        }}
      />

      <AnimalBulkImportModal
        isOpen={showBulkImportModal}
        farmId={selectedFarm.id}
        onClose={() => setShowBulkImportModal(false)}
        onImportComplete={() => {
          setShowBulkImportModal(false);
          void refetch();
        }}
      />
    </section>
  );
}

export default AnimalsPage;
