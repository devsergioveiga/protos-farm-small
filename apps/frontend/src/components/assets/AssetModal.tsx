import { useEffect, useRef, useState, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAssetForm } from '@/hooks/useAssetForm';
import { useFarms } from '@/hooks/useFarms';
import { useAssets } from '@/hooks/useAssets';
import type { Asset, AssetType, AssetClassification, AssetStatus } from '@/types/asset';
import { ASSET_TYPE_LABELS, ASSET_CLASSIFICATION_LABELS, ASSET_STATUS_LABELS } from '@/types/asset';
import './AssetModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset?: Asset;
}

// ─── Fuel type options ─────────────────────────────────────────────────

const FUEL_TYPES = [
  { value: 'Diesel', label: 'Diesel' },
  { value: 'Gasolina', label: 'Gasolina' },
  { value: 'Etanol', label: 'Etanol' },
  { value: 'GNV', label: 'GNV' },
  { value: 'Eletrico', label: 'Eletrico' },
];

// ─── Section heading ───────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }) {
  return <h3 className="asset-modal__section-heading">{children}</h3>;
}

// ─── Field error ───────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="asset-modal__field-error" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </span>
  );
}

// ─── Label ─────────────────────────────────────────────────────────────

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: string;
}) {
  return (
    <label htmlFor={htmlFor} className="asset-modal__label">
      {children}
      {required && (
        <span className="asset-modal__required" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  );
}

// ─── Main component ────────────────────────────────────────────────────

export default function AssetModal({ isOpen, onClose, onSuccess, asset }: AssetModalProps) {
  const { formData, errors, isSubmitting, setField, handleSubmit, resetForm, loadAsset } =
    useAssetForm();
  const { farms } = useFarms();
  const { assets: machineAssets, fetchAssets } = useAssets();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [collapsedAcquisition, setCollapsedAcquisition] = useState(false);
  const [collapsedPhotos, setCollapsedPhotos] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(asset?.id);

  // Load machine assets for IMPLEMENTO parent picker
  const loadMachines = useCallback(() => {
    void fetchAssets({ assetType: 'MAQUINA', limit: 100 });
  }, [fetchAssets]);

  // Reset / load asset on open
  useEffect(() => {
    if (!isOpen) return;
    if (asset) {
      loadAsset(asset);
    } else {
      resetForm();
    }
    // Load machines for IMPLEMENTO parent picker
    loadMachines();
    // Focus first input after open animation
    setTimeout(() => {
      firstInputRef.current?.focus();
    }, 100);
  }, [isOpen, asset, loadAsset, resetForm, loadMachines]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Trap focus
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [isOpen, formData.assetType]);

  if (!isOpen) return null;

  const currentType = formData.assetType;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      await handleSubmit(onSuccess);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel salvar o ativo.';
      setSubmitError(message);
    }
  }

  return (
    <div
      className="asset-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-modal-title"
    >
      <div className="asset-modal" ref={dialogRef}>
        {/* Header */}
        <div className="asset-modal__header">
          <h2 id="asset-modal-title" className="asset-modal__title">
            {isEdit ? 'Editar ativo' : 'Cadastrar ativo'}
          </h2>
          <button
            type="button"
            className="asset-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <form
          className="asset-modal__body"
          onSubmit={(e) => void onSubmit(e)}
          noValidate
          id="asset-modal-form"
        >
          {submitError && (
            <div className="asset-modal__submit-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {submitError}
            </div>
          )}

          {/* Section 1: Tipo de Ativo */}
          <section className="asset-modal__section">
            <SectionHeading>Tipo de Ativo</SectionHeading>
            <div className="asset-modal__type-grid" role="group" aria-label="Tipo de ativo">
              {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  className={`asset-modal__type-btn ${currentType === type ? 'asset-modal__type-btn--selected' : ''}`}
                  aria-pressed={currentType === type}
                  onClick={() => setField('assetType', type)}
                  disabled={isEdit}
                >
                  {label}
                </button>
              ))}
            </div>
            <FieldError message={errors.assetType} />
          </section>

          {/* Section 2: Identificacao */}
          <section className="asset-modal__section">
            <SectionHeading>Identificacao</SectionHeading>

            <div className="asset-modal__field">
              <Label htmlFor="asset-name" required>
                Nome
              </Label>
              <input
                ref={firstInputRef}
                type="text"
                id="asset-name"
                className={`asset-modal__input ${errors.name ? 'asset-modal__input--error' : ''}`}
                value={formData.name ?? ''}
                onChange={(e) => setField('name', e.target.value)}
                aria-required="true"
                aria-describedby={errors.name ? 'asset-name-error' : undefined}
              />
              <FieldError message={errors.name} />
            </div>

            {/* Tag — read-only, shown only in edit mode */}
            {isEdit && asset?.assetTag && (
              <div className="asset-modal__field">
                <Label htmlFor="asset-tag">Tag</Label>
                <input
                  type="text"
                  id="asset-tag"
                  className="asset-modal__input asset-modal__input--mono asset-modal__input--readonly"
                  value={asset.assetTag}
                  readOnly
                  aria-readonly="true"
                />
                <span className="asset-modal__hint">
                  Codigo gerado automaticamente pelo sistema.
                </span>
              </div>
            )}

            <div className="asset-modal__field">
              <Label htmlFor="asset-farm" required>
                Fazenda
              </Label>
              <select
                id="asset-farm"
                className={`asset-modal__select ${errors.farmId ? 'asset-modal__select--error' : ''}`}
                value={formData.farmId ?? ''}
                onChange={(e) => setField('farmId', e.target.value)}
                aria-required="true"
              >
                <option value="">Selecione a fazenda</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.farmId} />
            </div>

            {isEdit && (
              <div className="asset-modal__field">
                <Label htmlFor="asset-status">Status</Label>
                <select
                  id="asset-status"
                  className="asset-modal__select"
                  value={formData.status ?? 'ATIVO'}
                  onChange={(e) => setField('status', e.target.value)}
                >
                  {(Object.entries(ASSET_STATUS_LABELS) as [AssetStatus, string][]).map(
                    ([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            <div className="asset-modal__field">
              <Label htmlFor="asset-classification" required>
                Classificacao CPC
              </Label>
              <select
                id="asset-classification"
                className={`asset-modal__select ${errors.classification ? 'asset-modal__select--error' : ''}`}
                value={formData.classification ?? ''}
                onChange={(e) => setField('classification', e.target.value as AssetClassification)}
                disabled={currentType === 'TERRA'}
                aria-required="true"
              >
                <option value="">Selecione a classificacao</option>
                {(
                  Object.entries(ASSET_CLASSIFICATION_LABELS) as [AssetClassification, string][]
                ).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.classification} />
            </div>

            <div className="asset-modal__field">
              <Label htmlFor="asset-description">Descricao</Label>
              <textarea
                id="asset-description"
                className="asset-modal__textarea"
                value={formData.description ?? ''}
                onChange={(e) => setField('description', e.target.value)}
                rows={3}
              />
            </div>
          </section>

          {/* Section 3: Aquisicao (collapsible) */}
          <section className="asset-modal__section">
            <button
              type="button"
              className="asset-modal__collapse-header"
              onClick={() => setCollapsedAcquisition((v) => !v)}
              aria-expanded={!collapsedAcquisition}
            >
              <SectionHeading>Aquisicao</SectionHeading>
              <span className="asset-modal__collapse-chevron">
                {collapsedAcquisition ? '▸' : '▾'}
              </span>
            </button>

            {!collapsedAcquisition && (
              <div className="asset-modal__collapse-body">
                <div className="asset-modal__field">
                  <Label htmlFor="asset-acquisition-date">Data aquisicao</Label>
                  <input
                    type="date"
                    id="asset-acquisition-date"
                    className="asset-modal__input"
                    value={formData.acquisitionDate ?? ''}
                    onChange={(e) => setField('acquisitionDate', e.target.value)}
                  />
                </div>

                <div className="asset-modal__field">
                  <Label htmlFor="asset-acquisition-value">Valor aquisicao (R$)</Label>
                  <input
                    type="number"
                    id="asset-acquisition-value"
                    className="asset-modal__input"
                    value={formData.acquisitionValue ?? ''}
                    onChange={(e) => setField('acquisitionValue', e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                  />
                </div>

                <div className="asset-modal__field">
                  <Label htmlFor="asset-invoice">Numero NF</Label>
                  <input
                    type="text"
                    id="asset-invoice"
                    className="asset-modal__input"
                    value={formData.invoiceNumber ?? ''}
                    onChange={(e) => setField('invoiceNumber', e.target.value)}
                  />
                </div>

                <div className="asset-modal__field">
                  <Label htmlFor="asset-notes">Observacoes</Label>
                  <textarea
                    id="asset-notes"
                    className="asset-modal__textarea"
                    value={formData.notes ?? ''}
                    onChange={(e) => setField('notes', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Dados Especificos (conditional) */}
          {currentType && (
            <section className="asset-modal__section">
              <SectionHeading>Dados Especificos</SectionHeading>

              {/* MAQUINA */}
              {currentType === 'MAQUINA' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-engine-hp">Potencia HP</Label>
                    <input
                      type="number"
                      id="asset-engine-hp"
                      className="asset-modal__input"
                      value={formData.engineHp ?? ''}
                      onChange={(e) => setField('engineHp', e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-fuel-type">Tipo combustivel</Label>
                    <select
                      id="asset-fuel-type"
                      className="asset-modal__select"
                      value={formData.fuelType ?? ''}
                      onChange={(e) => setField('fuelType', e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {FUEL_TYPES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-manufacturer">Fabricante</Label>
                    <input
                      type="text"
                      id="asset-manufacturer"
                      className="asset-modal__input"
                      value={formData.manufacturer ?? ''}
                      onChange={(e) => setField('manufacturer', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-model">Modelo</Label>
                    <input
                      type="text"
                      id="asset-model"
                      className="asset-modal__input"
                      value={formData.model ?? ''}
                      onChange={(e) => setField('model', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-year">Ano</Label>
                    <input
                      type="number"
                      id="asset-year"
                      className="asset-modal__input"
                      value={formData.yearOfManufacture ?? ''}
                      onChange={(e) =>
                        setField(
                          'yearOfManufacture',
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      min="1900"
                      max="2100"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-serial">Numero serie</Label>
                    <input
                      type="text"
                      id="asset-serial"
                      className="asset-modal__input"
                      value={formData.serialNumber ?? ''}
                      onChange={(e) => setField('serialNumber', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-hourmeter">Horimetro atual</Label>
                    <input
                      type="number"
                      id="asset-hourmeter"
                      className="asset-modal__input"
                      value={formData.currentHourmeter ?? ''}
                      onChange={(e) => setField('currentHourmeter', e.target.value)}
                      min="0"
                    />
                  </div>
                </div>
              )}

              {/* VEICULO */}
              {currentType === 'VEICULO' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-renavam">RENAVAM</Label>
                    <input
                      type="text"
                      id="asset-renavam"
                      className="asset-modal__input asset-modal__input--mono"
                      value={formData.renavamCode ?? ''}
                      onChange={(e) => setField('renavamCode', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-plate">Placa</Label>
                    <input
                      type="text"
                      id="asset-plate"
                      className="asset-modal__input asset-modal__input--mono"
                      value={formData.licensePlate ?? ''}
                      onChange={(e) => setField('licensePlate', e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-manufacturer-v">Fabricante</Label>
                    <input
                      type="text"
                      id="asset-manufacturer-v"
                      className="asset-modal__input"
                      value={formData.manufacturer ?? ''}
                      onChange={(e) => setField('manufacturer', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-model-v">Modelo</Label>
                    <input
                      type="text"
                      id="asset-model-v"
                      className="asset-modal__input"
                      value={formData.model ?? ''}
                      onChange={(e) => setField('model', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-year-v">Ano</Label>
                    <input
                      type="number"
                      id="asset-year-v"
                      className="asset-modal__input"
                      value={formData.yearOfManufacture ?? ''}
                      onChange={(e) =>
                        setField(
                          'yearOfManufacture',
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      min="1900"
                      max="2100"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-odometer">Odometro atual (km)</Label>
                    <input
                      type="number"
                      id="asset-odometer"
                      className="asset-modal__input"
                      value={formData.currentOdometer ?? ''}
                      onChange={(e) => setField('currentOdometer', e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-fuel-type-v">Tipo combustivel</Label>
                    <select
                      id="asset-fuel-type-v"
                      className="asset-modal__select"
                      value={formData.fuelType ?? ''}
                      onChange={(e) => setField('fuelType', e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {FUEL_TYPES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* IMPLEMENTO */}
              {currentType === 'IMPLEMENTO' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-manufacturer-i">Fabricante</Label>
                    <input
                      type="text"
                      id="asset-manufacturer-i"
                      className="asset-modal__input"
                      value={formData.manufacturer ?? ''}
                      onChange={(e) => setField('manufacturer', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-model-i">Modelo</Label>
                    <input
                      type="text"
                      id="asset-model-i"
                      className="asset-modal__input"
                      value={formData.model ?? ''}
                      onChange={(e) => setField('model', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-year-i">Ano</Label>
                    <input
                      type="number"
                      id="asset-year-i"
                      className="asset-modal__input"
                      value={formData.yearOfManufacture ?? ''}
                      onChange={(e) =>
                        setField(
                          'yearOfManufacture',
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      min="1900"
                      max="2100"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-serial-i">Numero serie</Label>
                    <input
                      type="text"
                      id="asset-serial-i"
                      className="asset-modal__input"
                      value={formData.serialNumber ?? ''}
                      onChange={(e) => setField('serialNumber', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field asset-modal__field--full">
                    <Label htmlFor="asset-parent">Vinculo maquina pai (opcional)</Label>
                    <select
                      id="asset-parent"
                      className="asset-modal__select"
                      value={formData.parentAssetId ?? ''}
                      onChange={(e) => setField('parentAssetId', e.target.value || undefined)}
                    >
                      <option value="">Nenhuma</option>
                      {machineAssets
                        .filter((a) => a.assetType === 'MAQUINA')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.assetTag} — {m.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* BENFEITORIA */}
              {currentType === 'BENFEITORIA' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-material">Material construcao</Label>
                    <input
                      type="text"
                      id="asset-material"
                      className="asset-modal__input"
                      value={formData.constructionMaterial ?? ''}
                      onChange={(e) => setField('constructionMaterial', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-area-m2">Area (m2)</Label>
                    <input
                      type="number"
                      id="asset-area-m2"
                      className="asset-modal__input"
                      value={formData.areaM2 ?? ''}
                      onChange={(e) => setField('areaM2', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-capacity">Capacidade</Label>
                    <input
                      type="text"
                      id="asset-capacity"
                      className="asset-modal__input"
                      value={formData.capacity ?? ''}
                      onChange={(e) => setField('capacity', e.target.value)}
                      placeholder="Ex: 1.000 sacas"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-geo-lat">Latitude</Label>
                    <input
                      type="number"
                      id="asset-geo-lat"
                      className="asset-modal__input"
                      value={formData.geoLat ?? ''}
                      onChange={(e) =>
                        setField('geoLat', e.target.value ? Number(e.target.value) : undefined)
                      }
                      step="0.000001"
                      placeholder="-15.123456"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-geo-lon">Longitude</Label>
                    <input
                      type="number"
                      id="asset-geo-lon"
                      className="asset-modal__input"
                      value={formData.geoLon ?? ''}
                      onChange={(e) =>
                        setField('geoLon', e.target.value ? Number(e.target.value) : undefined)
                      }
                      step="0.000001"
                      placeholder="-48.123456"
                    />
                  </div>
                </div>
              )}

              {/* TERRA */}
              {currentType === 'TERRA' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-registration">Matricula</Label>
                    <input
                      type="text"
                      id="asset-registration"
                      className="asset-modal__input asset-modal__input--mono"
                      value={formData.registrationNumber ?? ''}
                      onChange={(e) => setField('registrationNumber', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-area-ha">Area (ha)</Label>
                    <input
                      type="number"
                      id="asset-area-ha"
                      className="asset-modal__input"
                      value={formData.areaHa ?? ''}
                      onChange={(e) => setField('areaHa', e.target.value)}
                      min="0"
                      step="0.0001"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-car">Codigo CAR</Label>
                    <input
                      type="text"
                      id="asset-car"
                      className="asset-modal__input"
                      value={formData.carCode ?? ''}
                      onChange={(e) => setField('carCode', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Section 5: Fotos (collapsible) */}
          <section className="asset-modal__section">
            <button
              type="button"
              className="asset-modal__collapse-header"
              onClick={() => setCollapsedPhotos((v) => !v)}
              aria-expanded={!collapsedPhotos}
            >
              <SectionHeading>Fotos</SectionHeading>
              <span className="asset-modal__collapse-chevron">{collapsedPhotos ? '▸' : '▾'}</span>
            </button>

            {!collapsedPhotos && (
              <div className="asset-modal__collapse-body">
                <div className="asset-modal__dropzone">
                  <p className="asset-modal__dropzone-hint">
                    Arraste fotos ou clique para selecionar. Maximo 5 imagens.
                  </p>
                  {isEdit ? (
                    <input
                      type="file"
                      className="asset-modal__file-input"
                      accept="image/*"
                      multiple
                      aria-label="Selecionar fotos"
                    />
                  ) : (
                    <p className="asset-modal__dropzone-hint asset-modal__dropzone-hint--info">
                      Salve o ativo primeiro para adicionar fotos.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </form>

        {/* Footer */}
        <div className="asset-modal__footer">
          <button
            type="button"
            className="asset-modal__btn asset-modal__btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="asset-modal-form"
            className="asset-modal__btn asset-modal__btn--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar alteracoes' : 'Cadastrar ativo'}
          </button>
        </div>
      </div>
    </div>
  );
}
