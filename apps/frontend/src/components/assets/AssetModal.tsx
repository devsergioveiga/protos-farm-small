// Stub — full implementation is in Task 3
// This file intentionally left minimal until Task 3 fills it in.
import type { Asset } from '@/types/asset';

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset?: Asset;
}

export default function AssetModal(props: AssetModalProps) {
  if (!props.isOpen) return null;
  return null;
}
