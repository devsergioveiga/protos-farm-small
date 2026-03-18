import { useState, useEffect } from 'react';
import { X, AlertCircle, Download } from 'lucide-react';
import { api } from '@/services/api';
import type { VaccinationReport } from '@/types/vaccination';
import './CampaignReportModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  campaignId: string;
}

export default function CampaignReportModal({ isOpen, onClose, farmId, campaignId }: Props) {
  const [report, setReport] = useState<VaccinationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isOpen || !campaignId) return;
    setIsLoading(true);
    setError(null);

    api
      .get<VaccinationReport>(`/org/farms/${farmId}/vaccinations/campaigns/${campaignId}`)
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
        `/org/farms/${farmId}/vaccinations/campaigns/${campaignId}/export`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campanha-${campaignId.slice(0, 8)}.csv`;
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
    <div className="campaign-modal__overlay" onClick={onClose}>
      <div
        className="campaign-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-modal-title"
      >
        <header className="campaign-modal__header">
          <h2 id="campaign-modal-title">Relatório da campanha</h2>
          <button
            type="button"
            className="campaign-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="campaign-modal__body">
          {error && (
            <div className="campaign-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {isLoading && <div className="campaign-modal__loading">Carregando relatório...</div>}

          {report && (
            <>
              <div className="campaign-modal__summary">
                <div className="campaign-modal__summary-item">
                  <span className="campaign-modal__summary-label">VACINA</span>
                  <span className="campaign-modal__summary-value">{report.productName}</span>
                </div>
                <div className="campaign-modal__summary-item">
                  <span className="campaign-modal__summary-label">DATA</span>
                  <span className="campaign-modal__summary-value">
                    {new Date(report.vaccinationDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="campaign-modal__summary-item">
                  <span className="campaign-modal__summary-label">FAZENDA</span>
                  <span className="campaign-modal__summary-value">{report.farmName}</span>
                </div>
                <div className="campaign-modal__summary-item">
                  <span className="campaign-modal__summary-label">ANIMAIS</span>
                  <span className="campaign-modal__summary-value">{report.totalAnimals}</span>
                </div>
              </div>

              <div className="campaign-modal__table-wrap">
                <table className="campaign-modal__table">
                  <thead>
                    <tr>
                      <th scope="col">Brinco</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Categoria</th>
                      <th scope="col">Lote</th>
                      <th scope="col">Dose (mL)</th>
                      <th scope="col">Via</th>
                      <th scope="col">Nº dose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.animals.map((a) => (
                      <tr key={a.animalId}>
                        <td className="campaign-modal__mono">{a.animalEarTag}</td>
                        <td>{a.animalName || '—'}</td>
                        <td>{a.animalCategory}</td>
                        <td>{a.lotName || '—'}</td>
                        <td className="campaign-modal__mono">{a.dosageMl}</td>
                        <td>{a.administrationRoute}</td>
                        <td className="campaign-modal__mono">{a.doseNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <footer className="campaign-modal__footer">
          <button type="button" className="campaign-modal__btn-cancel" onClick={onClose}>
            Fechar
          </button>
          {report && (
            <button
              type="button"
              className="campaign-modal__btn-export"
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
