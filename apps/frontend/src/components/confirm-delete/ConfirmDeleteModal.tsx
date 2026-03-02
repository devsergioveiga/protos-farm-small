import { useState, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import './ConfirmDeleteModal.css';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  farmName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function ConfirmDeleteModal({
  isOpen,
  farmName,
  onConfirm,
  onCancel,
  isDeleting,
}: ConfirmDeleteModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isMatch = confirmInput.toLowerCase() === farmName.toLowerCase();

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'input, button:not([disabled])',
        );
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
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="confirm-delete-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="confirm-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-description"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-delete-modal__icon">
          <AlertTriangle size={32} aria-hidden="true" />
        </div>

        <h2 id="confirm-delete-title" className="confirm-delete-modal__title">
          Excluir fazenda
        </h2>

        <p id="confirm-delete-description" className="confirm-delete-modal__description">
          Esta ação não pode ser desfeita. Todos os dados da fazenda serão marcados como excluídos.
          Digite o nome da fazenda para confirmar.
        </p>

        <div className="confirm-delete-modal__field">
          <label htmlFor="confirm-farm-name" className="confirm-delete-modal__label">
            Nome da fazenda *
          </label>
          <input
            ref={inputRef}
            id="confirm-farm-name"
            type="text"
            className="confirm-delete-modal__input"
            placeholder={farmName}
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            aria-required="true"
            disabled={isDeleting}
          />
          <span className="confirm-delete-modal__hint">
            Digite <strong>{farmName}</strong> para confirmar
          </span>
        </div>

        <div className="confirm-delete-modal__actions">
          <button
            type="button"
            className="confirm-delete-modal__btn confirm-delete-modal__btn--cancel"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="confirm-delete-modal__btn confirm-delete-modal__btn--delete"
            onClick={onConfirm}
            disabled={!isMatch || isDeleting}
            aria-disabled={!isMatch || isDeleting}
          >
            {isDeleting ? 'Excluindo...' : 'Excluir fazenda'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
