import { useState } from 'react';
import { Landmark, Plus, Pencil, Trash2, FileText, Users, MapPin } from 'lucide-react';
import { useRuralProperties, deleteRuralProperty } from '../../hooks/useRuralProperties';
import type { RuralPropertyItem } from '../../types/rural-property';
import { CLASSIFICATION_LABELS } from '../../types/rural-property';
import { RuralPropertyModal } from './RuralPropertyModal';
import './RuralPropertySection.css';

interface RuralPropertySectionProps {
  farmId: string;
}

export function RuralPropertySection({ farmId }: RuralPropertySectionProps) {
  const { properties, isLoading, refetch } = useRuralProperties({ farmId });
  const [showModal, setShowModal] = useState(false);
  const [editPropertyId, setEditPropertyId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCreate = () => {
    setEditPropertyId(null);
    setShowModal(true);
  };

  const handleEdit = (propertyId: string) => {
    setEditPropertyId(propertyId);
    setShowModal(true);
  };

  const handleDelete = async (property: RuralPropertyItem) => {
    if (!window.confirm(`Tem certeza que deseja remover "${property.denomination}"?`)) return;
    try {
      await deleteRuralProperty(farmId, property.id);
      setSuccessMsg('Imóvel removido com sucesso');
      setTimeout(() => setSuccessMsg(null), 3000);
      await refetch();
    } catch {
      // Error handled by hook
    }
  };

  const handleSuccess = async () => {
    setSuccessMsg(
      editPropertyId ? 'Imóvel atualizado com sucesso' : 'Imóvel cadastrado com sucesso',
    );
    setTimeout(() => setSuccessMsg(null), 3000);
    await refetch();
  };

  return (
    <section className="rp-section" aria-labelledby="rp-section-title">
      <div className="rp-section__header">
        <div className="rp-section__title-row">
          <Landmark size={20} aria-hidden="true" />
          <h2 id="rp-section-title" className="rp-section__title">
            Imóveis Rurais
          </h2>
          <span className="rp-section__count">{properties.length}</span>
        </div>
        <button className="rp-section__add-btn" onClick={handleCreate} type="button">
          <Plus size={16} aria-hidden="true" /> Novo imóvel
        </button>
      </div>

      {successMsg && (
        <div className="rp-section__success" role="status">
          {successMsg}
        </div>
      )}

      {isLoading ? (
        <div className="rp-section__grid">
          {[1, 2].map((i) => (
            <div key={i} className="rp-card rp-card--skeleton">
              <div className="rp-card__skeleton-line rp-card__skeleton-line--title" />
              <div className="rp-card__skeleton-line" />
              <div className="rp-card__skeleton-line rp-card__skeleton-line--short" />
            </div>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="rp-section__empty">
          <Landmark size={48} aria-hidden="true" />
          <h3>Nenhum imóvel rural cadastrado</h3>
          <p>Cadastre o primeiro imóvel para organizar documentos e matrículas.</p>
          <button
            className="rp-section__add-btn rp-section__add-btn--primary"
            onClick={handleCreate}
            type="button"
          >
            <Plus size={16} aria-hidden="true" /> Cadastrar imóvel
          </button>
        </div>
      ) : (
        <div className="rp-section__grid">
          {properties.map((rp) => (
            <article key={rp.id} className="rp-card">
              <div className="rp-card__header">
                <h3 className="rp-card__name">{rp.denomination}</h3>
                <div className="rp-card__actions">
                  <button
                    className="rp-card__icon-btn"
                    onClick={() => handleEdit(rp.id)}
                    aria-label={`Editar ${rp.denomination}`}
                    type="button"
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    className="rp-card__icon-btn rp-card__icon-btn--danger"
                    onClick={() => handleDelete(rp)}
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
                <div className="rp-card__stat">
                  <FileText size={14} aria-hidden="true" />
                  <span>
                    {rp.titlesCount} matrícula{rp.titlesCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="rp-card__stat">
                  <Users size={14} aria-hidden="true" />
                  <span>
                    {rp.ownersCount} titular{rp.ownersCount !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="rp-card__stat">
                  <FileText size={14} aria-hidden="true" />
                  <span>
                    {rp.documentsCount} doc{rp.documentsCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <RuralPropertyModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        farmId={farmId}
        propertyId={editPropertyId}
      />
    </section>
  );
}
