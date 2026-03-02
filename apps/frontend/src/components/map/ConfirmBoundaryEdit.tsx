import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatArea } from './FarmMap';
import './ConfirmBoundaryEdit.css';

interface ConfirmBoundaryEditProps {
  previousAreaHa: number;
  newAreaHa: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmBoundaryEdit({
  previousAreaHa,
  newAreaHa,
  onConfirm,
  onCancel,
}: ConfirmBoundaryEditProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const diffHa = newAreaHa - previousAreaHa;
  const diffPct = previousAreaHa > 0 ? (diffHa / previousAreaHa) * 100 : 0;
  const isLargeDiff = Math.abs(diffPct) > 10;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      // Focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onCancel],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    confirmBtnRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="confirm-boundary__overlay" role="presentation" onClick={onCancel}>
      <div
        className="confirm-boundary__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-boundary-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-boundary-title" className="confirm-boundary__title">
          Confirmar alteração de perímetro
        </h2>

        <div className="confirm-boundary__comparison">
          <div className="confirm-boundary__row">
            <span className="confirm-boundary__label">Área anterior</span>
            <span className="confirm-boundary__value">{formatArea(previousAreaHa)}</span>
          </div>
          <div className="confirm-boundary__row">
            <span className="confirm-boundary__label">Área nova</span>
            <span className="confirm-boundary__value confirm-boundary__value--highlight">
              {formatArea(newAreaHa)}
            </span>
          </div>
          <div className="confirm-boundary__row confirm-boundary__row--diff">
            <span className="confirm-boundary__label">Diferença</span>
            <span className="confirm-boundary__value">
              {diffHa >= 0 ? '+' : ''}
              {formatArea(Math.abs(diffHa))} ({diffHa >= 0 ? '+' : ''}
              {diffPct.toFixed(1)}%)
            </span>
          </div>
        </div>

        {isLargeDiff && (
          <div className="confirm-boundary__warning" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <span>Variação superior a 10%. Verifique se a edição está correta.</span>
          </div>
        )}

        <div className="confirm-boundary__actions">
          <button
            type="button"
            className="confirm-boundary__btn confirm-boundary__btn--cancel"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="confirm-boundary__btn confirm-boundary__btn--confirm"
            onClick={onConfirm}
            ref={confirmBtnRef}
          >
            Confirmar alteração
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmBoundaryEdit;
