import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, MapPin } from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import './FarmSelector.css';

function FarmSelector() {
  const { farms, selectedFarmId, selectedFarm, selectFarm, isLoadingFarms } = useFarmContext();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const triggerLabel = selectedFarm ? selectedFarm.name : 'Todas as fazendas';

  const filteredFarms = search
    ? farms.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          (f.city && f.city.toLowerCase().includes(search.toLowerCase())),
      )
    : farms;

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        setSearch('');
      }
      return !prev;
    });
  }, []);

  const handleSelect = useCallback(
    (farmId: string | null) => {
      selectFarm(farmId);
      setIsOpen(false);
    },
    [selectFarm],
  );

  // Focus search when dropdown opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (isLoadingFarms) {
    return (
      <div className="farm-selector">
        <div className="farm-selector__trigger farm-selector__trigger--loading">
          Carregando fazendas...
        </div>
      </div>
    );
  }

  return (
    <div className="farm-selector" ref={containerRef}>
      <button
        type="button"
        className="farm-selector__trigger"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Fazenda selecionada: ${triggerLabel}`}
      >
        <MapPin size={16} aria-hidden="true" className="farm-selector__trigger-icon" />
        <span className="farm-selector__trigger-text">{triggerLabel}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`farm-selector__chevron ${isOpen ? 'farm-selector__chevron--open' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="farm-selector__dropdown" role="listbox" aria-label="Selecionar fazenda">
          {farms.length > 3 && (
            <div className="farm-selector__search-wrapper">
              <Search size={14} aria-hidden="true" className="farm-selector__search-icon" />
              <label htmlFor="farm-selector-search" className="sr-only">
                Buscar fazenda
              </label>
              <input
                id="farm-selector-search"
                ref={searchRef}
                type="search"
                className="farm-selector__search"
                placeholder="Buscar por nome ou cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          <ul className="farm-selector__list">
            <li>
              <button
                type="button"
                className={`farm-selector__item ${selectedFarmId === null ? 'farm-selector__item--selected' : ''}`}
                role="option"
                aria-selected={selectedFarmId === null}
                onClick={() => handleSelect(null)}
              >
                <span className="farm-selector__item-name">Todas as fazendas</span>
                <span className="farm-selector__item-meta">
                  {farms.length} {farms.length === 1 ? 'fazenda' : 'fazendas'}
                </span>
              </button>
            </li>
            {filteredFarms.map((farm) => {
              const location = [farm.city, farm.state].filter(Boolean).join('/');
              return (
                <li key={farm.id}>
                  <button
                    type="button"
                    className={`farm-selector__item ${selectedFarmId === farm.id ? 'farm-selector__item--selected' : ''}`}
                    role="option"
                    aria-selected={selectedFarmId === farm.id}
                    onClick={() => handleSelect(farm.id)}
                  >
                    <span className="farm-selector__item-name">{farm.name}</span>
                    <span className="farm-selector__item-meta">
                      {location && `${location} · `}
                      {Number(farm.totalAreaHa).toLocaleString('pt-BR')} ha
                    </span>
                  </button>
                </li>
              );
            })}
            {filteredFarms.length === 0 && search && (
              <li className="farm-selector__no-results">Nenhuma fazenda encontrada</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default FarmSelector;
