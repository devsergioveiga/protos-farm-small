import { useState, useEffect } from 'react';
import { Plus, Heart, AlertCircle, Download } from 'lucide-react';
import { useAnimalReproductive } from '@/hooks/useAnimalReproductive';
import { api } from '@/services/api';
import type { ReproductiveRecordItem, ReproductiveEventType, AnimalListItem } from '@/types/animal';
import { REPRODUCTIVE_EVENT_TYPE_LABELS } from '@/types/animal';
import ReproductiveStatsCards from './ReproductiveStatsCards';
import ReproductiveRecordsList from './ReproductiveRecordsList';
import CreateReproductiveModal from './CreateReproductiveModal';
import './ReproductiveTab.css';

interface ReproductiveTabProps {
  farmId: string;
  animalId: string;
  animalEarTag: string;
}

const EVENT_TYPES: ReproductiveEventType[] = [
  'CLEARANCE',
  'HEAT',
  'BREEDING_PLAN',
  'AI',
  'PREGNANCY',
  'CALVING',
];

function ReproductiveTab({ farmId, animalId, animalEarTag }: ReproductiveTabProps) {
  const [typeFilter, setTypeFilter] = useState<ReproductiveEventType | null>(null);
  const { records, stats, isLoading, error, refetch, createRecord, updateRecord, deleteRecord } =
    useAnimalReproductive(farmId, animalId, typeFilter);

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReproductiveRecordItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [males, setMales] = useState<Array<{ id: string; earTag: string; name: string | null }>>(
    [],
  );

  // Fetch male animals for sire selection
  useEffect(() => {
    if (!farmId) return;
    void api
      .get<{ data: AnimalListItem[] }>(`/org/farms/${farmId}/animals?sex=MALE&limit=100`)
      .then((res) => {
        setMales(res.data.map((a) => ({ id: a.id, earTag: a.earTag, name: a.name })));
      })
      .catch(() => {
        // Silently fail — sire selection will be empty
      });
  }, [farmId]);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  function handleEdit(record: ReproductiveRecordItem) {
    setEditingRecord(record);
    setShowModal(true);
  }

  async function handleDelete(recordId: string) {
    if (!confirm('Deseja realmente excluir este registro reprodutivo?')) return;
    try {
      await deleteRecord(recordId);
      showToast('success', 'Registro reprodutivo excluído com sucesso');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao excluir registro');
    }
  }

  async function handleSubmit(data: Parameters<typeof createRecord>[0]) {
    if (editingRecord) {
      await updateRecord(editingRecord.id, data);
      showToast('success', 'Registro reprodutivo atualizado com sucesso');
    } else {
      await createRecord(data);
      showToast('success', 'Registro reprodutivo adicionado com sucesso');
    }
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingRecord(null);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const blob = await api.getBlob(
        `/org/farms/${farmId}/animals/${animalId}/reproductive/export`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reprodutivo-${animalEarTag}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="repro-tab" aria-live="polite">
        <div className="repro-tab__skeleton-stats">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="repro-tab__skeleton-card" />
          ))}
        </div>
        <div className="repro-tab__skeleton-list" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="repro-tab">
        <div className="repro-tab__error" role="alert" aria-live="polite">
          <div className="repro-tab__error-message">
            <AlertCircle aria-hidden="true" size={20} />
            {error}
          </div>
          <button type="button" className="repro-tab__retry-btn" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const hasRecords = records.length > 0;
  const hasAnyRecords = stats != null && stats.totalRecords > 0;

  return (
    <div className="repro-tab">
      {toast && (
        <div
          className={`repro-tab__toast repro-tab__toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      <div className="repro-tab__header">
        <h2 className="repro-tab__title">Histórico Reprodutivo</h2>
        <div className="repro-tab__actions">
          <div className="repro-tab__filter">
            <label htmlFor="repro-type-filter" className="sr-only">
              Filtrar por tipo
            </label>
            <select
              id="repro-type-filter"
              className="repro-tab__filter-select"
              value={typeFilter ?? ''}
              onChange={(e) => setTypeFilter((e.target.value as ReproductiveEventType) || null)}
            >
              <option value="">Todos os tipos</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REPRODUCTIVE_EVENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {hasAnyRecords && (
            <button
              type="button"
              className="repro-tab__export-btn"
              onClick={() => void handleExport()}
              disabled={isExporting}
              aria-label="Exportar histórico reprodutivo em CSV"
            >
              <Download size={16} aria-hidden="true" />
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
          )}
          <button
            type="button"
            className="repro-tab__add-btn"
            onClick={() => {
              setEditingRecord(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Registrar evento
          </button>
        </div>
      </div>

      {hasAnyRecords && stats ? (
        <>
          <ReproductiveStatsCards stats={stats} />
          {hasRecords ? (
            <ReproductiveRecordsList
              records={records}
              onEdit={handleEdit}
              onDelete={(id) => void handleDelete(id)}
            />
          ) : (
            <div className="repro-tab__empty-filter">
              <p className="repro-tab__empty-filter-text">
                Nenhum registro encontrado para o filtro selecionado.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="repro-tab__empty">
          <Heart size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h3 className="repro-tab__empty-title">Nenhum registro reprodutivo</h3>
          <p className="repro-tab__empty-desc">
            Registre liberações, cios, inseminações, gestações e partos para acompanhar a vida
            reprodutiva do animal.
          </p>
        </div>
      )}

      <CreateReproductiveModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        editingRecord={editingRecord}
        males={males}
      />
    </div>
  );
}

export default ReproductiveTab;
