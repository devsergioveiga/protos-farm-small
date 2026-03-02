import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Search, Map, Ruler, FileText, AlertCircle, Tractor } from 'lucide-react';
import { useFarms } from '@/hooks/useFarms';
import type { FarmListItem } from '@/types/farm';
import './FarmsPage.css';

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function FarmCard({ farm }: { farm: FarmListItem }) {
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

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="farms-page__empty">
      <Tractor size={64} aria-hidden="true" className="farms-page__empty-icon" />
      <h2 className="farms-page__empty-title">
        {hasSearch ? 'Nenhuma fazenda encontrada' : 'Nenhuma fazenda ainda'}
      </h2>
      <p className="farms-page__empty-description">
        {hasSearch
          ? 'Tente mudar os termos de busca.'
          : 'Cadastre sua primeira fazenda para começar a gerenciar suas propriedades.'}
      </p>
    </div>
  );
}

function FarmsPage() {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const { farms, isLoading, error } = useFarms({ search: debouncedSearch || undefined });

  return (
    <main className="farms-page">
      <nav className="farms-page__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Início</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Fazendas</span>
      </nav>

      <header className="farms-page__header">
        <h1 className="farms-page__title">Fazendas</h1>

        <div className="farms-page__search-wrapper">
          <Search size={16} aria-hidden="true" className="farms-page__search-icon" />
          <label htmlFor="farms-search" className="sr-only">
            Buscar fazendas
          </label>
          <input
            id="farms-search"
            type="search"
            className="farms-page__search"
            placeholder="Buscar por nome..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </header>

      {error && (
        <div className="farms-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {isLoading && <SkeletonCards />}

      {!isLoading && !error && farms.length === 0 && <EmptyState hasSearch={!!debouncedSearch} />}

      {!isLoading && !error && farms.length > 0 && (
        <div className="farms-page__grid">
          {farms.map((farm) => (
            <FarmCard key={farm.id} farm={farm} />
          ))}
        </div>
      )}
    </main>
  );
}

export default FarmsPage;
