import { useState } from 'react';
import { Plus, HeartPulse, AlertCircle, Download } from 'lucide-react';
import { useAnimalHealth } from '@/hooks/useAnimalHealth';
import { api } from '@/services/api';
import type { HealthRecordItem, HealthEventType } from '@/types/animal';
import { HEALTH_EVENT_TYPE_LABELS } from '@/types/animal';
import SanitaryStatsCards from './SanitaryStatsCards';
import SanitaryRecordsList from './SanitaryRecordsList';
import CreateSanitaryModal from './CreateSanitaryModal';
import './SanitaryTab.css';

interface SanitaryTabProps {
  farmId: string;
  animalId: string;
  animalEarTag: string;
}

const EVENT_TYPES: HealthEventType[] = ['VACCINATION', 'DEWORMING', 'TREATMENT', 'EXAM'];

function SanitaryTab({ farmId, animalId, animalEarTag }: SanitaryTabProps) {
  const [typeFilter, setTypeFilter] = useState<HealthEventType | null>(null);
  const { records, stats, isLoading, error, refetch, createRecord, updateRecord, deleteRecord } =
    useAnimalHealth(farmId, animalId, typeFilter);

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecordItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  function handleEdit(record: HealthRecordItem) {
    setEditingRecord(record);
    setShowModal(true);
  }

  async function handleDelete(recordId: string) {
    if (!confirm('Deseja realmente excluir este registro sanitário?')) return;
    try {
      await deleteRecord(recordId);
      showToast('success', 'Registro sanitário excluído com sucesso');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao excluir registro');
    }
  }

  async function handleSubmit(data: Parameters<typeof createRecord>[0]) {
    if (editingRecord) {
      await updateRecord(editingRecord.id, data);
      showToast('success', 'Registro sanitário atualizado com sucesso');
    } else {
      await createRecord(data);
      showToast('success', 'Registro sanitário adicionado com sucesso');
    }
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingRecord(null);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const blob = await api.getBlob(`/org/farms/${farmId}/animals/${animalId}/health/export`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sanitario-${animalEarTag}.csv`;
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
      <div className="sanitary-tab" aria-live="polite">
        <div className="sanitary-tab__skeleton-stats">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="sanitary-tab__skeleton-card" />
          ))}
        </div>
        <div className="sanitary-tab__skeleton-list" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="sanitary-tab">
        <div className="sanitary-tab__error" role="alert" aria-live="polite">
          <div className="sanitary-tab__error-message">
            <AlertCircle aria-hidden="true" size={20} />
            {error}
          </div>
          <button type="button" className="sanitary-tab__retry-btn" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const hasRecords = records.length > 0;
  const hasAnyRecords = stats != null && stats.totalRecords > 0;

  return (
    <div className="sanitary-tab">
      {toast && (
        <div
          className={`sanitary-tab__toast sanitary-tab__toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      <div className="sanitary-tab__header">
        <h2 className="sanitary-tab__title">Histórico Sanitário</h2>
        <div className="sanitary-tab__actions">
          <div className="sanitary-tab__filter">
            <label htmlFor="sanitary-type-filter" className="sr-only">
              Filtrar por tipo
            </label>
            <select
              id="sanitary-type-filter"
              className="sanitary-tab__filter-select"
              value={typeFilter ?? ''}
              onChange={(e) => setTypeFilter((e.target.value as HealthEventType) || null)}
            >
              <option value="">Todos os tipos</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {HEALTH_EVENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {hasAnyRecords && (
            <button
              type="button"
              className="sanitary-tab__export-btn"
              onClick={() => void handleExport()}
              disabled={isExporting}
              aria-label="Exportar histórico sanitário em CSV"
            >
              <Download size={16} aria-hidden="true" />
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
          )}
          <button
            type="button"
            className="sanitary-tab__add-btn"
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
          <SanitaryStatsCards stats={stats} />
          {hasRecords ? (
            <SanitaryRecordsList
              records={records}
              onEdit={handleEdit}
              onDelete={(id) => void handleDelete(id)}
            />
          ) : (
            <div className="sanitary-tab__empty-filter">
              <p className="sanitary-tab__empty-filter-text">
                Nenhum registro encontrado para o filtro selecionado.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="sanitary-tab__empty">
          <HeartPulse size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h3 className="sanitary-tab__empty-title">Nenhum registro sanitário</h3>
          <p className="sanitary-tab__empty-desc">
            Registre vacinas, vermifugações, tratamentos e exames para acompanhar a saúde do animal.
          </p>
        </div>
      )}

      <CreateSanitaryModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        editingRecord={editingRecord}
      />
    </div>
  );
}

export default SanitaryTab;
