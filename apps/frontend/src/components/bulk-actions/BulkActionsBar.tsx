import { X, ArrowRightLeft, Syringe } from 'lucide-react';
import './BulkActionsBar.css';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMoveToLot: () => void;
  onRegisterHealthEvent: () => void;
}

function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onMoveToLot,
  onRegisterHealthEvent,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-bar" role="toolbar" aria-label="Ações em lote">
      <div className="bulk-bar__info">
        <strong>{selectedCount}</strong> animal(is) selecionado(s)
        <button
          type="button"
          className="bulk-bar__clear"
          onClick={onClearSelection}
          aria-label="Limpar seleção"
        >
          <X aria-hidden="true" size={16} />
          Limpar
        </button>
      </div>
      <div className="bulk-bar__actions">
        <button type="button" className="bulk-bar__btn" onClick={onMoveToLot}>
          <ArrowRightLeft aria-hidden="true" size={18} />
          Mover para lote
        </button>
        <button type="button" className="bulk-bar__btn" onClick={onRegisterHealthEvent}>
          <Syringe aria-hidden="true" size={18} />
          Registrar evento sanitário
        </button>
      </div>
    </div>
  );
}

export default BulkActionsBar;
