// Placeholder — full implementation in Task 2 of plan 11-05
export interface GoodsReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function GoodsReturnModal(props: GoodsReturnModalProps): null {
  return props.isOpen ? null : null;
}

export default GoodsReturnModal;
