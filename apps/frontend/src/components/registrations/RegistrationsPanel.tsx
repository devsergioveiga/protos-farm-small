import { useState } from 'react';
import { X, Plus, Pencil, Trash2, AlertTriangle, FileText, MapPin, Clock } from 'lucide-react';
import PermissionGate from '@/components/auth/PermissionGate';
import type { FarmRegistration, AreaDivergence } from '@/types/farm';
import './RegistrationsPanel.css';

interface RegistrationsPanelProps {
  registrations: FarmRegistration[];
  farmTotalAreaHa: number;
  areaDivergence: AreaDivergence | null;
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (registration: FarmRegistration) => void;
  onDelete: (registration: FarmRegistration) => void;
  onUploadBoundary: (registration: FarmRegistration) => void;
  onViewBoundaryHistory?: (registration: FarmRegistration) => void;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatArea(areaHa: number): string {
  return `${areaHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
}

function SkeletonCards() {
  return (
    <div className="reg-panel__skeleton" aria-busy="true" aria-label="Carregando matrículas">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="reg-panel__skeleton-card">
          <div className="reg-panel__skeleton-line reg-panel__skeleton-line--wide" />
          <div className="reg-panel__skeleton-line reg-panel__skeleton-line--medium" />
          <div className="reg-panel__skeleton-line reg-panel__skeleton-line--narrow" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="reg-panel__empty">
      <FileText size={48} aria-hidden="true" className="reg-panel__empty-icon" />
      <h3 className="reg-panel__empty-title">Nenhuma matrícula cadastrada</h3>
      <p className="reg-panel__empty-text">
        Adicione as matrículas desta fazenda para acompanhar a documentação.
      </p>
      <PermissionGate permission="farms:update">
        <button type="button" className="reg-panel__empty-btn" onClick={onAdd}>
          <Plus size={20} aria-hidden="true" />
          Adicionar matrícula
        </button>
      </PermissionGate>
    </div>
  );
}

function DivergenceAlert({ divergence }: { divergence: AreaDivergence }) {
  if (!divergence.divergent) return null;

  return (
    <div className="reg-panel__alert" role="alert">
      <AlertTriangle size={20} aria-hidden="true" className="reg-panel__alert-icon" />
      <p className="reg-panel__alert-text">
        A soma das áreas das matrículas difere{' '}
        <strong>
          {divergence.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
        </strong>{' '}
        da área total da fazenda.
      </p>
    </div>
  );
}

function RegistrationCard({
  registration,
  onEdit,
  onDelete,
  onUploadBoundary,
  onViewBoundaryHistory,
}: {
  registration: FarmRegistration;
  onEdit: () => void;
  onDelete: () => void;
  onUploadBoundary: () => void;
  onViewBoundaryHistory?: () => void;
}) {
  return (
    <article className="reg-card">
      <div className="reg-card__header">
        <h3 className="reg-card__number">Matrícula {registration.number}</h3>
        <PermissionGate permission="farms:update">
          <div className="reg-card__actions">
            <button
              type="button"
              className="reg-card__action-btn reg-card__action-btn--boundary"
              onClick={onUploadBoundary}
              aria-label={`Upload de perímetro da matrícula ${registration.number}`}
            >
              <MapPin size={16} aria-hidden="true" />
            </button>
            {registration.boundaryAreaHa != null && onViewBoundaryHistory && (
              <button
                type="button"
                className="reg-card__action-btn"
                onClick={onViewBoundaryHistory}
                aria-label={`Histórico de perímetro da matrícula ${registration.number}`}
              >
                <Clock size={16} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="reg-card__action-btn"
              onClick={onEdit}
              aria-label={`Editar matrícula ${registration.number}`}
            >
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="reg-card__action-btn reg-card__action-btn--danger"
              onClick={onDelete}
              aria-label={`Excluir matrícula ${registration.number}`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        </PermissionGate>
      </div>

      {registration.boundaryAreaHa != null && (
        <div className="reg-card__boundary-badge">
          <MapPin size={14} aria-hidden="true" />
          Perímetro: {formatArea(registration.boundaryAreaHa)}
        </div>
      )}

      <dl className="reg-card__details">
        <dt>Cartório</dt>
        <dd>{registration.cartorioName}</dd>

        <dt>Comarca</dt>
        <dd>{registration.comarca}</dd>

        <dt>UF</dt>
        <dd>{registration.state}</dd>

        <dt>Área</dt>
        <dd className="reg-card__area">{formatArea(registration.areaHa)}</dd>

        {registration.cnsCode && (
          <>
            <dt>CNS</dt>
            <dd>{registration.cnsCode}</dd>
          </>
        )}

        {registration.livro && (
          <>
            <dt>Livro</dt>
            <dd>{registration.livro}</dd>
          </>
        )}

        {registration.registrationDate && (
          <>
            <dt>Data registro</dt>
            <dd>{formatDate(registration.registrationDate)}</dd>
          </>
        )}
      </dl>
    </article>
  );
}

function RegistrationsPanel({
  registrations,
  areaDivergence,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onUploadBoundary,
  onViewBoundaryHistory,
  onClose,
}: RegistrationsPanelProps) {
  const [deletingReg, setDeletingReg] = useState<FarmRegistration | null>(null);

  const handleConfirmDelete = () => {
    if (deletingReg) {
      onDelete(deletingReg);
      setDeletingReg(null);
    }
  };

  return (
    <div className="reg-panel" role="region" aria-label="Matrículas da fazenda">
      <div className="reg-panel__header">
        <h2 className="reg-panel__title">Matrículas</h2>
        <div className="reg-panel__header-actions">
          {registrations.length > 0 && (
            <PermissionGate permission="farms:update">
              <button
                type="button"
                className="reg-panel__add-btn"
                onClick={onAdd}
                aria-label="Adicionar matrícula"
              >
                <Plus size={20} aria-hidden="true" />
              </button>
            </PermissionGate>
          )}
          <button
            type="button"
            className="reg-panel__close"
            onClick={onClose}
            aria-label="Fechar painel de matrículas"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {areaDivergence && <DivergenceAlert divergence={areaDivergence} />}

      <div className="reg-panel__body">
        {isLoading ? (
          <SkeletonCards />
        ) : registrations.length === 0 ? (
          <EmptyState onAdd={onAdd} />
        ) : (
          <ul className="reg-panel__list">
            {registrations.map((reg) => (
              <li key={reg.id}>
                <RegistrationCard
                  registration={reg}
                  onEdit={() => onEdit(reg)}
                  onDelete={() => setDeletingReg(reg)}
                  onUploadBoundary={() => onUploadBoundary(reg)}
                  onViewBoundaryHistory={
                    onViewBoundaryHistory ? () => onViewBoundaryHistory(reg) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {deletingReg && (
        <div
          className="reg-panel__confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          <div className="reg-panel__confirm">
            <h3 id="confirm-delete-title" className="reg-panel__confirm-title">
              Excluir matrícula?
            </h3>
            <p className="reg-panel__confirm-text">
              Tem certeza que deseja excluir a matrícula <strong>{deletingReg.number}</strong>? Esta
              ação não pode ser desfeita.
            </p>
            <div className="reg-panel__confirm-actions">
              <button
                type="button"
                className="reg-panel__confirm-btn reg-panel__confirm-btn--cancel"
                onClick={() => setDeletingReg(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="reg-panel__confirm-btn reg-panel__confirm-btn--delete"
                onClick={handleConfirmDelete}
              >
                <Trash2 size={16} aria-hidden="true" />
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RegistrationsPanel;
