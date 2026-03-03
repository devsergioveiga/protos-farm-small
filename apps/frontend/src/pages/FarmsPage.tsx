import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Search,
  Map,
  Ruler,
  FileText,
  AlertCircle,
  Tractor,
  LayoutGrid,
  List,
  Layers,
  Wheat,
  Trash2,
  Pencil,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { useFarms } from '@/hooks/useFarms';
import { useAuth } from '@/stores/AuthContext';
import { api } from '@/services/api';
import { VALID_UF } from '@/constants/states';
import ConfirmDeleteModal from '@/components/confirm-delete/ConfirmDeleteModal';
import FarmFormModal from '@/components/farm-form/FarmFormModal';
import PermissionGate from '@/components/auth/PermissionGate';
import type { FarmListItem } from '@/types/farm';
import './FarmsPage.css';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface FarmCardProps {
  farm: FarmListItem;
  canDelete: boolean;
  canEdit: boolean;
  onDelete: (farm: FarmListItem) => void;
  onEdit: (farm: FarmListItem) => void;
}

function FarmCard({ farm, canDelete, canEdit, onDelete, onEdit }: FarmCardProps) {
  const statusClass = farm.status === 'ACTIVE' ? 'active' : 'inactive';
  const statusLabel = farm.status === 'ACTIVE' ? 'Ativa' : 'Inativa';
  const location = [farm.city, farm.state].filter(Boolean).join(' — ');

  return (
    <article className="farm-card">
      <div className="farm-card__header">
        <h2 className="farm-card__name">{farm.name}</h2>
        <span className={`farm-card__status farm-card__status--${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="farm-card__details">
        {location && (
          <span className="farm-card__detail">
            <MapPin size={16} aria-hidden="true" className="farm-card__detail-icon" />
            {location}
          </span>
        )}
        <span className="farm-card__detail">
          <Ruler size={16} aria-hidden="true" className="farm-card__detail-icon" />
          {Number(farm.totalAreaHa).toLocaleString('pt-BR')} ha
        </span>
        <span className="farm-card__detail">
          <FileText size={16} aria-hidden="true" className="farm-card__detail-icon" />
          {farm._count.registrations} {farm._count.registrations === 1 ? 'matrícula' : 'matrículas'}
        </span>
        <span className="farm-card__detail">
          <Layers size={16} aria-hidden="true" className="farm-card__detail-icon" />
          {farm._count.fieldPlots} {farm._count.fieldPlots === 1 ? 'talhão' : 'talhões'}
        </span>
        <span className="farm-card__detail">
          <Wheat size={16} aria-hidden="true" className="farm-card__detail-icon" />-
        </span>
      </div>

      <div className="farm-card__actions">
        <Link
          to={`/farms/${farm.id}/map`}
          className="farm-card__map-link"
          aria-label={`Ver mapa de ${farm.name}`}
        >
          <Map size={16} aria-hidden="true" />
          Ver no mapa
        </Link>
        {canEdit && (
          <button
            type="button"
            className="farm-card__edit-btn"
            aria-label={`Editar ${farm.name}`}
            onClick={() => onEdit(farm)}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="farm-card__delete-btn"
            aria-label={`Excluir ${farm.name}`}
            onClick={() => onDelete(farm)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

interface FarmListRowProps {
  farm: FarmListItem;
  canEdit: boolean;
  onEdit: (farm: FarmListItem) => void;
}

function FarmListRow({ farm, canEdit, onEdit }: FarmListRowProps) {
  const statusClass = farm.status === 'ACTIVE' ? 'active' : 'inactive';
  const statusLabel = farm.status === 'ACTIVE' ? 'Ativa' : 'Inativa';
  const location = [farm.city, farm.state].filter(Boolean).join(' — ');

  return (
    <article className="farm-list-row">
      <div className="farm-list-row__main">
        <h2 className="farm-list-row__name">{farm.name}</h2>
        <span className={`farm-card__status farm-card__status--${statusClass}`}>{statusLabel}</span>
      </div>
      <div className="farm-list-row__meta">
        {location && (
          <span className="farm-card__detail">
            <MapPin size={16} aria-hidden="true" className="farm-card__detail-icon" />
            {location}
          </span>
        )}
        <span className="farm-card__detail">
          <Ruler size={16} aria-hidden="true" className="farm-card__detail-icon" />
          {Number(farm.totalAreaHa).toLocaleString('pt-BR')} ha
        </span>
        <span className="farm-card__detail">
          <FileText size={16} aria-hidden="true" className="farm-card__detail-icon" />
          {farm._count.registrations} {farm._count.registrations === 1 ? 'matrícula' : 'matrículas'}
        </span>
      </div>
      <div className="farm-list-row__actions">
        <Link
          to={`/farms/${farm.id}/map`}
          className="farm-card__map-link"
          aria-label={`Ver mapa de ${farm.name}`}
        >
          <Map size={16} aria-hidden="true" />
          Ver no mapa
        </Link>
        {canEdit && (
          <button
            type="button"
            className="farm-card__edit-btn"
            aria-label={`Editar ${farm.name}`}
            onClick={() => onEdit(farm)}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

function SkeletonCards() {
  return (
    <div className="farms-page__grid" aria-busy="true" aria-label="Carregando fazendas">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="farms-page__skeleton-card">
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line skeleton-line--text" />
          <div className="skeleton-line skeleton-line--text" />
          <div className="skeleton-line skeleton-line--short" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="farms-page__empty">
      <Tractor size={64} aria-hidden="true" className="farms-page__empty-icon" />
      <h2 className="farms-page__empty-title">
        {hasFilters ? 'Nenhuma fazenda encontrada' : 'Nenhuma fazenda ainda'}
      </h2>
      <p className="farms-page__empty-description">
        {hasFilters
          ? 'Tente mudar os filtros de busca.'
          : 'Cadastre sua primeira fazenda para começar a gerenciar suas propriedades.'}
      </p>
    </div>
  );
}

function FarmsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [stateFilter, setStateFilter] = useState('');
  const [minAreaInput, setMinAreaInput] = useState('');
  const [maxAreaInput, setMaxAreaInput] = useState('');
  const [farmToDelete, setFarmToDelete] = useState<FarmListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [farmToEdit, setFarmToEdit] = useState<FarmListItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { permissions } = useAuth();
  const canDelete = permissions.includes('farms:delete');
  const canEdit = permissions.includes('farms:update');

  const debouncedSearch = useDebounce(searchInput, 300);
  const debouncedMinArea = useDebounce(minAreaInput, 500);
  const debouncedMaxArea = useDebounce(maxAreaInput, 500);

  const minAreaHa = debouncedMinArea ? Number(debouncedMinArea) : undefined;
  const maxAreaHa = debouncedMaxArea ? Number(debouncedMaxArea) : undefined;

  const { farms, isLoading, error, refetch } = useFarms({
    search: debouncedSearch || undefined,
    state: stateFilter || undefined,
    minAreaHa: minAreaHa != null && !isNaN(minAreaHa) ? minAreaHa : undefined,
    maxAreaHa: maxAreaHa != null && !isNaN(maxAreaHa) ? maxAreaHa : undefined,
  });

  const hasFilters = !!(debouncedSearch || stateFilter || debouncedMinArea || debouncedMaxArea);

  async function handleDeleteFarm() {
    if (!farmToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteWithBody(`/org/farms/${farmToDelete.id}`, {
        confirmName: farmToDelete.name,
      });
      setFarmToDelete(null);
      void refetch();
    } catch {
      // Error is shown via the modal — user can retry
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="farms-page">
      <nav className="farms-page__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Início</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Fazendas</span>
      </nav>

      {successMessage && (
        <div className="farms-page__success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          {successMessage}
        </div>
      )}

      <header className="farms-page__header">
        <h1 className="farms-page__title">Fazendas</h1>

        <div className="farms-page__header-actions">
          <PermissionGate permission="farms:create">
            <button
              type="button"
              className="farms-page__new-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={20} aria-hidden="true" />
              Nova fazenda
            </button>
          </PermissionGate>
          <div
            className="farms-page__view-toggle"
            role="radiogroup"
            aria-label="Modo de visualização"
          >
            <button
              type="button"
              className={`farms-page__view-btn ${viewMode === 'card' ? 'farms-page__view-btn--active' : ''}`}
              role="radio"
              aria-checked={viewMode === 'card'}
              aria-label="Visualização em cards"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`farms-page__view-btn ${viewMode === 'list' ? 'farms-page__view-btn--active' : ''}`}
              role="radio"
              aria-checked={viewMode === 'list'}
              aria-label="Visualização em lista"
              onClick={() => setViewMode('list')}
            >
              <List size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="farms-page__search-wrapper">
            <Search size={16} aria-hidden="true" className="farms-page__search-icon" />
            <label htmlFor="farms-search" className="sr-only">
              Buscar fazendas
            </label>
            <input
              id="farms-search"
              type="search"
              className="farms-page__search"
              placeholder="Buscar por nome ou cidade..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="farms-page__filters">
        <div className="farms-page__filter-group">
          <label htmlFor="filter-uf" className="farms-page__filter-label">
            UF
          </label>
          <select
            id="filter-uf"
            className="farms-page__filter-select"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="">Todas</option>
            {VALID_UF.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>

        <div className="farms-page__filter-group">
          <label htmlFor="filter-min-area" className="farms-page__filter-label">
            Área min (ha)
          </label>
          <input
            id="filter-min-area"
            type="number"
            className="farms-page__filter-input"
            placeholder="0"
            min="0"
            value={minAreaInput}
            onChange={(e) => setMinAreaInput(e.target.value)}
          />
        </div>

        <div className="farms-page__filter-group">
          <label htmlFor="filter-max-area" className="farms-page__filter-label">
            Área máx (ha)
          </label>
          <input
            id="filter-max-area"
            type="number"
            className="farms-page__filter-input"
            placeholder="∞"
            min="0"
            value={maxAreaInput}
            onChange={(e) => setMaxAreaInput(e.target.value)}
          />
        </div>

        <div className="farms-page__filter-group farms-page__filter-group--disabled">
          <label htmlFor="filter-cultura" className="farms-page__filter-label">
            Cultura
          </label>
          <select id="filter-cultura" className="farms-page__filter-select" disabled>
            <option value="">Em breve</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="farms-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {isLoading && <SkeletonCards />}

      {!isLoading && !error && farms.length === 0 && <EmptyState hasFilters={hasFilters} />}

      {!isLoading && !error && farms.length > 0 && viewMode === 'card' && (
        <div className="farms-page__grid">
          {farms.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              canDelete={canDelete}
              canEdit={canEdit}
              onDelete={setFarmToDelete}
              onEdit={setFarmToEdit}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && farms.length > 0 && viewMode === 'list' && (
        <div className="farms-page__list">
          {farms.map((farm) => (
            <FarmListRow key={farm.id} farm={farm} canEdit={canEdit} onEdit={setFarmToEdit} />
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!farmToDelete}
        farmName={farmToDelete?.name ?? ''}
        onConfirm={handleDeleteFarm}
        onCancel={() => setFarmToDelete(null)}
        isDeleting={isDeleting}
      />

      <FarmFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          setSuccessMessage('Fazenda cadastrada com sucesso!');
          const timer = setTimeout(() => setSuccessMessage(null), 3000);
          void refetch();
          return () => clearTimeout(timer);
        }}
      />

      <FarmFormModal
        isOpen={!!farmToEdit}
        farmId={farmToEdit?.id}
        onClose={() => setFarmToEdit(null)}
        onSuccess={() => {
          setFarmToEdit(null);
          setSuccessMessage('Fazenda atualizada com sucesso!');
          const timer = setTimeout(() => setSuccessMessage(null), 3000);
          void refetch();
          return () => clearTimeout(timer);
        }}
      />
    </main>
  );
}

export default FarmsPage;
