import { useState, useEffect } from 'react';
import { X, AlertCircle, Download } from 'lucide-react';
import { api } from '@/services/api';
import type { DewormingReport } from '@/types/deworming';
import './CampaignReportModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  campaignId: string;
}

export default function CampaignReportModal({ isOpen, onClose, farmId, campaignId }: Props) {
  const [report, setReport] = useState<DewormingReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isOpen || !campaignId) return;
    setIsLoading(true);
    setError(null);
    api
      .get<DewormingReport>(`/org/farms/${farmId}/dewormings/campaigns/${campaignId}`)
      .then((data) => setReport(data))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar relatório'),
      )
      .finally(() => setIsLoading(false));
  }, [isOpen, farmId, campaignId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.getBlob(
        `/org/farms/${farmId}/dewormings/campaigns/${campaignId}/export`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vermifugacao-${campaignId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar CSV');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dew-campaign-modal__overlay" onClick={onClose}>
      <div
        className="dew-campaign-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dew-campaign-modal-title"
      >
        <header className="dew-campaign-modal__header">
          <h2 id="dew-campaign-modal-title">Relatório da campanha</h2>
          <button
            type="button"
            className="dew-campaign-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="dew-campaign-modal__body">
          {error && (
            <div className="dew-campaign-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}
          {isLoading && <div className="dew-campaign-modal__loading">Carregando relatório...</div>}
          {report && (
            <>
              <div className="dew-campaign-modal__summary">
                <div className="dew-campaign-modal__summary-item">
                  <span className="dew-campaign-modal__summary-label">VERMÍFUGO</span>
                  <span className="dew-campaign-modal__summary-value">{report.productName}</span>
                </div>
                <div className="dew-campaign-modal__summary-item">
                  <span className="dew-campaign-modal__summary-label">DATA</span>
                  <span className="dew-campaign-modal__summary-value">
                    {new Date(report.dewormingDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="dew-campaign-modal__summary-item">
                  <span className="dew-campaign-modal__summary-label">FAZENDA</span>
                  <span className="dew-campaign-modal__summary-value">{report.farmName}</span>
                </div>
                <div className="dew-campaign-modal__summary-item">
                  <span className="dew-campaign-modal__summary-label">ANIMAIS</span>
                  <span className="dew-campaign-modal__summary-value">{report.totalAnimals}</span>
                </div>
              </div>
              <div className="dew-campaign-modal__table-wrap">
                <table className="dew-campaign-modal__table">
                  <thead>
                    <tr>
                      <th scope="col">Brinco</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Categoria</th>
                      <th scope="col">Lote</th>
                      <th scope="col">Dose (mL)</th>
                      <th scope="col">Via</th>
                      <th scope="col">OPG Pré</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.animals.map((a) => (
                      <tr key={a.animalId}>
                        <td className="dew-campaign-modal__mono">{a.animalEarTag}</td>
                        <td>{a.animalName || '—'}</td>
                        <td>{a.animalCategory}</td>
                        <td>{a.lotName || '—'}</td>
                        <td className="dew-campaign-modal__mono">{a.dosageMl}</td>
                        <td>{a.administrationRoute}</td>
                        <td className="dew-campaign-modal__mono">{a.opgPre ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <footer className="dew-campaign-modal__footer">
          <button type="button" className="dew-campaign-modal__btn-cancel" onClick={onClose}>
            Fechar
          </button>
          {report && (
            <button
              type="button"
              className="dew-campaign-modal__btn-export"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              <Download size={16} aria-hidden="true" />
              {exporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
