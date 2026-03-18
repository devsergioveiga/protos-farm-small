import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, MapPin, Map, Pencil, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import type { FarmDetail } from '../types/farm';
import { RuralPropertySection } from '../components/rural-property/RuralPropertySection';
import FarmFormModal from '../components/farm-form/FarmFormModal';
import './FarmDetailPage.css';

export default function FarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [farm, setFarm] = useState<FarmDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchFarm = useCallback(async () => {
    if (!farmId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<FarmDetail>(`/org/farms/${farmId}`);
      setFarm(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fazenda');
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchFarm();
  }, [fetchFarm]);

  if (isLoading) {
    return (
      <main className="farm-detail">
        <div className="farm-detail__skeleton">
          <div className="farm-detail__skeleton-line farm-detail__skeleton-line--title" />
          <div className="farm-detail__skeleton-line" />
          <div className="farm-detail__skeleton-line farm-detail__skeleton-line--short" />
        </div>
      </main>
    );
  }

  if (error || !farm) {
    return (
      <main className="farm-detail">
        <div className="farm-detail__error">
          <p>{error || 'Fazenda não encontrada'}</p>
          <Link to="/farms" className="farm-detail__back-link">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar para fazendas
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="farm-detail">
      {/* Breadcrumb */}
      <nav className="farm-detail__breadcrumb" aria-label="Navegação">
        <Link to="/farms">Fazendas</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{farm.name}</span>
      </nav>

      {/* Farm header */}
      <header className="farm-detail__header">
        <div className="farm-detail__header-info">
          <h1 className="farm-detail__name">{farm.name}</h1>
          {farm.nickname && <span className="farm-detail__nickname">{farm.nickname}</span>}
          <div className="farm-detail__location">
            <MapPin size={14} aria-hidden="true" />
            <span>{[farm.city, farm.state].filter(Boolean).join(' — ')}</span>
          </div>
        </div>
        <div className="farm-detail__header-actions">
          <button className="farm-detail__btn" onClick={() => setShowEditModal(true)} type="button">
            <Pencil size={16} aria-hidden="true" /> Editar
          </button>
          <Link to={`/farms/${farmId}/map`} className="farm-detail__btn farm-detail__btn--primary">
            <Map size={16} aria-hidden="true" /> Ver mapa
          </Link>
        </div>
      </header>

      {/* Summary cards */}
      <div className="farm-detail__summary">
        <div className="farm-detail__stat-card">
          <span className="farm-detail__stat-label">Área total</span>
          <span className="farm-detail__stat-value">
            {farm.totalAreaHa.toLocaleString('pt-BR')} ha
          </span>
        </div>
        <div className="farm-detail__stat-card">
          <span className="farm-detail__stat-label">Matrículas</span>
          <span className="farm-detail__stat-value">{farm.registrations.length}</span>
        </div>
        <div className="farm-detail__stat-card">
          <span className="farm-detail__stat-label">Status</span>
          <span className={`farm-detail__status farm-detail__status--${farm.status.toLowerCase()}`}>
            {farm.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
          </span>
        </div>
      </div>

      {/* Rural Properties Section */}
      {farmId && <RuralPropertySection farmId={farmId} />}

      {/* Edit Modal */}
      <FarmFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          setShowEditModal(false);
          void fetchFarm();
        }}
        farmId={farmId}
      />
    </main>
  );
}
