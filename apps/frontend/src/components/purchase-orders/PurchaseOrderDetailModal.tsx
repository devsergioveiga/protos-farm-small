// Placeholder — full implementation in Task 2
interface Props {
  isOpen: boolean;
  purchaseOrderId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}
export default function PurchaseOrderDetailModal({
  isOpen,
  purchaseOrderId,
  onClose,
  onUpdate,
}: Props) {
  if (!isOpen) return null;
  void purchaseOrderId;
  void onUpdate;
  return (
    <div onClick={onClose} style={{ display: 'none' }}>
      Detail
    </div>
  );
}
