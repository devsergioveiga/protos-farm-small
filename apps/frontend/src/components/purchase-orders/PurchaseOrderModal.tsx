// Placeholder — full implementation in Task 2
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
export default function PurchaseOrderModal({ isOpen, onClose, onSuccess }: Props) {
  if (!isOpen) return null;
  void onSuccess;
  return (
    <div onClick={onClose} style={{ display: 'none' }}>
      Pedido Emergencial
    </div>
  );
}
