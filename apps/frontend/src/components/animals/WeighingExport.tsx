import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '@/services/api';
import './WeighingExport.css';

interface WeighingExportProps {
  farmId: string;
  animalId: string;
  animalEarTag: string;
  disabled?: boolean;
}

function WeighingExport({ farmId, animalId, animalEarTag, disabled }: WeighingExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const blob = await api.getBlob(`/org/farms/${farmId}/animals/${animalId}/weighings/export`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pesagens-${animalEarTag}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — user will see no download
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      type="button"
      className="weighing-export__btn"
      onClick={() => void handleExport()}
      disabled={disabled || isExporting}
      aria-label="Exportar pesagens em CSV"
    >
      <Download size={16} aria-hidden="true" />
      {isExporting ? 'Exportando...' : 'Exportar CSV'}
    </button>
  );
}

export default WeighingExport;
