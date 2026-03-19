import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  Asset,
  AssetType,
  AssetClassification,
  CreateAssetInput,
  UpdateAssetInput,
} from '@/types/asset';

// ─── Type-specific field keys ─────────────────────────────────────────

const MAQUINA_FIELDS: (keyof CreateAssetInput)[] = [
  'engineHp',
  'fuelType',
  'manufacturer',
  'model',
  'yearOfManufacture',
  'serialNumber',
  'currentHourmeter',
];

const VEICULO_FIELDS: (keyof CreateAssetInput)[] = [
  'renavamCode',
  'licensePlate',
  'manufacturer',
  'model',
  'yearOfManufacture',
  'currentOdometer',
  'fuelType',
];

const IMPLEMENTO_FIELDS: (keyof CreateAssetInput)[] = [
  'manufacturer',
  'model',
  'yearOfManufacture',
  'serialNumber',
  'parentAssetId',
];

const BENFEITORIA_FIELDS: (keyof CreateAssetInput)[] = [
  'constructionMaterial',
  'areaM2',
  'capacity',
  'geoLat',
  'geoLon',
];

const TERRA_FIELDS: (keyof CreateAssetInput)[] = ['registrationNumber', 'areaHa', 'carCode'];

const TYPE_SPECIFIC_FIELDS: Record<AssetType, (keyof CreateAssetInput)[]> = {
  MAQUINA: MAQUINA_FIELDS,
  VEICULO: VEICULO_FIELDS,
  IMPLEMENTO: IMPLEMENTO_FIELDS,
  BENFEITORIA: BENFEITORIA_FIELDS,
  TERRA: TERRA_FIELDS,
};

const ALL_TYPE_SPECIFIC_FIELDS = [
  ...MAQUINA_FIELDS,
  ...VEICULO_FIELDS,
  ...IMPLEMENTO_FIELDS,
  ...BENFEITORIA_FIELDS,
  ...TERRA_FIELDS,
];

// ─── Hook ─────────────────────────────────────────────────────────────

type FormData = Partial<CreateAssetInput> & { id?: string };

interface UseAssetFormResult {
  formData: FormData;
  errors: Record<string, string>;
  isSubmitting: boolean;
  setField: (name: keyof CreateAssetInput | 'id', value: string | number | undefined) => void;
  validate: () => Record<string, string>;
  handleSubmit: (onSuccess: (asset: Asset) => void) => Promise<void>;
  resetForm: () => void;
  loadAsset: (asset: Asset) => void;
}

export function useAssetForm(): UseAssetFormResult {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = useCallback(
    (name: keyof CreateAssetInput | 'id', value: string | number | undefined) => {
      setFormData((prev) => {
        const next = { ...prev, [name]: value === '' ? undefined : value };

        // When changing assetType, clear all type-specific fields from the previous type
        if (name === 'assetType') {
          const newType = value as AssetType;
          // Clear all type-specific fields
          for (const field of ALL_TYPE_SPECIFIC_FIELDS) {
            delete next[field as keyof typeof next];
          }
          // Auto-set classification for TERRA
          if (newType === 'TERRA') {
            (next as { classification?: AssetClassification }).classification =
              'NON_DEPRECIABLE_CPC27';
          }
        }

        return next;
      });
      // Clear field-specific error when field changes
      setErrors((prev) => {
        if (name in prev) {
          const next = { ...prev };
          delete next[name];
          return next;
        }
        return prev;
      });
    },
    [],
  );

  const validate = useCallback((): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = 'Nome e obrigatorio';
    if (!formData.assetType) newErrors.assetType = 'Tipo de ativo e obrigatorio';
    if (!formData.classification) newErrors.classification = 'Classificacao CPC e obrigatoria';
    if (!formData.farmId) newErrors.farmId = 'Fazenda e obrigatoria';
    return newErrors;
  }, [formData]);

  const handleSubmit = useCallback(
    async (onSuccess: (asset: Asset) => void) => {
      const validationErrors = validate();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      if (!orgId) return;

      setIsSubmitting(true);
      try {
        const isEdit = Boolean(formData.id);
        const { id, ...payload } = formData;

        let result: Asset;
        if (isEdit && id) {
          result = await api.patch<Asset>(
            `/org/${orgId}/assets/${id}`,
            payload as UpdateAssetInput,
          );
        } else {
          result = await api.post<Asset>(`/org/${orgId}/assets`, payload as CreateAssetInput);
        }
        onSuccess(result);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, orgId, validate],
  );

  const resetForm = useCallback(() => {
    setFormData({});
    setErrors({});
    setIsSubmitting(false);
  }, []);

  const loadAsset = useCallback((asset: Asset) => {
    const assetType = asset.assetType;
    // Only keep type-specific fields relevant to this asset type
    const relevantFields = TYPE_SPECIFIC_FIELDS[assetType] ?? [];
    const baseData: FormData = {
      id: asset.id,
      name: asset.name,
      assetType: asset.assetType,
      classification: asset.classification,
      farmId: asset.farmId,
      description: asset.description ?? undefined,
      acquisitionDate: asset.acquisitionDate ?? undefined,
      acquisitionValue: asset.acquisitionValue ?? undefined,
      supplierId: asset.supplierId ?? undefined,
      invoiceNumber: asset.invoiceNumber ?? undefined,
      costCenterId: asset.costCenterId ?? undefined,
      notes: asset.notes ?? undefined,
    };

    // Load type-specific fields
    for (const field of relevantFields) {
      const value = asset[field as keyof Asset];
      if (value !== null && value !== undefined) {
        (baseData as Record<string, unknown>)[field] = value;
      }
    }

    setFormData(baseData);
    setErrors({});
  }, []);

  return {
    formData,
    errors,
    isSubmitting,
    setField,
    validate,
    handleSubmit,
    resetForm,
    loadAsset,
  };
}
