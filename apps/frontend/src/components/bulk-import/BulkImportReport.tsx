import { CheckCircle, XCircle, FileText } from 'lucide-react';
import type { BulkImportResult } from '@/types/farm';
import './BulkImportModal.css';

interface BulkImportReportProps {
  result: BulkImportResult;
  onClose: () => void;
}

function BulkImportReport({ result, onClose }: BulkImportReportProps) {
  return (
    <div className="bulk-report">
      <div className="bulk-report__summary">
        <FileText size={48} aria-hidden="true" className="bulk-report__icon" />
        <h3 className="bulk-report__title">Importação concluída</h3>
        <div className="bulk-report__counts">
          <div className="bulk-report__count bulk-report__count--imported">
            <CheckCircle size={20} aria-hidden="true" />
            <span>{result.imported} talhões importados</span>
          </div>
          {result.skipped > 0 && (
            <div className="bulk-report__count bulk-report__count--skipped">
              <XCircle size={20} aria-hidden="true" />
              <span>{result.skipped} talhões ignorados</span>
            </div>
          )}
        </div>
      </div>

      {result.items.length > 0 && (
        <div className="bulk-report__details">
          <h4 className="bulk-report__details-title">Detalhes</h4>
          <div className="bulk-report__list">
            {result.items.map((item) => (
              <div
                key={item.index}
                className={`bulk-report__item ${item.status === 'skipped' ? 'bulk-report__item--skipped' : ''}`}
              >
                <div className="bulk-report__item-status">
                  {item.status === 'imported' ? (
                    <CheckCircle
                      size={16}
                      aria-hidden="true"
                      className="bulk-report__item-icon--imported"
                    />
                  ) : (
                    <XCircle
                      size={16}
                      aria-hidden="true"
                      className="bulk-report__item-icon--skipped"
                    />
                  )}
                </div>
                <div className="bulk-report__item-info">
                  <span className="bulk-report__item-name">
                    {item.name ?? `Feature ${item.index}`}
                  </span>
                  {item.status === 'imported' && item.areaHa != null && (
                    <span className="bulk-report__item-area">{item.areaHa.toFixed(2)} ha</span>
                  )}
                  {item.status === 'skipped' && item.reason && (
                    <span className="bulk-report__item-reason">{item.reason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bulk-report__footer">
        <button type="button" className="bulk-report__close-btn" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

export default BulkImportReport;
