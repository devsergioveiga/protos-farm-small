import { useState } from 'react';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import {
  useRuralPropertyDetail,
  addPropertyOwner,
  updatePropertyOwner,
  deletePropertyOwner,
} from '../../hooks/useRuralProperties';
import type { PropertyOwner, CreateOwnerPayload } from '../../types/rural-property';
import { OWNER_TYPES } from '../../types/rural-property';

interface PropertyOwnersTableProps {
  farmId: string;
  propertyId: string;
}

interface OwnerFormState {
  name: string;
  document: string;
  documentType: string;
  fractionPct: string;
  ownerType: string;
}

const INITIAL_FORM: OwnerFormState = {
  name: '',
  document: '',
  documentType: 'CPF',
  fractionPct: '',
  ownerType: 'PROPRIETARIO',
};

export function PropertyOwnersTable({ farmId, propertyId }: PropertyOwnersTableProps) {
  const { property, refetch } = useRuralPropertyDetail({ farmId, propertyId });
  const owners = property?.owners ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OwnerFormState>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const handleEdit = (owner: PropertyOwner) => {
    setEditingId(owner.id);
    setForm({
      name: owner.name,
      document: owner.document || '',
      documentType: owner.documentType || 'CPF',
      fractionPct: owner.fractionPct != null ? String(owner.fractionPct) : '',
      ownerType: owner.ownerType,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  const handleDelete = async (ownerId: string) => {
    try {
      await deletePropertyOwner(farmId, propertyId, ownerId);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao remover titular');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Nome do titular é obrigatório');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload: CreateOwnerPayload = {
        name: form.name.trim(),
        document: form.document || undefined,
        documentType: form.documentType || undefined,
        fractionPct: form.fractionPct ? parseFloat(form.fractionPct) : undefined,
        ownerType: form.ownerType,
      };

      if (editingId) {
        await updatePropertyOwner(farmId, propertyId, editingId, payload);
      } else {
        await addPropertyOwner(farmId, propertyId, payload);
      }

      await refetch();
      handleCancel();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar titular');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="owners-table">
      <div className="owners-table__header">
        <h4 className="owners-table__title">Titulares do imóvel</h4>
        <button className="owners-table__add-btn" onClick={handleAdd} type="button">
          <Plus size={16} aria-hidden="true" /> Adicionar
        </button>
      </div>

      {owners.length === 0 && !showForm && (
        <p className="owners-table__empty">Nenhum titular cadastrado.</p>
      )}

      <ul className="owners-table__list">
        {owners.map((owner) => (
          <li key={owner.id} className="owners-table__item">
            <div className="owners-table__item-info">
              <span className="owners-table__item-name">{owner.name}</span>
              <span className="owners-table__item-detail">
                {owner.document && `${owner.documentType || 'Doc'}: ${owner.document}`}
                {owner.fractionPct != null && ` · ${owner.fractionPct}%`}
                {` · ${OWNER_TYPES.find((t) => t.value === owner.ownerType)?.label || owner.ownerType}`}
              </span>
            </div>
            <div className="owners-table__item-actions">
              <button
                className="owners-table__icon-btn"
                onClick={() => handleEdit(owner)}
                aria-label={`Editar ${owner.name}`}
                type="button"
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button
                className="owners-table__icon-btn owners-table__icon-btn--danger"
                onClick={() => handleDelete(owner.id)}
                aria-label={`Remover ${owner.name}`}
                type="button"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className="owner-form">
          <div className="rp-modal__field">
            <label className="rp-modal__label" htmlFor="owner-name">
              Nome *
            </label>
            <input
              id="owner-name"
              className="rp-modal__input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              aria-required="true"
            />
          </div>

          <div className="rp-modal__field">
            <label className="rp-modal__label" htmlFor="owner-doc-type">
              Tipo de documento
            </label>
            <select
              id="owner-doc-type"
              className="rp-modal__select"
              value={form.documentType}
              onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}
            >
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
            </select>
          </div>

          <div className="rp-modal__field">
            <label className="rp-modal__label" htmlFor="owner-doc">
              Documento
            </label>
            <input
              id="owner-doc"
              className="rp-modal__input"
              value={form.document}
              onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
            />
          </div>

          <div className="rp-modal__field">
            <label className="rp-modal__label" htmlFor="owner-fraction">
              Fração (%)
            </label>
            <input
              id="owner-fraction"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="rp-modal__input"
              value={form.fractionPct}
              onChange={(e) => setForm((f) => ({ ...f, fractionPct: e.target.value }))}
            />
          </div>

          <div className="rp-modal__field">
            <label className="rp-modal__label" htmlFor="owner-type">
              Tipo
            </label>
            <select
              id="owner-type"
              className="rp-modal__select"
              value={form.ownerType}
              onChange={(e) => setForm((f) => ({ ...f, ownerType: e.target.value }))}
            >
              {OWNER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {formError && (
            <div className="rp-modal__error" role="alert" style={{ gridColumn: '1 / -1' }}>
              <AlertCircle size={14} aria-hidden="true" /> {formError}
            </div>
          )}

          <div className="owner-form__actions">
            <button className="rp-modal__btn" onClick={handleCancel} type="button">
              Cancelar
            </button>
            <button
              className="rp-modal__btn rp-modal__btn--primary"
              onClick={handleSave}
              disabled={isSaving}
              type="button"
            >
              {isSaving ? 'Salvando...' : editingId ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
