// Stub — replaced in Task 2
import type { AssetType } from '@/types/asset';

interface AssetFuelTabProps {
  assetId: string;
  assetType: AssetType;
}

export default function AssetFuelTab(props: AssetFuelTabProps) {
  if (!props.assetId) return null;
  return <div className="fuel-tab__loading">Carregando...</div>;
}
