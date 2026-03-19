import { useFarmContext } from '@/stores/FarmContext';
import type { KanbanFilters as KanbanFiltersType } from '@/hooks/usePurchasingKanban';
import './KanbanFilters.css';

interface KanbanFiltersProps {
  filters: KanbanFiltersType;
  onChange: (filters: KanbanFiltersType) => void;
}

export default function KanbanFilters({ filters, onChange }: KanbanFiltersProps) {
  const { farms } = useFarmContext();

  const handleFarmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, farmId: e.target.value || undefined });
  };

  const handleUrgencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, urgency: e.target.value || undefined });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value || undefined });
  };

  return (
    <div className="kanban-filters" role="search" aria-label="Filtros do kanban de compras">
      {/* Farm selector */}
      <div className="kanban-filters__group">
        <label htmlFor="kanban-farm-filter" className="kanban-filters__label">
          Fazenda
        </label>
        <select
          id="kanban-farm-filter"
          className="kanban-filters__select"
          value={filters.farmId ?? ''}
          onChange={handleFarmChange}
          aria-label="Selecionar fazenda"
        >
          <option value="">Todas as fazendas</option>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </select>
      </div>

      {/* Urgency filter */}
      <div className="kanban-filters__group">
        <label htmlFor="kanban-urgency-filter" className="kanban-filters__label">
          Urgência
        </label>
        <select
          id="kanban-urgency-filter"
          className="kanban-filters__select"
          value={filters.urgency ?? ''}
          onChange={handleUrgencyChange}
          aria-label="Filtrar por urgência"
        >
          <option value="">Todos</option>
          <option value="NORMAL">Normal</option>
          <option value="URGENTE">Urgente</option>
          <option value="EMERGENCIAL">Emergencial</option>
        </select>
      </div>

      {/* Search input */}
      <div className="kanban-filters__group">
        <label htmlFor="kanban-search" className="kanban-filters__label">
          Número
        </label>
        <input
          id="kanban-search"
          type="text"
          className="kanban-filters__input"
          value={filters.search ?? ''}
          onChange={handleSearchChange}
          placeholder="RC-001..."
          aria-label="Buscar por número da requisição"
        />
      </div>
    </div>
  );
}
