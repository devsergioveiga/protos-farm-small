import { useEffect } from 'react';
import { Users, X, AlertCircle, User } from 'lucide-react';
import { useRuralPropertyDetail } from '@/hooks/useRuralProperties';
import { OWNER_TYPES } from '@/types/rural-property';
import './OwnersModal.css';

interface OwnersModalProps {
  isOpen: boolean;
  farmId: string;
  propertyId: string;
  propertyName: string;
  onClose: () => void;
}

export default function OwnersModal({
  isOpen,
  farmId,
  propertyId,
  propertyName,
  onClose,
}: OwnersModalProps) {
  const { property, isLoading, error } = useRuralPropertyDetail({
    farmId: isOpen ? farmId : null,
    propertyId: isOpen ? propertyId : null,
  });

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const owners = property?.owners ?? [];

  return (
    <div
      className="owners-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="owners-modal-title"
    >
      <div className="owners-modal">
        <header className="owners-modal__header">
          <h2 id="owners-modal-title" className="owners-modal__title">
            Titulares
          </h2>
          <button
            type="button"
            className="owners-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <p className="owners-modal__subtitle">{propertyName}</p>

        {error && (
          <div className="owners-modal__error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>Não foi possível carregar os titulares.</span>
          </div>
        )}

        {isLoading ? (
          <div className="owners-modal__skeleton" aria-busy="true">
            {[1, 2].map((i) => (
              <div key={i} className="owners-modal__skeleton-item" />
            ))}
          </div>
        ) : owners.length === 0 ? (
          <div className="owners-modal__empty">
            <Users size={40} aria-hidden="true" />
            <p className="owners-modal__empty-text">Nenhum titular cadastrado para este imóvel.</p>
          </div>
        ) : (
          <ul className="owners-modal__list">
            {owners.map((owner) => {
              const typeLabel =
                OWNER_TYPES.find((t) => t.value === owner.ownerType)?.label || owner.ownerType;
              return (
                <li key={owner.id} className="owners-modal__item">
                  <div className="owners-modal__item-icon">
                    <User size={18} aria-hidden="true" />
                  </div>
                  <div className="owners-modal__item-info">
                    <span className="owners-modal__item-name">{owner.name}</span>
                    <div className="owners-modal__item-details">
                      <span className="owners-modal__item-badge">{typeLabel}</span>
                      {owner.document && (
                        <span>
                          {owner.documentType || 'Doc'}: {owner.document}
                        </span>
                      )}
                      {owner.fractionPct != null && (
                        <span className="owners-modal__item-fraction">{owner.fractionPct}%</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
