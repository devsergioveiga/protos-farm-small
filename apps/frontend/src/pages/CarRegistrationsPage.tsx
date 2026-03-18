import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { TreePine, MapPin, Search, ExternalLink } from 'lucide-react';
import { api } from '@/services/api';
import './CarRegistrationsPage.css';

interface CarRegistration {
  id: string;
  farmId: string;
  farmName: string;
  ruralPropertyId: string | null;
  ruralPropertyName: string | null;
  carCode: string;
  status: 'ATIVO' | 'PENDENTE' | 'CANCELADO' | 'SUSPENSO';
  inscriptionDate: string | null;
  areaHa: number | null;
  city: string | null;
  state: string | null;
  legalReserveApprovedHa: number | null;
  appTotalHa: number | null;
  boundaryAreaHa: number | null;
  createdAt: string;
}

const STATUS_LABELS: Record<CarRegistration['status'], string> = {
  ATIVO: 'Ativo',
  PENDENTE: 'Pendente',
  CANCELADO: 'Cancelado',
  SUSPENSO: 'Suspenso',
};

const STATUS_CSS: Record<CarRegistration['status'], string> = {
  ATIVO: 'ativo',
  PENDENTE: 'pendente',
  CANCELADO: 'cancelado',
  SUSPENSO: 'suspenso',
};

function useAllCarRegistrations() {
  const [registrations, setRegistrations] = useState<CarRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<CarRegistration[]>('/org/car');
      setRegistrations(result);
    } catch {
      setError('Nao foi possivel carregar os registros de CAR. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { registrations, isLoading, error, refetch: fetch };
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return '--';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CarRegistrationsPage() {
  const { registrations, isLoading, error } = useAllCarRegistrations();
  const [search, setSearch] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const farmNames = [...new Set(registrations.map((r) => r.farmName))].sort();

  const filtered = registrations.filter((r) => {
    const matchSearch =
      !search ||
      r.carCode.toLowerCase().includes(search.toLowerCase()) ||
      r.city?.toLowerCase().includes(search.toLowerCase());
    const matchFarm = !filterFarm || r.farmName === filterFarm;
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchFarm && matchStatus;
  });

  return (
    <main className="car-page">
      <nav className="car-page__breadcrumb" aria-label="Navegacao">
        <Link to="/dashboard">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">CAR</span>
      </nav>

      <header className="car-page__header">
        <h1 className="car-page__title">Cadastro Ambiental Rural</h1>
      </header>

      <div className="car-page__filters">
        <div className="car-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por codigo CAR ou cidade"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="car-page__search-input"
          />
        </div>
        <div className="car-page__filter-group">
          <label htmlFor="filter-farm" className="car-page__filter-label">
            FAZENDA
          </label>
          <select
            id="filter-farm"
            value={filterFarm}
            onChange={(e) => setFilterFarm(e.target.value)}
            className="car-page__select"
          >
            <option value="">Todas</option>
            {farmNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="car-page__filter-group">
          <label htmlFor="filter-status" className="car-page__filter-label">
            STATUS
          </label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="car-page__select"
          >
            <option value="">Todos</option>
            <option value="ATIVO">Ativo</option>
            <option value="PENDENTE">Pendente</option>
            <option value="CANCELADO">Cancelado</option>
            <option value="SUSPENSO">Suspenso</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="car-page__error" role="alert">
          <TreePine size={20} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="car-page__grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="car-card car-card--skeleton">
              <div className="car-card__skeleton-line car-card__skeleton-line--title" />
              <div className="car-card__skeleton-line" />
              <div className="car-card__skeleton-line car-card__skeleton-line--short" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="car-page__empty">
          <TreePine size={48} aria-hidden="true" />
          <h3>
            {search || filterFarm || filterStatus
              ? 'Nenhum registro encontrado'
              : 'Nenhum CAR cadastrado'}
          </h3>
          <p>
            {search || filterFarm || filterStatus
              ? 'Tente ajustar os filtros de busca.'
              : 'Cadastre registros de CAR a partir da pagina de detalhe de cada fazenda.'}
          </p>
        </div>
      ) : (
        <div className="car-page__grid">
          {filtered.map((r) => (
            <article key={r.id} className="car-card">
              <div className="car-card__header">
                <div className="car-card__header-left">
                  <h3 className="car-card__code">{r.carCode}</h3>
                  <span className={`car-card__status car-card__status--${STATUS_CSS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
                <Link
                  to={`/farms/${r.farmId}`}
                  className="car-card__farm-link"
                  aria-label={`Ver fazenda ${r.farmName}`}
                >
                  <MapPin size={12} aria-hidden="true" />
                  <span>{r.farmName}</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </Link>
              </div>

              <div className="car-card__body">
                {(r.city || r.state) && (
                  <div className="car-card__info">
                    <MapPin size={14} aria-hidden="true" />
                    <span>{[r.city, r.state].filter(Boolean).join(' - ')}</span>
                  </div>
                )}
                <div className="car-card__info">
                  <span className="car-card__label">Area total:</span>
                  <span className="car-card__mono">{formatNumber(r.areaHa)} ha</span>
                </div>
                <div className="car-card__info">
                  <span className="car-card__label">Reserva legal:</span>
                  <span className="car-card__mono">
                    {formatNumber(r.legalReserveApprovedHa)} ha
                  </span>
                </div>
                <div className="car-card__info">
                  <span className="car-card__label">APP total:</span>
                  <span className="car-card__mono">{formatNumber(r.appTotalHa)} ha</span>
                </div>
                {r.ruralPropertyName && (
                  <div className="car-card__info">
                    <span className="car-card__label">Imovel rural:</span>
                    <span>{r.ruralPropertyName}</span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
