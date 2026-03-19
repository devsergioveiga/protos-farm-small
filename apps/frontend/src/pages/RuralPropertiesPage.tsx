import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Landmark, MapPin, FileText, Users, Search, Pencil, Trash2, Plus } from 'lucide-react';
import { useAllRuralProperties } from '@/hooks/useRuralProperties';
import { CLASSIFICATION_LABELS } from '@/types/rural-property';
import type { RuralPropertyWithFarm } from '@/hooks/useRuralProperties';
import { RuralPropertyModal } from '@/components/rural-property/RuralPropertyModal';
import OwnersModal from '@/components/rural-property/OwnersModal';
import DocumentsModal from '@/components/rural-property/DocumentsModal';
import { deleteRuralProperty } from '@/hooks/useRuralProperties';
import ConfirmModal from '@/components/ui/ConfirmModal';
import '@/components/rural-property/RuralPropertySection.css';
import './RuralPropertiesPage.css';

export default function RuralPropertiesPage() {
  const [searchParams] = useSearchParams();
  const farmIdParam = searchParams.get('farmId');
  const { properties, isLoading, error, refetch } = useAllRuralProperties();
  const [search, setSearch] = useState('');
  const [filterFarm, setFilterFarm] = useState('');

  useEffect(() => {
    if (farmIdParam && properties.length > 0) {
      const match = properties.find((p) => p.farmId === farmIdParam);
      if (match) setFilterFarm(match.farmName);
    }
  }, [farmIdParam, properties]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<{ farmId: string; propertyId: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RuralPropertyWithFarm | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ownersTarget, setOwnersTarget] = useState<RuralPropertyWithFarm | null>(null);
  const [docsTarget, setDocsTarget] = useState<RuralPropertyWithFarm | null>(null);

  const farmNames = [...new Set(properties.map((p) => p.farmName))].sort();

  const filtered = properties.filter((p) => {
    const matchSearch =
      !search ||
      p.denomination.toLowerCase().includes(search.toLowerCase()) ||
      p.municipality?.toLowerCase().includes(search.toLowerCase()) ||
      p.cib?.includes(search) ||
      p.carCode?.toLowerCase().includes(search.toLowerCase());
    const matchFarm = !filterFarm || p.farmName === filterFarm;
    return matchSearch && matchFarm;
  });

  const handleEdit = (rp: RuralPropertyWithFarm) => {
    setEditTarget({ farmId: rp.farmId, propertyId: rp.id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteRuralProperty(deleteTarget.farmId, deleteTarget.id);
      showSuccess('Imóvel removido com sucesso');
    } catch {
      // silently handled
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
      void refetch();
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCreateSuccess = async () => {
    showSuccess('Imóvel cadastrado com sucesso');
    setShowCreateModal(false);
    await refetch();
  };

  const handleEditSuccess = async () => {
    showSuccess('Imóvel atualizado com sucesso');
    setEditTarget(null);
    await refetch();
  };

  return (
    <main className="rp-page">
      <nav className="rp-page__breadcrumb" aria-label="Navegação">
        <Link to="/dashboard">Início</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Imóveis Rurais</span>
      </nav>

      <header className="rp-page__header">
        <h1 className="rp-page__title">Imóveis Rurais</h1>
        <button className="rp-page__add-btn" onClick={() => setShowCreateModal(true)} type="button">
          <Plus size={16} aria-hidden="true" /> Novo imóvel
        </button>
      </header>

      <div className="rp-page__filters">
        <div className="rp-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por nome, município ou CIB"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rp-page__search-input"
          />
        </div>
        <div className="rp-page__filter-group">
          <label htmlFor="filter-farm" className="rp-page__filter-label">
            FAZENDA
          </label>
          <select
            id="filter-farm"
            value={filterFarm}
            onChange={(e) => setFilterFarm(e.target.value)}
            className="rp-page__select"
          >
            <option value="">Todas</option>
            {farmNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {successMsg && (
        <div className="rp-page__success" role="status">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="rp-page__error" role="alert">
          <Landmark size={20} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="rp-page__grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rp-card rp-card--skeleton">
              <div className="rp-card__skeleton-line rp-card__skeleton-line--title" />
              <div className="rp-card__skeleton-line" />
              <div className="rp-card__skeleton-line rp-card__skeleton-line--short" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rp-page__empty">
          <Landmark size={48} aria-hidden="true" />
          <h3>
            {search || filterFarm ? 'Nenhum imóvel encontrado' : 'Nenhum imóvel rural cadastrado'}
          </h3>
          <p>
            {search || filterFarm
              ? 'Tente ajustar os filtros de busca.'
              : 'Cadastre imóveis rurais a partir da página de detalhe de cada fazenda.'}
          </p>
        </div>
      ) : (
        <div className="rp-page__grid">
          {filtered.map((rp) => (
            <article key={rp.id} className="rp-card">
              <div className="rp-card__header">
                <div>
                  <h3 className="rp-card__name">{rp.denomination}</h3>
                  <Link to={`/farms/${rp.farmId}`} className="rp-card__farm-link">
                    <MapPin size={12} aria-hidden="true" /> {rp.farmName}
                  </Link>
                </div>
                <div className="rp-card__actions">
                  <button
                    className="rp-card__icon-btn"
                    onClick={() => handleEdit(rp)}
                    aria-label={`Editar ${rp.denomination}`}
                    type="button"
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    className="rp-card__icon-btn rp-card__icon-btn--danger"
                    onClick={() => setDeleteTarget(rp)}
                    aria-label={`Remover ${rp.denomination}`}
                    type="button"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="rp-card__body">
                {(rp.municipality || rp.state) && (
                  <div className="rp-card__info">
                    <MapPin size={14} aria-hidden="true" />
                    <span>{[rp.municipality, rp.state].filter(Boolean).join(' — ')}</span>
                  </div>
                )}
                {rp.totalAreaHa != null && (
                  <div className="rp-card__info">
                    <span className="rp-card__label">Área:</span>
                    <span>{rp.totalAreaHa.toLocaleString('pt-BR')} ha</span>
                  </div>
                )}
                {rp.landClassification && (
                  <div className="rp-card__info">
                    <span className="rp-card__label">Classificação:</span>
                    <span>
                      {CLASSIFICATION_LABELS[rp.landClassification] || rp.landClassification}
                    </span>
                  </div>
                )}
                {rp.cib && (
                  <div className="rp-card__info">
                    <span className="rp-card__label">CIB:</span>
                    <span className="rp-card__mono">{rp.cib}</span>
                  </div>
                )}
              </div>

              <div className="rp-card__footer">
                <Link
                  to={`/registrations?propertyName=${encodeURIComponent(rp.denomination)}`}
                  className="rp-card__stat rp-card__stat--link"
                  aria-label={`Ver matrículas de ${rp.denomination}`}
                >
                  <FileText size={14} aria-hidden="true" />
                  <span>
                    {rp.titlesCount} matrícula{rp.titlesCount !== 1 ? 's' : ''}
                  </span>
                </Link>
                <button
                  type="button"
                  className="rp-card__stat rp-card__stat--link"
                  onClick={() => setOwnersTarget(rp)}
                  aria-label={`Ver titulares de ${rp.denomination}`}
                >
                  <Users size={14} aria-hidden="true" />
                  <span>
                    {rp.ownersCount} titular{rp.ownersCount !== 1 ? 'es' : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className="rp-card__stat rp-card__stat--link"
                  onClick={() => setDocsTarget(rp)}
                  aria-label={`Ver documentos de ${rp.denomination}`}
                >
                  <FileText size={14} aria-hidden="true" />
                  <span>
                    {rp.documentsCount} doc{rp.documentsCount !== 1 ? 's' : ''}
                  </span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <RuralPropertyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {editTarget && (
        <RuralPropertyModal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={handleEditSuccess}
          farmId={editTarget.farmId}
          propertyId={editTarget.propertyId}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Remover imóvel rural"
        message={`Tem certeza que deseja remover "${deleteTarget?.denomination}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {ownersTarget && (
        <OwnersModal
          isOpen={!!ownersTarget}
          farmId={ownersTarget.farmId}
          propertyId={ownersTarget.id}
          propertyName={ownersTarget.denomination}
          onClose={() => setOwnersTarget(null)}
        />
      )}

      {docsTarget && (
        <DocumentsModal
          isOpen={!!docsTarget}
          farmId={docsTarget.farmId}
          propertyId={docsTarget.id}
          propertyName={docsTarget.denomination}
          onClose={() => setDocsTarget(null)}
        />
      )}
    </main>
  );
}
