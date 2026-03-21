import { X, ArrowRightLeft, Syringe, UserCheck, LogOut } from 'lucide-react';
import './BulkActionsBar.css';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMoveToLot: () => void;
  onRegisterHealthEvent: () => void;
  onAssignOwner?: () => void;
  onRegisterExit?: () => void;
}

function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onMoveToLot,
  onRegisterHealthEvent,
  onAssignOwner,
  onRegisterExit,
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
        {onAssignOwner && (
          <button type="button" className="bulk-bar__btn" onClick={onAssignOwner}>
            <UserCheck aria-hidden="true" size={18} />
            Vincular proprietário
          </button>
        )}
        {onRegisterExit && (
          <button type="button" className="bulk-bar__btn bulk-bar__btn--danger" onClick={onRegisterExit}>
            <LogOut aria-hidden="true" size={18} />
            Registrar saída
          </button>
        )}
      </div>
    </div>
  );
}

export default BulkActionsBar;
