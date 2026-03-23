import './TCOFleetView.css';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TCOFleetViewProps {
  data: {
    assetId: string;
    assetName: string;
    assetTag: string;
    assetType: string;
    acquisitionValue: number;
    accumulatedDepreciation: number;
    maintenanceCost: number;
    fuelCost: number;
    totalCost: number;
    repairRatio: number | null;
    alert: 'OK' | 'MONITOR' | 'REPLACE' | 'NO_DATA';
    costPerHour: number | null;
  }[];
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function TCOFleetView({ data }: TCOFleetViewProps) {
  // Stub — will be fully implemented in Task 3
  void data;
  return (
    <div className="tco-fleet">
      <div className="tco-fleet__table" />
    </div>
  );
}
