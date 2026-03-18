// Placeholder — QuotationDetailModal referenced by QuotationsPage
// Full implementation deferred; this stub satisfies TypeScript import
interface Props {
  isOpen: boolean;
  quotationId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}
export default function QuotationDetailModal({ isOpen, quotationId, onClose, onUpdate }: Props) {
  if (!isOpen) return null;
  void quotationId;
  void onUpdate;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes da cotacao"
      onClick={onClose}
      style={{ display: 'none' }}
    />
  );
}
