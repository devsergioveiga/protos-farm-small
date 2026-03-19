// Stub — replaced in Task 2
import type { AssetType } from '@/types/asset';

interface AssetReadingsTabProps {
  assetId: string;
  assetType: AssetType;
}

export default function AssetReadingsTab(props: AssetReadingsTabProps) {
  if (!props.assetId) return null;
  return <div className="readings-tab__loading">Carregando...</div>;
}
