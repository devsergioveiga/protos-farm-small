import { useState, useEffect, useCallback } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import { useAssetInventory } from '@/hooks/useAssetInventory';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AssetInventoryModal from '@/components/assets/AssetInventoryModal';
import type { InventoryOutput, InventoryItemOutput, PhysicalStatus } from '@/types/asset';
import { PHYSICAL_STATUS_LABELS } from '@/types/asset';
import './AssetInventoryPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat('pt-BR');

function formatDate(iso: string): string {
  try {
    return dateFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const INVENTORY_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  COUNTING: 'Em contagem',
  RECONCILED: 'Conciliado',
  CANCELLED: 'Cancelado',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inv-page__status-badge inv-page__status-badge--${status.toLowerCase()}`}>
      {INVENTORY_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── AssetInventoryPage ────────────────────────────────────────────────────────

export default function AssetInventoryPage() {
  const {
    inventories,
    inventory,
    listInventories,
    getInventory,
    countItems,
    reconcileInventory,
    isLoading,
    error,
  } = useAssetInventory();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReconcileConfirm, setShowReconcileConfirm] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Editable item state for count
  const [editedItems, setEditedItems] = useState<
    Map<string, { physicalStatus: string; notes: string }>
  >(new Map());

  const loadList = useCallback(() => {
    void listInventories();
  }, [listInventories]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) {
      void getInventory(selectedId);
    }
  }, [selectedId, getInventory]);

  // Reset edited items when inventory changes
  useEffect(() => {
    if (inventory) {
      const map = new Map<string, { physicalStatus: string; notes: string }>();
      inventory.items.forEach((item) => {
        map.set(item.assetId, {
          physicalStatus: item.physicalStatus ?? '',
          notes: item.notes ?? '',
        });
      });
      setEditedItems(map);
    }
  }, [inventory]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function handleSelectInventory(inv: InventoryOutput) {
    setSelectedId(inv.id);
  }

  function handleItemPhysicalStatus(assetId: string, value: string) {
    setEditedItems((prev) => {
      const next = new Map(prev);
      const current = next.get(assetId) ?? { physicalStatus: '', notes: '' };
      next.set(assetId, { ...current, physicalStatus: value });
      return next;
    });
  }

  function handleItemNotes(assetId: string, value: string) {
    setEditedItems((prev) => {
      const next = new Map(prev);
      const current = next.get(assetId) ?? { physicalStatus: '', notes: '' };
      next.set(assetId, { ...current, notes: value });
      return next;
    });
  }

  async function handleSaveCount() {
    if (!selectedId || !inventory) return;
    setIsSaving(true);
    try {
      const items = inventory.items
        .map((item) => {
          const edited = editedItems.get(item.assetId);
          return {
            assetId: item.assetId,
            physicalStatus: edited?.physicalStatus ?? item.physicalStatus ?? '',
            notes: edited?.notes ?? item.notes ?? undefined,
          };
        })
        .filter((i) => i.physicalStatus !== '');

      await countItems(selectedId, items);
      setToast('Contagem salva com sucesso.');
      loadList();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Nao foi possivel salvar a contagem.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReconcile() {
    if (!selectedId) return;
    setIsReconciling(true);
    try {
      await reconcileInventory(selectedId);
      setShowReconcileConfirm(false);
      setToast('Inventario conciliado com sucesso.');
      loadList();
    } catch (err) {
      setShowReconcileConfirm(false);
      setToast(err instanceof Error ? err.message : 'Nao foi possivel conciliar o inventario.');
    } finally {
      setIsReconciling(false);
    }
  }

  const isEmpty = !isLoading && !error && inventories.length === 0;

  return (
    <main className="inv-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="inv-page__breadcrumb" aria-label="Caminho de navegacao">
        <span className="inv-page__breadcrumb-item">Inicio</span>
        <span className="inv-page__breadcrumb-sep" aria-hidden="true">
          &gt;
        </span>
        <span className="inv-page__breadcrumb-item">Patrimonio</span>
        <span className="inv-page__breadcrumb-sep" aria-hidden="true">
          &gt;
        </span>
        <span
          className="inv-page__breadcrumb-item inv-page__breadcrumb-item--current"
          aria-current="page"
        >
          Inventario Patrimonial
        </span>
      </nav>

      {/* Header */}
      <header className="inv-page__header">
        <h1 className="inv-page__title">Inventario Patrimonial</h1>
        <button
          type="button"
          className="inv-page__btn inv-page__btn--primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Novo Inventario
        </button>
      </header>

      {/* Error */}
      {error && !isLoading && (
        <div className="inv-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !inventories.length && (
        <div className="inv-page__skeleton" aria-label="Carregando inventarios" role="status">
          {[1, 2, 3].map((i) => (
            <div key={i} className="inv-page__skeleton-row" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="inv-page__empty">
          <Calendar size={64} aria-hidden="true" className="inv-page__empty-icon" />
          <h2 className="inv-page__empty-title">Nenhum inventario realizado</h2>
          <p className="inv-page__empty-desc">
            Crie o primeiro inventario para conciliar o patrimonio fisico com o contabil.
          </p>
          <button
            type="button"
            className="inv-page__btn inv-page__btn--primary"
            onClick={() => setShowCreateModal(true)}
          >
            + Criar primeiro inventario
          </button>
        </div>
      )}

      {/* Inventory list */}
      {!isLoading && inventories.length > 0 && (
        <section className="inv-page__content" aria-label="Lista de inventarios">
          {/* Desktop table */}
          <div className="inv-page__table-wrapper">
            <table className="inv-page__table">
              <caption className="sr-only">Lista de inventarios patrimoniais</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Fazenda</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="inv-page__th--right">
                    Total Ativos
                  </th>
                  <th scope="col" className="inv-page__th--right">
                    Contados
                  </th>
                  <th scope="col" className="inv-page__th--right">
                    Divergencias
                  </th>
                </tr>
              </thead>
              <tbody>
                {inventories.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`inv-page__tr inv-page__tr--clickable${selectedId === inv.id ? ' inv-page__tr--selected' : ''}`}
                    onClick={() => handleSelectInventory(inv)}
                    aria-label={`Ver detalhes do inventario de ${formatDate(inv.createdAt)}`}
                  >
                    <td className="inv-page__td">{formatDate(inv.createdAt)}</td>
                    <td className="inv-page__td">{inv.farmName ?? 'Todas as fazendas'}</td>
                    <td className="inv-page__td">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="inv-page__td inv-page__td--right">{inv.itemCount}</td>
                    <td className="inv-page__td inv-page__td--right">{inv.countedCount}</td>
                    <td className="inv-page__td inv-page__td--right">
                      {inv.divergenceCount > 0 ? (
                        <span className="inv-page__divergence-count">{inv.divergenceCount}</span>
                      ) : (
                        inv.divergenceCount
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="inv-page__cards">
            {inventories.map((inv) => (
              <article
                key={inv.id}
                className={`inv-page__card${selectedId === inv.id ? ' inv-page__card--selected' : ''}`}
                onClick={() => handleSelectInventory(inv)}
                style={{ cursor: 'pointer' }}
              >
                <div className="inv-page__card-header">
                  <span className="inv-page__card-date">{formatDate(inv.createdAt)}</span>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="inv-page__card-farm">{inv.farmName ?? 'Todas as fazendas'}</div>
                <div className="inv-page__card-counts">
                  <span>Ativos: {inv.itemCount}</span>
                  <span>Contados: {inv.countedCount}</span>
                  {inv.divergenceCount > 0 && (
                    <span className="inv-page__divergence-count">
                      Divergencias: {inv.divergenceCount}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Detail section */}
          {selectedId && inventory && (
            <section className="inv-page__detail" aria-label="Detalhes do inventario">
              <div className="inv-page__detail-header">
                <h2 className="inv-page__detail-title">
                  Inventario de {formatDate(inventory.createdAt)}
                  {inventory.farmName ? ` — ${inventory.farmName}` : ''}
                </h2>
                <div className="inv-page__detail-actions">
                  {(inventory.status === 'DRAFT' || inventory.status === 'COUNTING') && (
                    <button
                      type="button"
                      className="inv-page__btn inv-page__btn--secondary"
                      onClick={() => void handleSaveCount()}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Contagem'}
                    </button>
                  )}
                  {inventory.status === 'COUNTING' && (
                    <button
                      type="button"
                      className="inv-page__btn inv-page__btn--primary"
                      onClick={() => setShowReconcileConfirm(true)}
                    >
                      Conciliar
                    </button>
                  )}
                </div>
              </div>

              {/* Items table */}
              <div className="inv-page__items-wrapper">
                <table className="inv-page__items-table">
                  <caption className="sr-only">Itens do inventario</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tag</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Status Cadastral</th>
                      <th scope="col">Status Fisico</th>
                      <th scope="col">Observacoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.items.map((item: InventoryItemOutput) => {
                      const edited = editedItems.get(item.assetId);
                      const isEditable =
                        inventory.status === 'DRAFT' || inventory.status === 'COUNTING';

                      return (
                        <tr key={item.id}>
                          <td className="inv-page__td">
                            <span className="inv-page__asset-tag">{item.assetTag}</span>
                          </td>
                          <td className="inv-page__td">{item.assetName}</td>
                          <td className="inv-page__td">{item.assetType}</td>
                          <td className="inv-page__td">{item.registeredStatus}</td>
                          <td className="inv-page__td">
                            {isEditable ? (
                              <select
                                className="inv-page__status-select"
                                value={edited?.physicalStatus ?? item.physicalStatus ?? ''}
                                onChange={(e) =>
                                  handleItemPhysicalStatus(item.assetId, e.target.value)
                                }
                                aria-label={`Status fisico de ${item.assetName}`}
                              >
                                <option value="">Nao verificado</option>
                                {(
                                  Object.entries(PHYSICAL_STATUS_LABELS) as [
                                    PhysicalStatus,
                                    string,
                                  ][]
                                ).map(([val, label]) => (
                                  <option key={val} value={val}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              (item.physicalStatusLabel ?? '—')
                            )}
                          </td>
                          <td className="inv-page__td">
                            {isEditable ? (
                              <input
                                type="text"
                                className="inv-page__notes-input"
                                value={edited?.notes ?? item.notes ?? ''}
                                onChange={(e) => handleItemNotes(item.assetId, e.target.value)}
                                placeholder="Observacao..."
                                aria-label={`Observacao para ${item.assetName}`}
                              />
                            ) : (
                              (item.notes ?? '—')
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      )}

      {/* Create inventory modal */}
      <AssetInventoryModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(itemCount) => {
          setShowCreateModal(false);
          loadList();
          setToast(`Inventario criado com ${itemCount} ativos.`);
        }}
      />

      {/* Reconcile confirm */}
      <ConfirmModal
        isOpen={showReconcileConfirm}
        title="Conciliar inventario"
        message="Deseja conciliar este inventario? Os resultados serao finalizados e o status mudara para Conciliado."
        confirmLabel="Sim, conciliar"
        cancelLabel="Cancelar"
        variant="warning"
        isLoading={isReconciling}
        onConfirm={() => void handleReconcile()}
        onCancel={() => setShowReconcileConfirm(false)}
      />

      {/* Toast */}
      {toast && (
        <div className="inv-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
