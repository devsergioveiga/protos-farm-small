import { useEffect, useState } from 'react';
import { Package, UserRound, AlertCircle } from 'lucide-react';
import { useEpiDeliveries } from '@/hooks/useEpiDeliveries';
import { DELIVERY_REASON_LABELS } from '@/types/epi';
import ConfirmModal from '@/components/ui/ConfirmModal';
import './EpiDeliveriesPage.css';

type TabKey = 'entregas' | 'ficha';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function EpiDeliveriesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('entregas');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { deliveries, loading, error, fetchEpiDeliveries, deleteEpiDelivery } = useEpiDeliveries();

  useEffect(() => {
    void fetchEpiDeliveries();
  }, [fetchEpiDeliveries]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const ok = await deleteEpiDelivery(deleteId);
    setDeleting(false);
    if (ok) {
      setDeleteId(null);
      void fetchEpiDeliveries();
    }
  };

  const items = deliveries?.data ?? [];
  const isEmpty = !loading && items.length === 0;

  return (
    <main className="epi-deliveries-page">
      <header className="epi-deliveries-page__header">
        <h1 className="epi-deliveries-page__title">
          <Package size={24} aria-hidden="true" />
          Entregas de EPI
        </h1>
        <button type="button" className="epi-deliveries-page__cta">
          Registrar Entrega
        </button>
      </header>

      <div className="epi-deliveries-page__tabs" role="tablist" aria-label="Seções de entregas">
        <button
          role="tab"
          aria-selected={activeTab === 'entregas'}
          className={`epi-deliveries-page__tab ${activeTab === 'entregas' ? 'epi-deliveries-page__tab--active' : ''}`}
          onClick={() => setActiveTab('entregas')}
          type="button"
        >
          Entregas
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'ficha'}
          className={`epi-deliveries-page__tab ${activeTab === 'ficha' ? 'epi-deliveries-page__tab--active' : ''}`}
          onClick={() => setActiveTab('ficha')}
          type="button"
        >
          Ficha por Colaborador
        </button>
      </div>

      {activeTab === 'entregas' && (
        <section aria-label="Entregas de EPI">
          {error && (
            <div className="epi-deliveries-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {loading && (
            <div
              className="epi-deliveries-page__skeleton"
              aria-busy="true"
              aria-label="Carregando"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="epi-deliveries-page__skeleton-row" />
              ))}
            </div>
          )}

          {isEmpty && (
            <div className="epi-deliveries-page__empty">
              <Package size={48} aria-hidden="true" className="epi-deliveries-page__empty-icon" />
              <p className="epi-deliveries-page__empty-title">Nenhuma entrega registrada</p>
              <p className="epi-deliveries-page__empty-body">
                Registre a primeira entrega de EPI para um colaborador.
              </p>
              <button type="button" className="epi-deliveries-page__cta">
                Registrar Entrega
              </button>
            </div>
          )}

          {!loading && !isEmpty && (
            <div className="epi-deliveries-page__table-wrap">
              <table className="epi-deliveries-page__table">
                <thead>
                  <tr>
                    <th scope="col">DATA</th>
                    <th scope="col">COLABORADOR</th>
                    <th scope="col">FUNÇÃO</th>
                    <th scope="col">EPI ENTREGUE</th>
                    <th scope="col">Nº CA</th>
                    <th scope="col">MOTIVO</th>
                    <th scope="col">QTDE</th>
                    <th scope="col">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.date)}</td>
                      <td>{item.employeeName}</td>
                      <td>{item.employeePosition ?? '—'}</td>
                      <td>{item.epiProductName}</td>
                      <td className="epi-deliveries-page__mono">{item.caNumber}</td>
                      <td>{DELIVERY_REASON_LABELS[item.reason] ?? item.reason}</td>
                      <td>{item.quantity}</td>
                      <td>
                        <button
                          type="button"
                          aria-label={`Excluir entrega de ${item.epiProductName}`}
                          className="epi-deliveries-page__action-btn epi-deliveries-page__action-btn--danger"
                          onClick={() => setDeleteId(item.id)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'ficha' && (
        <section aria-label="Ficha por Colaborador">
          <div className="epi-deliveries-page__empty">
            <UserRound
              size={48}
              aria-hidden="true"
              className="epi-deliveries-page__empty-icon"
            />
            <p className="epi-deliveries-page__empty-title">
              Selecione um colaborador para visualizar a ficha de EPI.
            </p>
          </div>
        </section>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir entrega"
        message="Excluir entrega: Esta ação irá restaurar o saldo de estoque do EPI. Confirmar exclusão?"
        variant="warning"
        confirmLabel="Excluir"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </main>
  );
}
