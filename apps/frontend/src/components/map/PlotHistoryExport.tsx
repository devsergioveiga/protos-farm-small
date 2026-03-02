import { useState } from 'react';
import { Download, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import './PlotHistoryExport.css';

interface PlotHistoryExportProps {
  farmId: string;
  plotId: string;
}

function PlotHistoryExport({ farmId, plotId }: PlotHistoryExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const blob = await api.getBlob(
        `/org/farms/${farmId}/plots/${plotId}/history/export?format=csv`,
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historico-talhao-${plotId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao exportar';
      setError(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="history-export">
      <p className="history-export__description">
        Exporta safras e análises de solo em formato CSV, compatível com Excel.
      </p>

      <button
        type="button"
        className="history-export__btn"
        onClick={() => void handleExport()}
        disabled={isExporting}
        aria-busy={isExporting}
      >
        <Download size={20} aria-hidden="true" />
        {isExporting ? 'Exportando...' : 'Exportar CSV'}
      </button>

      {error && (
        <div className="history-export__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default PlotHistoryExport;
