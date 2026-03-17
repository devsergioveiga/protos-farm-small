import { useState, useRef, useCallback } from 'react';
import { X, Star, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSupplierRating } from '@/hooks/useSupplierRating';
import type { Supplier, SupplierRating } from '@/types/supplier';
import './SupplierRatingModal.css';

// ─── Props ────────────────────────────────────────────────────────────

interface SupplierRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier: Supplier;
}

// ─── Star selector ────────────────────────────────────────────────────

interface StarSelectorProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function StarSelector({ label, value, onChange }: StarSelectorProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="supplier-rating-modal__criterion">
      <span className="supplier-rating-modal__criterion-label">{label}</span>
      <div className="supplier-rating-modal__stars-row">
        <div role="radiogroup" aria-label={label} className="supplier-rating-modal__stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} estrelas`}
              className={`supplier-rating-modal__star-btn${
                n <= (hovered || value) ? ' supplier-rating-modal__star-btn--active' : ''
              }`}
              onClick={() => onChange(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
            >
              <Star
                size={24}
                aria-hidden="true"
                className={
                  n <= (hovered || value)
                    ? 'supplier-rating-modal__star supplier-rating-modal__star--filled'
                    : 'supplier-rating-modal__star supplier-rating-modal__star--empty'
                }
              />
            </button>
          ))}
        </div>
        {value > 0 && <span className="supplier-rating-modal__value">({value}/5)</span>}
      </div>
    </div>
  );
}

// ─── Mini star row (history) ──────────────────────────────────────────

function MiniStars({ label, value }: { label: string; value: number }) {
  return (
    <div className="supplier-rating-modal__history-criterion">
      <span className="supplier-rating-modal__history-criterion-label">{label}</span>
      <div className="supplier-rating-modal__history-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={12}
            aria-hidden="true"
            className={
              n <= Math.round(value)
                ? 'supplier-rating-modal__star supplier-rating-modal__star--filled'
                : 'supplier-rating-modal__star supplier-rating-modal__star--empty'
            }
          />
        ))}
        <span className="supplier-rating-modal__history-star-value">{value.toFixed(1)}</span>
      </div>
    </div>
  );
}

// ─── History item ─────────────────────────────────────────────────────

function HistoryItem({ rating }: { rating: SupplierRating }) {
  const date = new Date(rating.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <article className="supplier-rating-modal__history-item">
      <time className="supplier-rating-modal__history-date" dateTime={rating.createdAt}>
        {date}
      </time>
      <div className="supplier-rating-modal__history-criteria">
        <MiniStars label="Prazo de Entrega" value={rating.deadline} />
        <MiniStars label="Qualidade do Produto" value={rating.quality} />
        <MiniStars label="Preco" value={rating.price} />
        <MiniStars label="Atendimento" value={rating.service} />
      </div>
      {rating.comment && <p className="supplier-rating-modal__history-comment">{rating.comment}</p>}
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────

export default function SupplierRatingModal({
  isOpen,
  onClose,
  onSuccess,
  supplier,
}: SupplierRatingModalProps) {
  const [deadline, setDeadline] = useState(0);
  const [quality, setQuality] = useState(0);
  const [price, setPrice] = useState(0);
  const [service, setService] = useState(0);
  const [comment, setComment] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  const handleRatingSuccess = useCallback(() => {
    onSuccess();
  }, [onSuccess]);

  const { submitRating, getRatingHistory, ratings, isSubmitting, isLoadingRatings, error } =
    useSupplierRating(handleRatingSuccess);

  const allCriteriaFilled = deadline > 0 && quality > 0 && price > 0 && service > 0;

  function resetForm() {
    setDeadline(0);
    setQuality(0);
    setPrice(0);
    setService(0);
    setComment('');
    setShowHistory(false);
  }

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allCriteriaFilled) return;
    await submitRating(supplier.id, {
      deadline,
      quality,
      price,
      service,
      comment: comment.trim() || undefined,
    });
    if (!error) {
      resetForm();
    }
  }

  async function handleToggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next && ratings.length === 0) {
      await getRatingHistory(supplier.id);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="supplier-rating-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="supplier-rating-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
        ref={modalRef}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="supplier-rating-modal__header">
          <div>
            <h2 id="rating-modal-title" className="supplier-rating-modal__title">
              Avaliar Fornecedor
            </h2>
            <p className="supplier-rating-modal__supplier-name">{supplier.name}</p>
          </div>
          <button
            type="button"
            className="supplier-rating-modal__close-btn"
            onClick={handleClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <form
          id="supplier-rating-form"
          className="supplier-rating-modal__body"
          onSubmit={(e) => void handleSubmit(e)}
        >
          {/* Criteria */}
          <StarSelector label="Prazo de Entrega" value={deadline} onChange={setDeadline} />
          <StarSelector label="Qualidade do Produto" value={quality} onChange={setQuality} />
          <StarSelector label="Preco" value={price} onChange={setPrice} />
          <StarSelector label="Atendimento" value={service} onChange={setService} />

          {/* Comment */}
          <div className="supplier-rating-modal__field">
            <label htmlFor="rating-comment" className="supplier-rating-modal__label">
              Comentario (opcional)
            </label>
            <textarea
              id="rating-comment"
              className="supplier-rating-modal__textarea"
              rows={3}
              placeholder="Descreva sua experiencia com este fornecedor"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="supplier-rating-modal__error" role="alert">
              {error}
            </div>
          )}

          {/* History toggle */}
          <div className="supplier-rating-modal__history-toggle-row">
            <button
              type="button"
              className="supplier-rating-modal__history-toggle"
              onClick={() => void handleToggleHistory()}
              aria-expanded={showHistory}
            >
              Ver historico de avaliacoes
              {showHistory ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </button>
          </div>

          {/* History list */}
          {showHistory && (
            <div className="supplier-rating-modal__history" aria-live="polite">
              {isLoadingRatings && (
                <div className="supplier-rating-modal__history-loading">
                  <Loader2
                    size={20}
                    className="supplier-rating-modal__spinner"
                    aria-hidden="true"
                  />
                  Carregando historico...
                </div>
              )}
              {!isLoadingRatings && ratings.length === 0 && (
                <p className="supplier-rating-modal__history-empty">
                  Nenhuma avaliacao registrada ainda.
                </p>
              )}
              {!isLoadingRatings && ratings.length > 0 && (
                <ul
                  className="supplier-rating-modal__history-list"
                  aria-label="Historico de avaliacoes"
                >
                  {ratings.map((r) => (
                    <li key={r.id}>
                      <HistoryItem rating={r} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="supplier-rating-modal__footer">
          <button type="button" className="supplier-rating-modal__cancel-btn" onClick={handleClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="supplier-rating-form"
            className="supplier-rating-modal__submit-btn"
            disabled={!allCriteriaFilled || isSubmitting}
            aria-disabled={!allCriteriaFilled || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2
                  size={16}
                  className="supplier-rating-modal__btn-spinner"
                  aria-hidden="true"
                />
                Registrando...
              </>
            ) : (
              'Registrar Avaliacao'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
