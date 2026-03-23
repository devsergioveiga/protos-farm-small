import { useState } from 'react';
import { CheckCircle, XCircle, FileText, AlertTriangle } from 'lucide-react';
import type { AnimalBulkImportResult } from '@/types/animal';
import './AnimalBulkImportModal.css';

interface AnimalBulkImportReportProps {
  result: AnimalBulkImportResult;
  onClose: () => void;
}

type FilterTab = 'all' | 'skipped' | 'imported';

function AnimalBulkImportReport({ result, onClose }: AnimalBulkImportReportProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>(result.skipped > 0 ? 'skipped' : 'all');

  const skippedItems = result.items.filter((i) => i.status === 'skipped');
  const importedItems = result.items.filter((i) => i.status === 'imported');

  const filteredItems =
    activeTab === 'skipped'
      ? skippedItems
      : activeTab === 'imported'
        ? importedItems
        : [...skippedItems, ...importedItems];

  return (
    <div className="bulk-report">
      <div className="bulk-report__summary">
        <FileText size={48} aria-hidden="true" className="bulk-report__icon" />
        <h3 className="bulk-report__title">Importação concluída</h3>
        <div className="bulk-report__counts">
          <div className="bulk-report__count bulk-report__count--imported">
            <CheckCircle size={20} aria-hidden="true" />
            <span>{result.imported} animais importados</span>
          </div>
          {result.skipped > 0 && (
            <div className="bulk-report__count bulk-report__count--skipped">
              <XCircle size={20} aria-hidden="true" />
              <span>{result.skipped} animais ignorados</span>
            </div>
          )}
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="bulk-report__warnings">
          <h4 className="bulk-report__details-title">Avisos</h4>
          <ul className="bulk-report__warning-list">
            {result.warnings.map((w, i) => (
              <li key={i} className="bulk-report__warning-item">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.items.length > 0 && (
        <div className="bulk-report__details">
          <div className="bulk-report__tabs" role="tablist" aria-label="Filtrar resultados">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'all'}
              className={`bulk-report__tab ${activeTab === 'all' ? 'bulk-report__tab--active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Todos ({result.items.length})
            </button>
            {skippedItems.length > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'skipped'}
                className={`bulk-report__tab bulk-report__tab--skipped ${activeTab === 'skipped' ? 'bulk-report__tab--active' : ''}`}
                onClick={() => setActiveTab('skipped')}
              >
                <AlertTriangle size={14} aria-hidden="true" />
                Ignorados ({skippedItems.length})
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'imported'}
              className={`bulk-report__tab ${activeTab === 'imported' ? 'bulk-report__tab--active' : ''}`}
              onClick={() => setActiveTab('imported')}
            >
              Importados ({importedItems.length})
            </button>
          </div>

          <div className="bulk-report__list" role="tabpanel">
            {filteredItems.map((item) => (
              <div
                key={`${item.status}-${item.index}`}
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
                    {item.earTag ?? `Linha ${item.index + 1}`}
                  </span>
                  {item.status === 'skipped' && item.reason && (
                    <span className="bulk-report__item-reason">{item.reason}</span>
                  )}
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <p className="bulk-report__empty">Nenhum item nesta categoria.</p>
            )}
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

export default AnimalBulkImportReport;
