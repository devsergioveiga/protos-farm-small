import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import {
  TARGET_TYPES,
  TARGET_TYPE_LABELS,
  DOSE_UNITS,
  DOSE_UNIT_LABELS,
} from '@/types/pesticide-prescription';
import type {
  PrescriptionItem,
  CreatePrescriptionInput,
  PrescriptionProductInput,
} from '@/types/pesticide-prescription';
import type { FieldPlot } from '@/types/farm';
import './PrescriptionModal.css';

interface ProductOption {
  id: string;
  name: string;
  type: string;
  activeIngredient?: string;
  toxicityClass?: string;
  mapaRegistration?: string;
  environmentalClass?: string;
  withdrawalPeriods?: Array<{ crop: string; days: number }>;
}

interface PrescriptionModalProps {
  isOpen: boolean;
  prescription: PrescriptionItem | null;
  onClose: () => void;
  onSuccess: () => void;
  onCreate: (input: CreatePrescriptionInput) => Promise<PrescriptionItem>;
  onUpdate: (id: string, input: Partial<CreatePrescriptionInput>) => Promise<PrescriptionItem>;
}

const EMPTY_PRODUCT: PrescriptionProductInput = {
  productName: '',
  activeIngredient: '',
  dose: 0,
  doseUnit: 'L_HA',
  withdrawalPeriodDays: null,
  safetyIntervalDays: null,
  toxicityClass: null,
  mapaRegistration: null,
  environmentalClass: null,
};

export default function PrescriptionModal({
  isOpen,
  prescription,
  onClose,
  onSuccess,
  onCreate,
  onUpdate,
}: PrescriptionModalProps) {
  const { selectedFarmId } = useFarmContext();
  const isEditing = !!prescription;

  // Form state
  const [fieldPlotId, setFieldPlotId] = useState('');
  const [cultureName, setCultureName] = useState('');
  const [targetPest, setTargetPest] = useState('');
  const [targetType, setTargetType] = useState('PLANTA_DANINHA');
  const [sprayVolume, setSprayVolume] = useState('200');
  const [numberOfApplications, setNumberOfApplications] = useState('1');
  const [applicationInterval, setApplicationInterval] = useState('');
  const [agronomistName, setAgronomistName] = useState('');
  const [agronomistCrea, setAgronomistCrea] = useState('');
  const [technicalJustification, setTechnicalJustification] = useState('');
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<PrescriptionProductInput[]>([{ ...EMPTY_PRODUCT }]);

  // Data loading
  const [plots, setPlots] = useState<FieldPlot[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load field plots and products
  useEffect(() => {
    if (!isOpen || !selectedFarmId) return;
    let cancelled = false;

    setLoadingPlots(true);
    Promise.all([
      api.get<FieldPlot[]>(`/org/farms/${selectedFarmId}/plots`),
      api.get<{ data: ProductOption[] }>('/org/products?nature=PRODUCT&status=ACTIVE&limit=500'),
    ])
      .then(([plotsResult, productsResult]) => {
        if (!cancelled) {
          setPlots(plotsResult);
          // Filter defensivos only
          const defensivos = productsResult.data.filter((p) => p.type.startsWith('defensivo'));
          setProductOptions(defensivos);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlots([]);
          setProductOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedFarmId]);

  // Reset / populate form
  useEffect(() => {
    if (!isOpen) return;

    if (prescription) {
      setFieldPlotId(prescription.fieldPlotId);
      setCultureName(prescription.cultureName);
      setTargetPest(prescription.targetPest);
      setTargetType(prescription.targetType);
      setSprayVolume(String(prescription.sprayVolume));
      setNumberOfApplications(String(prescription.numberOfApplications));
      setApplicationInterval(
        prescription.applicationInterval ? String(prescription.applicationInterval) : '',
      );
      setAgronomistName(prescription.agronomistName);
      setAgronomistCrea(prescription.agronomistCrea);
      setTechnicalJustification(prescription.technicalJustification ?? '');
      setNotes(prescription.notes ?? '');
      setProducts(
        prescription.products.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          activeIngredient: p.activeIngredient,
          dose: p.dose,
          doseUnit: p.doseUnit,
          withdrawalPeriodDays: p.withdrawalPeriodDays,
          safetyIntervalDays: p.safetyIntervalDays,
          toxicityClass: p.toxicityClass,
          mapaRegistration: p.mapaRegistration,
          environmentalClass: p.environmentalClass,
        })),
      );
    } else {
      setFieldPlotId('');
      setCultureName('');
      setTargetPest('');
      setTargetType('PLANTA_DANINHA');
      setSprayVolume('200');
      setNumberOfApplications('1');
      setApplicationInterval('');
      setAgronomistName('');
      setAgronomistCrea('');
      setTechnicalJustification('');
      setNotes('');
      setProducts([{ ...EMPTY_PRODUCT }]);
    }
    setError(null);
  }, [isOpen, prescription]);

  // CA2: Auto-fill culture from selected plot
  const handlePlotChange = useCallback(
    (plotId: string) => {
      setFieldPlotId(plotId);
      const selectedPlot = plots.find((p) => p.id === plotId);
      if (selectedPlot?.currentCrop && !cultureName) {
        setCultureName(selectedPlot.currentCrop);
      }
    },
    [plots, cultureName],
  );

  // CA3: Select product from stock
  const handleProductSelect = useCallback(
    (index: number, productId: string) => {
      const option = productOptions.find((p) => p.id === productId);
      if (!option) return;

      setProducts((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          productId,
          productName: option.name,
          activeIngredient: option.activeIngredient ?? '',
          toxicityClass: option.toxicityClass ?? null,
          mapaRegistration: option.mapaRegistration ?? null,
          environmentalClass: option.environmentalClass ?? null,
          // CA5: Auto-fill withdrawal from product
          withdrawalPeriodDays:
            option.withdrawalPeriods && cultureName
              ? (option.withdrawalPeriods.find(
                  (wp) => wp.crop.toLowerCase() === cultureName.toLowerCase(),
                )?.days ?? null)
              : null,
        };
        return updated;
      });
    },
    [productOptions, cultureName],
  );

  const updateProduct = useCallback((index: number, field: string, value: unknown) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const addProduct = useCallback(() => {
    setProducts((prev) => [...prev, { ...EMPTY_PRODUCT }]);
  }, []);

  const removeProduct = useCallback((index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const input: CreatePrescriptionInput = {
        fieldPlotId,
        cultureName,
        targetPest,
        targetType,
        sprayVolume: Number(sprayVolume),
        numberOfApplications: Number(numberOfApplications) || 1,
        applicationInterval: applicationInterval ? Number(applicationInterval) : null,
        agronomistName,
        agronomistCrea,
        technicalJustification: technicalJustification || null,
        notes: notes || null,
        products: products.map((p) => ({
          productId: p.productId ?? null,
          productName: p.productName,
          activeIngredient: p.activeIngredient,
          dose: Number(p.dose),
          doseUnit: p.doseUnit ?? 'L_HA',
          withdrawalPeriodDays:
            p.withdrawalPeriodDays != null ? Number(p.withdrawalPeriodDays) : null,
          safetyIntervalDays: p.safetyIntervalDays != null ? Number(p.safetyIntervalDays) : null,
          toxicityClass: p.toxicityClass ?? null,
          mapaRegistration: p.mapaRegistration ?? null,
          environmentalClass: p.environmentalClass ?? null,
        })),
      };

      if (isEditing) {
        await onUpdate(prescription.id, input);
      } else {
        await onCreate(input);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar receituário');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedPlot = plots.find((p) => p.id === fieldPlotId);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Editar receituário' : 'Novo receituário agronômico'}
    >
      <div className="modal-container prescription-modal">
        {/* Header */}
        <header className="modal-header">
          <h2 className="modal-title">
            {isEditing ? 'Editar receituário' : 'Novo receituário agronômico'}
          </h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          {/* Section: Property & Plot (CA2) */}
          <fieldset className="form-section">
            <legend className="form-section-title">Local e cultura</legend>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="prescFieldPlot">Talhão *</label>
                <select
                  id="prescFieldPlot"
                  value={fieldPlotId}
                  onChange={(e) => handlePlotChange(e.target.value)}
                  required
                  aria-required="true"
                  disabled={loadingPlots}
                >
                  <option value="">Selecione o talhão</option>
                  {plots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.boundaryAreaHa.toFixed(2)} ha)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="prescCulture">Cultura *</label>
                <input
                  id="prescCulture"
                  type="text"
                  value={cultureName}
                  onChange={(e) => setCultureName(e.target.value)}
                  placeholder="Ex: Soja, Milho, Café..."
                  required
                  aria-required="true"
                />
              </div>
            </div>

            {selectedPlot && (
              <p className="form-hint">
                Área: {selectedPlot.boundaryAreaHa.toFixed(2)} ha
                {selectedPlot.currentCrop && ` · Cultura atual: ${selectedPlot.currentCrop}`}
              </p>
            )}
          </fieldset>

          {/* Section: Target */}
          <fieldset className="form-section">
            <legend className="form-section-title">Alvo da aplicação</legend>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="prescTargetPest">Praga/doença alvo *</label>
                <input
                  id="prescTargetPest"
                  type="text"
                  value={targetPest}
                  onChange={(e) => setTargetPest(e.target.value)}
                  placeholder="Ex: Buva, Ferrugem asiática..."
                  required
                  aria-required="true"
                />
              </div>

              <div className="form-group">
                <label htmlFor="prescTargetType">Tipo *</label>
                <select
                  id="prescTargetType"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  required
                  aria-required="true"
                >
                  {TARGET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TARGET_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Section: Products (CA3 + CA5) */}
          <fieldset className="form-section">
            <legend className="form-section-title">Produtos recomendados</legend>

            {products.map((product, index) => (
              <div key={index} className="product-row">
                <div className="product-row-header">
                  <span className="product-number">Produto {index + 1}</span>
                  {products.length > 1 && (
                    <button
                      type="button"
                      className="btn-icon-danger"
                      onClick={() => removeProduct(index)}
                      aria-label={`Remover produto ${index + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group form-group-wide">
                    <label htmlFor={`prescProduct-${index}`}>Produto do estoque</label>
                    <select
                      id={`prescProduct-${index}`}
                      value={product.productId ?? ''}
                      onChange={(e) => handleProductSelect(index, e.target.value)}
                    >
                      <option value="">Selecionar do estoque (opcional)</option>
                      {productOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor={`prescProdName-${index}`}>Nome do produto *</label>
                    <input
                      id={`prescProdName-${index}`}
                      type="text"
                      value={product.productName}
                      onChange={(e) => updateProduct(index, 'productName', e.target.value)}
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor={`prescIngredient-${index}`}>Ingrediente ativo *</label>
                    <input
                      id={`prescIngredient-${index}`}
                      type="text"
                      value={product.activeIngredient}
                      onChange={(e) => updateProduct(index, 'activeIngredient', e.target.value)}
                      required
                      aria-required="true"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor={`prescDose-${index}`}>Dose *</label>
                    <input
                      id={`prescDose-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={product.dose || ''}
                      onChange={(e) => updateProduct(index, 'dose', Number(e.target.value))}
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor={`prescDoseUnit-${index}`}>Unidade</label>
                    <select
                      id={`prescDoseUnit-${index}`}
                      value={product.doseUnit ?? 'L_HA'}
                      onChange={(e) => updateProduct(index, 'doseUnit', e.target.value)}
                    >
                      {DOSE_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {DOSE_UNIT_LABELS[u]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor={`prescWithdrawal-${index}`}>Carência (dias)</label>
                    <input
                      id={`prescWithdrawal-${index}`}
                      type="number"
                      min="0"
                      value={product.withdrawalPeriodDays ?? ''}
                      onChange={(e) =>
                        updateProduct(
                          index,
                          'withdrawalPeriodDays',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor={`prescSafety-${index}`}>Reentrada (dias)</label>
                    <input
                      id={`prescSafety-${index}`}
                      type="number"
                      min="0"
                      value={product.safetyIntervalDays ?? ''}
                      onChange={(e) =>
                        updateProduct(
                          index,
                          'safetyIntervalDays',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </div>
                </div>

                {(product.toxicityClass ||
                  product.mapaRegistration ||
                  product.environmentalClass) && (
                  <p className="product-meta">
                    {product.toxicityClass && <span>Classe tox.: {product.toxicityClass}</span>}
                    {product.mapaRegistration && <span>MAPA: {product.mapaRegistration}</span>}
                    {product.environmentalClass && (
                      <span>Classe amb.: {product.environmentalClass}</span>
                    )}
                  </p>
                )}
              </div>
            ))}

            <button type="button" className="btn-secondary btn-add-product" onClick={addProduct}>
              <Plus size={16} aria-hidden="true" /> Adicionar produto
            </button>
          </fieldset>

          {/* Section: Application details */}
          <fieldset className="form-section">
            <legend className="form-section-title">Detalhes da aplicação</legend>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="prescSprayVolume">Volume de calda (L/ha) *</label>
                <input
                  id="prescSprayVolume"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sprayVolume}
                  onChange={(e) => setSprayVolume(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>
              <div className="form-group">
                <label htmlFor="prescNumApps">Nº de aplicações</label>
                <input
                  id="prescNumApps"
                  type="number"
                  min="1"
                  value={numberOfApplications}
                  onChange={(e) => setNumberOfApplications(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="prescInterval">Intervalo (dias)</label>
                <input
                  id="prescInterval"
                  type="number"
                  min="0"
                  value={applicationInterval}
                  onChange={(e) => setApplicationInterval(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          {/* Section: Agronomist (CA4) */}
          <fieldset className="form-section">
            <legend className="form-section-title">Responsável técnico</legend>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="prescAgronomist">Nome do agrônomo *</label>
                <input
                  id="prescAgronomist"
                  type="text"
                  value={agronomistName}
                  onChange={(e) => setAgronomistName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  aria-required="true"
                />
              </div>
              <div className="form-group">
                <label htmlFor="prescCrea">CREA *</label>
                <input
                  id="prescCrea"
                  type="text"
                  value={agronomistCrea}
                  onChange={(e) => setAgronomistCrea(e.target.value)}
                  placeholder="Ex: SP-12345/D"
                  required
                  aria-required="true"
                />
              </div>
            </div>
          </fieldset>

          {/* Section: Justification & Notes */}
          <fieldset className="form-section">
            <legend className="form-section-title">Justificativa e observações</legend>

            <div className="form-group">
              <label htmlFor="prescJustification">Justificativa técnica</label>
              <textarea
                id="prescJustification"
                rows={3}
                value={technicalJustification}
                onChange={(e) => setTechnicalJustification(e.target.value)}
                placeholder="Justificativa técnica para a recomendação..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="prescNotes">Observações</label>
              <textarea
                id="prescNotes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
              />
            </div>
          </fieldset>

          {/* Footer */}
          <footer className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Emitir receituário'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
