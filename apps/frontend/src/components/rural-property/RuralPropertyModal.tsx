import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Check,
  AlertCircle,
  Upload,
  Trash2,
  Plus,
  Pencil,
  FileText,
  MapPin,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  createRuralProperty,
  updateRuralProperty,
  useRuralPropertyDetail,
  addPropertyOwner,
  uploadPropertyBoundary,
  getPropertyBoundary,
  deletePropertyBoundary,
} from '../../hooks/useRuralProperties';
import type { PropertyBoundaryInfo } from '../../hooks/useRuralProperties';
import type { CreateRuralPropertyPayload } from '../../types/rural-property';
import {
  LAND_CLASSIFICATIONS,
  CLASSIFICATION_LABELS,
  OWNER_TYPES,
} from '../../types/rural-property';
import type { CreateOwnerPayload } from '../../types/rural-property';
import { PropertyOwnersTable } from './PropertyOwnersTable';
import { PropertyDocumentsSection } from './PropertyDocumentsSection';
import { PropertyLinkedEntities } from './PropertyLinkedEntities';
import './PropertyDocumentsSection.css';
import './PropertyLinkedEntities.css';
import './RuralPropertyModal.css';

const VALID_UF = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
];

interface RuralPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  farmId?: string;
  propertyId?: string | null;
}

type FormFields = {
  denomination: string;
  cib: string;
  incraCode: string;
  ccirCode: string;
  ccirValidUntil: string;
  carCode: string;
  totalAreaHa: string;
  certifiedAreaHa: string;
  registeredAreaHa: string;
  landClassification: string;
  productive: boolean;
  municipality: string;
  state: string;
  locationDirections: string;
  ruralModuleHa: string;
  ruralModulesCount: string;
  fiscalModuleHa: string;
  fiscalModulesCount: string;
  minPartitionFraction: string;
  vtnPerHa: string;
  appAreaHa: string;
  legalReserveHa: string;
  taxableAreaHa: string;
  usableAreaHa: string;
  utilizationDegree: string;
  lastProcessingDate: string;
  ccirIssuedAt: string;
  ccirGeneratedAt: string;
  ccirPaymentStatus: string;
  possessionByTitleHa: string;
  possessionByOccupationHa: string;
  measuredAreaHa: string;
};

interface PendingDoc {
  file: File;
  type: string;
  typeLabel: string;
}

interface PendingRegistration {
  number: string;
  cartorioName: string;
  comarca: string;
  state: string;
  areaHa: string;
  cnsCode: string;
  livro: string;
  registrationDate: string;
  file: File | null;
}

const INITIAL_FIELDS: FormFields = {
  denomination: '',
  cib: '',
  incraCode: '',
  ccirCode: '',
  ccirValidUntil: '',
  carCode: '',
  totalAreaHa: '',
  certifiedAreaHa: '',
  registeredAreaHa: '',
  landClassification: '',
  productive: false,
  municipality: '',
  state: '',
  locationDirections: '',
  ruralModuleHa: '',
  ruralModulesCount: '',
  fiscalModuleHa: '',
  fiscalModulesCount: '',
  minPartitionFraction: '',
  vtnPerHa: '',
  appAreaHa: '',
  legalReserveHa: '',
  taxableAreaHa: '',
  usableAreaHa: '',
  utilizationDegree: '',
  lastProcessingDate: '',
  ccirIssuedAt: '',
  ccirGeneratedAt: '',
  ccirPaymentStatus: '',
  possessionByTitleHa: '',
  possessionByOccupationHa: '',
  measuredAreaHa: '',
};

// ─── Decimal mask utilities ──────────────────────────────────────

/** Format digits as decimal with fixed decimal places (right-to-left fill) */
function formatDecimal(value: string, decimals: number = 4): string {
  const digits = value.replace(/\D/g, '');
  if (!digits || /^0+$/.test(digits)) return '';
  const padded = digits.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals).replace(/^0+/, '') || '0';
  const decPart = padded.slice(padded.length - decimals);
  return `${intPart},${decPart}`;
}

/** Convert a numeric value to masked format for display */
function numToMasked(v: unknown, decimals: number = 4): string {
  if (v == null || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n) || n === 0) return '';
  return n.toFixed(decimals).replace('.', ',');
}

/** Convert masked value (comma decimal) back to float */
function maskedToFloat(v: string): number {
  if (!v) return NaN;
  return parseFloat(v.replace(',', '.'));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detailToFields(d: any): FormFields {
  const num = (v: unknown): string => numToMasked(v);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '') || '';
  return {
    denomination: d.denomination,
    cib: d.cib || '',
    incraCode: d.incraCode || '',
    ccirCode: d.ccirCode || '',
    ccirValidUntil: d.ccirValidUntil || '',
    carCode: d.carCode || '',
    totalAreaHa: num(d.totalAreaHa),
    certifiedAreaHa: num(d.certifiedAreaHa),
    registeredAreaHa: num(d.registeredAreaHa),
    landClassification: d.landClassification || '',
    productive: d.productive ?? false,
    municipality: d.municipality || '',
    state: d.state || '',
    locationDirections: str(d.locationDirections),
    ruralModuleHa: num(d.ruralModuleHa),
    ruralModulesCount: num(d.ruralModulesCount),
    fiscalModuleHa: num(d.fiscalModuleHa),
    fiscalModulesCount: num(d.fiscalModulesCount),
    minPartitionFraction: num(d.minPartitionFraction),
    vtnPerHa: num(d.vtnPerHa),
    appAreaHa: num(d.appAreaHa),
    legalReserveHa: num(d.legalReserveHa),
    taxableAreaHa: num(d.taxableAreaHa),
    usableAreaHa: num(d.usableAreaHa),
    utilizationDegree: num(d.utilizationDegree),
    lastProcessingDate: str(d.lastProcessingDate),
    ccirIssuedAt: str(d.ccirIssuedAt),
    ccirGeneratedAt: str(d.ccirGeneratedAt),
    ccirPaymentStatus: d.ccirPaymentStatus || '',
    possessionByTitleHa: num(d.possessionByTitleHa),
    possessionByOccupationHa: num(d.possessionByOccupationHa),
    measuredAreaHa: num(d.measuredAreaHa),
  };
}

function buildPayload(fields: FormFields): CreateRuralPropertyPayload {
  const payload: CreateRuralPropertyPayload = {
    denomination: fields.denomination.trim(),
  };
  if (fields.cib) payload.cib = fields.cib;
  if (fields.incraCode) payload.incraCode = fields.incraCode;
  if (fields.ccirCode) payload.ccirCode = fields.ccirCode;
  if (fields.ccirValidUntil) payload.ccirValidUntil = fields.ccirValidUntil;
  if (fields.ccirIssuedAt) payload.ccirIssuedAt = fields.ccirIssuedAt;
  if (fields.ccirGeneratedAt) payload.ccirGeneratedAt = fields.ccirGeneratedAt;
  if (fields.carCode) payload.carCode = fields.carCode;
  if (fields.totalAreaHa) payload.totalAreaHa = maskedToFloat(fields.totalAreaHa);
  if (fields.certifiedAreaHa) payload.certifiedAreaHa = maskedToFloat(fields.certifiedAreaHa);
  if (fields.landClassification) payload.landClassification = fields.landClassification;
  payload.productive = fields.productive;
  if (fields.locationDirections) payload.locationDirections = fields.locationDirections;
  if (fields.lastProcessingDate) payload.lastProcessingDate = fields.lastProcessingDate;
  if (fields.municipality) payload.municipality = fields.municipality;
  if (fields.state) payload.state = fields.state;
  if (fields.fiscalModuleHa) payload.fiscalModuleHa = maskedToFloat(fields.fiscalModuleHa);
  if (fields.fiscalModulesCount)
    payload.fiscalModulesCount = maskedToFloat(fields.fiscalModulesCount);
  if (fields.ruralModuleHa) payload.ruralModuleHa = maskedToFloat(fields.ruralModuleHa);
  if (fields.ruralModulesCount) payload.ruralModulesCount = maskedToFloat(fields.ruralModulesCount);
  if (fields.minPartitionFraction)
    payload.minPartitionFraction = maskedToFloat(fields.minPartitionFraction);
  if (fields.vtnPerHa) payload.vtnPerHa = maskedToFloat(fields.vtnPerHa);
  if (fields.appAreaHa) payload.appAreaHa = maskedToFloat(fields.appAreaHa);
  if (fields.legalReserveHa) payload.legalReserveHa = maskedToFloat(fields.legalReserveHa);
  if (fields.taxableAreaHa) payload.taxableAreaHa = maskedToFloat(fields.taxableAreaHa);
  if (fields.usableAreaHa) payload.usableAreaHa = maskedToFloat(fields.usableAreaHa);
  if (fields.utilizationDegree) payload.utilizationDegree = maskedToFloat(fields.utilizationDegree);
  if (fields.ccirPaymentStatus) payload.ccirPaymentStatus = fields.ccirPaymentStatus;
  if (fields.registeredAreaHa) payload.registeredAreaHa = maskedToFloat(fields.registeredAreaHa);
  if (fields.possessionByTitleHa)
    payload.possessionByTitleHa = maskedToFloat(fields.possessionByTitleHa);
  if (fields.possessionByOccupationHa)
    payload.possessionByOccupationHa = maskedToFloat(fields.possessionByOccupationHa);
  if (fields.measuredAreaHa) payload.measuredAreaHa = maskedToFloat(fields.measuredAreaHa);
  return payload;
}

async function uploadDocToProperty(
  farmId: string,
  propertyId: string,
  file: File,
  type: string,
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  const token = localStorage.getItem('protos_access_token');
  const response = await fetch(`/api/org/farms/${farmId}/properties/${propertyId}/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || 'Erro ao enviar documento');
  }
}

// ─── Create Modal (single form, no steps) ────────────────────────

function CreatePropertyModal({
  onClose,
  onSuccess,
  farmId: initialFarmId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  farmId?: string;
}) {
  const [selectedFarmId, setSelectedFarmId] = useState(initialFarmId ?? '');
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingFarms, setIsLoadingFarms] = useState(!initialFarmId);
  const needsFarmSelect = !initialFarmId;

  const farmId = initialFarmId ?? selectedFarmId;

  // Fetch farms list when no farmId provided
  useEffect(() => {
    if (initialFarmId) return;
    setIsLoadingFarms(true);
    api
      .get<{ data: { id: string; name: string }[] }>('/org/farms')
      .then((res) => setFarms(res.data))
      .catch(() => {})
      .finally(() => setIsLoadingFarms(false));
  }, [initialFarmId]);

  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [errors, setErrors] = useState<Partial<Record<keyof FormFields, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [pendingOwners, setPendingOwners] = useState<CreateOwnerPayload[]>([]);
  const [ownerFormVisible, setOwnerFormVisible] = useState(false);
  const [editingOwnerIdx, setEditingOwnerIdx] = useState<number | null>(null);
  const [ownerForm, setOwnerForm] = useState({
    name: '',
    document: '',
    documentType: 'CPF',
    fractionPct: '',
    ownerType: 'PROPRIETARIO',
  });
  const [declarant, setDeclarant] = useState({ name: '', document: '', nationality: '' });
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [regFormVisible, setRegFormVisible] = useState(false);
  const [editingRegIdx, setEditingRegIdx] = useState<number | null>(null);
  const [regForm, setRegForm] = useState<PendingRegistration>({
    number: '',
    cartorioName: '',
    comarca: '',
    state: '',
    areaHa: '',
    cnsCode: '',
    livro: '',
    registrationDate: '',
    file: null,
  });
  const [pendingBoundaryFile, setPendingBoundaryFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const regFileInputRef = useRef<HTMLInputElement>(null);
  const regAttachRef = useRef<{ idx: number } | null>(null);
  const boundaryFileRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (field: keyof FormFields, value: string | boolean) => {
      setFields((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors],
  );

  const handleDecimalChange = useCallback(
    (field: keyof FormFields, value: string, decimals: number = 4) => {
      handleChange(field, formatDecimal(value, decimals));
    },
    [handleChange],
  );

  const handleCcirClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setSubmitError('Formato não suportado. Aceitos: PDF, JPEG, PNG');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('Arquivo muito grande. Máximo: 10 MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPendingDoc({ file, type: 'CCIR', typeLabel: 'CCIR' });
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Parse CCIR PDF to auto-fill fields
    if (file.type === 'application/pdf') {
      setIsParsing(true);
      setSubmitError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('protos_access_token');
        const response = await fetch('/api/org/rural-properties/parse-ccir', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (response.ok) {
          const { extracted } = (await response.json()) as {
            extracted: {
              denomination?: string | null;
              incraCode?: string | null;
              ccirNumber?: string | null;
              totalAreaHa?: number | null;
              certifiedAreaHa?: number | null;
              registeredAreaHa?: number | null;
              possessionByTitleHa?: number | null;
              possessionByOccupationHa?: number | null;
              measuredAreaHa?: number | null;
              municipality?: string | null;
              state?: string | null;
              locationDirections?: string | null;
              landClassification?: string | null;
              ruralModuleHa?: number | null;
              ruralModulesCount?: number | null;
              fiscalModuleHa?: number | null;
              fiscalModulesCount?: number | null;
              minPartitionFraction?: number | null;
              lastProcessingDate?: string | null;
              ccirIssuedAt?: string | null;
              ccirGeneratedAt?: string | null;
              ccirValidUntil?: string | null;
              ccirPaymentStatus?: string | null;
              declarant?: { name: string; document: string; nationality: string | null } | null;
              owners?: {
                document: string;
                name: string;
                condition: string | null;
                fractionPct: number | null;
              }[];
              registrations?: {
                number: string;
                cartorio: string | null;
                cnsCode: string | null;
                livro: string | null;
                registrationDate: string | null;
                areaHa: number;
              }[];
            };
          };

          const n = (v: number | null | undefined) => numToMasked(v);
          const s = (v: string | null | undefined) => v || '';

          setFields((prev) => ({
            ...prev,
            denomination: s(extracted.denomination) || prev.denomination,
            incraCode: s(extracted.incraCode) || prev.incraCode,
            ccirCode: s(extracted.ccirNumber) || prev.ccirCode,
            totalAreaHa: n(extracted.totalAreaHa) || prev.totalAreaHa,
            certifiedAreaHa: n(extracted.certifiedAreaHa) || prev.certifiedAreaHa,
            registeredAreaHa: n(extracted.registeredAreaHa) || prev.registeredAreaHa,
            possessionByTitleHa: n(extracted.possessionByTitleHa) || prev.possessionByTitleHa,
            possessionByOccupationHa:
              n(extracted.possessionByOccupationHa) || prev.possessionByOccupationHa,
            measuredAreaHa: n(extracted.measuredAreaHa) || prev.measuredAreaHa,
            municipality: s(extracted.municipality) || prev.municipality,
            state: s(extracted.state) || prev.state,
            locationDirections: s(extracted.locationDirections) || prev.locationDirections,
            landClassification: s(extracted.landClassification) || prev.landClassification,
            ruralModuleHa: n(extracted.ruralModuleHa) || prev.ruralModuleHa,
            ruralModulesCount: n(extracted.ruralModulesCount) || prev.ruralModulesCount,
            fiscalModuleHa: n(extracted.fiscalModuleHa) || prev.fiscalModuleHa,
            fiscalModulesCount: n(extracted.fiscalModulesCount) || prev.fiscalModulesCount,
            minPartitionFraction: n(extracted.minPartitionFraction) || prev.minPartitionFraction,
            lastProcessingDate: s(extracted.lastProcessingDate) || prev.lastProcessingDate,
            ccirIssuedAt: s(extracted.ccirIssuedAt) || prev.ccirIssuedAt,
            ccirGeneratedAt: s(extracted.ccirGeneratedAt) || prev.ccirGeneratedAt,
            ccirValidUntil: s(extracted.ccirValidUntil) || prev.ccirValidUntil,
            ccirPaymentStatus: s(extracted.ccirPaymentStatus) || prev.ccirPaymentStatus,
          }));

          if (extracted.declarant) {
            setDeclarant({
              name: extracted.declarant.name || '',
              document: extracted.declarant.document || '',
              nationality: extracted.declarant.nationality || '',
            });
          }
          if (extracted.owners?.length) {
            setPendingOwners(
              extracted.owners.map((o) => ({
                name: o.name,
                document: o.document,
                documentType: o.document.includes('/') ? 'CNPJ' : 'CPF',
                fractionPct: o.fractionPct ?? undefined,
                ownerType: 'PROPRIETARIO',
              })),
            );
          }
          if (extracted.registrations?.length) {
            setPendingRegistrations(
              extracted.registrations.map((r) => ({
                number: r.number,
                cartorioName: r.cartorio || '',
                comarca: r.cartorio?.replace(/^[A-Z]{2}\//, '') || '',
                state: r.cartorio?.match(/^([A-Z]{2})\//)?.[1] || '',
                areaHa: numToMasked(r.areaHa),
                cnsCode: r.cnsCode || '',
                livro: r.livro || '',
                registrationDate: r.registrationDate || '',
                file: null,
              })),
            );
          }
        }
      } catch {
        // Parsing failed silently — user can fill fields manually
      } finally {
        setIsParsing(false);
      }
    }
  };

  const handleSubmit = async () => {
    const newErrors: Partial<Record<keyof FormFields, string>> = {};
    if (!fields.denomination.trim()) newErrors.denomination = 'Denominação é obrigatória';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (!farmId) {
      setSubmitError('Selecione uma fazenda');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = buildPayload(fields);
      const created = await createRuralProperty(farmId, payload);

      if (pendingDoc) {
        try {
          await uploadDocToProperty(farmId, created.id, pendingDoc.file, pendingDoc.type);
        } catch {
          // Property created, doc upload failed — user can retry in edit mode
        }
      }

      // Create pending owners
      for (const owner of pendingOwners) {
        try {
          await addPropertyOwner(farmId, created.id, owner);
        } catch {
          // Owner creation failed — user can add in edit mode
        }
      }

      // Upload pending boundary
      if (pendingBoundaryFile) {
        try {
          await uploadPropertyBoundary(farmId, created.id, pendingBoundaryFile);
        } catch {
          // Boundary upload failed — user can retry in edit mode
        }
      }

      // Link or create pending registrations
      if (pendingRegistrations.length > 0) {
        // Fetch existing registrations to avoid duplicates
        let existingRegs: { id: string; number: string; ruralPropertyId: string | null }[] = [];
        try {
          const farmDetail = await api.get<{
            registrations: { id: string; number: string; ruralPropertyId: string | null }[];
          }>(`/org/farms/${farmId}`);
          existingRegs = farmDetail.registrations;
        } catch {
          // If fetch fails, proceed with creating new registrations
        }

        for (const reg of pendingRegistrations) {
          try {
            // Check if a registration with the same number already exists
            const existing = existingRegs.find(
              (r) => r.number === reg.number && !r.ruralPropertyId,
            );
            if (existing) {
              // Link existing registration to the new rural property
              await api.patch(`/org/farms/${farmId}/registrations/${existing.id}`, {
                ruralPropertyId: created.id,
              });
            } else {
              const regPayload = {
                number: reg.number,
                cartorioName: reg.cartorioName,
                comarca: reg.comarca,
                state: reg.state,
                areaHa: maskedToFloat(reg.areaHa),
                cnsCode: reg.cnsCode || undefined,
                livro: reg.livro || undefined,
                registrationDate: reg.registrationDate || undefined,
                ruralPropertyId: created.id,
              };
              await api.post(`/org/farms/${farmId}/registrations`, regPayload);
            }
            if (reg.file) {
              try {
                await uploadDocToProperty(farmId, created.id, reg.file, 'MATRICULA');
              } catch {
                // Doc upload failed — user can retry
              }
            }
          } catch {
            // Registration creation failed — user can add in edit mode
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao cadastrar imóvel rural');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="rp-modal__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Novo imóvel rural"
    >
      <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rp-modal__header">
          <h2 className="rp-modal__title">Novo Imóvel Rural</h2>
          <button className="rp-modal__close" onClick={onClose} aria-label="Fechar" type="button">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="rp-modal__body">
          {/* Fazenda + CCIR na mesma linha */}
          <div className="rp-modal__row rp-modal__row--2">
            {needsFarmSelect && (
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-farm">
                  Fazenda *
                </label>
                <select
                  id="rp-farm"
                  className={`rp-modal__select ${!selectedFarmId && submitError ? 'rp-modal__select--error' : ''}`}
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  disabled={isLoadingFarms}
                  aria-required="true"
                >
                  <option value="">
                    {isLoadingFarms ? 'Carregando...' : 'Selecione a fazenda'}
                  </option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rp-modal__field">
              <label className="rp-modal__label">CCIR (opcional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                aria-hidden="true"
              />
              {pendingDoc ? (
                <div className="rp-modal__doc-attached">
                  <div className="rp-modal__doc-attached-info">
                    <span className="rp-modal__doc-slot-badge">CCIR</span>
                    <span className="rp-modal__doc-filename">{pendingDoc.file.name}</span>
                    {isParsing && <span className="rp-modal__doc-parsing">Lendo dados...</span>}
                  </div>
                  <button
                    className="rp-modal__doc-remove"
                    onClick={() => setPendingDoc(null)}
                    aria-label={`Remover ${pendingDoc.file.name}`}
                    type="button"
                    disabled={isParsing}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  className="rp-modal__doc-upload-btn"
                  onClick={handleCcirClick}
                  type="button"
                >
                  <Upload size={14} aria-hidden="true" /> Anexar CCIR
                </button>
              )}
            </div>
          </div>

          {/* Seção 1: Dados do Imóvel Rural */}
          <section className="rp-modal__section">
            <h3 className="rp-modal__section-title">Dados do Imóvel Rural</h3>
            {/* Linha 1: Código INCRA (1/3) + Denominação (2/3) */}
            <div className="rp-modal__row rp-modal__row--1-2">
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-incra">
                  Código do imóvel
                </label>
                <input
                  id="rp-incra"
                  className="rp-modal__input"
                  value={fields.incraCode}
                  onChange={(e) => handleChange('incraCode', e.target.value)}
                  placeholder="XXX.XXX.XXX.XXX-X"
                />
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-denomination">
                  Denominação *
                </label>
                <input
                  id="rp-denomination"
                  className={`rp-modal__input ${errors.denomination ? 'rp-modal__input--error' : ''}`}
                  value={fields.denomination}
                  onChange={(e) => handleChange('denomination', e.target.value)}
                  placeholder="Ex: Fazenda Limeira"
                  aria-required="true"
                />
                {errors.denomination && (
                  <span className="rp-modal__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" /> {errors.denomination}
                  </span>
                )}
              </div>
            </div>

            {/* Linha 2: Área total, Classificação, Processamento, Área certificada */}
            <div className="rp-modal__row rp-modal__row--4">
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-area">
                  Área total (ha)
                </label>
                <input
                  id="rp-area"
                  type="text"
                  inputMode="decimal"
                  className="rp-modal__input"
                  value={fields.totalAreaHa}
                  onChange={(e) => handleDecimalChange('totalAreaHa', e.target.value)}
                  placeholder="0,0000"
                />
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-classification">
                  Classificação
                </label>
                <select
                  id="rp-classification"
                  className="rp-modal__select"
                  value={fields.landClassification}
                  onChange={(e) => handleChange('landClassification', e.target.value)}
                >
                  <option value="">Selecione</option>
                  {LAND_CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>
                      {CLASSIFICATION_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-proc-date">
                  Processamento
                </label>
                <input
                  id="rp-proc-date"
                  type="date"
                  className="rp-modal__input"
                  value={fields.lastProcessingDate}
                  onChange={(e) => handleChange('lastProcessingDate', e.target.value)}
                />
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-certified-area">
                  Área certificada (ha)
                </label>
                <input
                  id="rp-certified-area"
                  type="text"
                  inputMode="decimal"
                  className="rp-modal__input"
                  value={fields.certifiedAreaHa}
                  onChange={(e) => handleDecimalChange('certifiedAreaHa', e.target.value)}
                  placeholder="0,0000"
                />
              </div>
            </div>

            {/* Linha 3: Localização, Município, UF — mesma linha */}
            <div className="rp-modal__row rp-modal__row--loc">
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-location">
                  Indicações para localização
                </label>
                <input
                  id="rp-location"
                  className="rp-modal__input"
                  value={fields.locationDirections}
                  onChange={(e) => handleChange('locationDirections', e.target.value)}
                  placeholder="Estrada, rodovia, km..."
                />
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-municipality">
                  Município
                </label>
                <input
                  id="rp-municipality"
                  className="rp-modal__input"
                  value={fields.municipality}
                  onChange={(e) => handleChange('municipality', e.target.value)}
                  placeholder="Ex: Nepomuceno"
                />
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-state">
                  UF
                </label>
                <select
                  id="rp-state"
                  className="rp-modal__select"
                  value={fields.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                >
                  <option value="">Selecione</option>
                  {VALID_UF.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 4: Módulos — todos na mesma linha */}
            <div className="rp-modal__row rp-modal__row--5">
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-rural-module">
                  Módulo rural (ha)
                </label>
                <input
                  id="rp-rural-module"
                  type="text"
                  inputMode="decimal"
                  className="rp-modal__input"
                  value={fields.ruralModuleHa}
                  onChange={(e) => handleDecimalChange('ruralModuleHa', e.target.value)}
                  placeholder="0,0000"
                />
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-rural-count">
                  Nº mód. rurais
                </label>
                <input
                  id="rp-rural-count"
                  type="text"
                  inputMode="decimal"
                  className="rp-modal__input"
                  value={fields.ruralModulesCount}
                  onChange={(e) => handleDecimalChange('ruralModulesCount', e.target.value)}
                  placeholder="0,0000"
                />
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-fiscal-module">
                  Módulo fiscal (ha)
                </label>
                <input
                  id="rp-fiscal-module"
                  type="text"
                  inputMode="decimal"
                  className="rp-modal__input"
                  value={fields.fiscalModuleHa}
                  onChange={(e) => handleDecimalChange('fiscalModuleHa', e.target.value)}
                  placeholder="0,0000"
                />
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-fiscal-count">
                  Nº mód. fiscais
                </label>
                <input
                  id="rp-fiscal-count"
                  type="text"
                  inputMode="decimal"
                  className="rp-modal__input"
                  value={fields.fiscalModulesCount}
                  onChange={(e) => handleDecimalChange('fiscalModulesCount', e.target.value)}
                  placeholder="0,0000"
                />
              </div>

              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-min-partition">
                  Fração mín. (ha)
                </label>
                <input
                  id="rp-min-partition"
                  type="text"
                  inputMode="decimal"
                  className="rp-modal__input"
                  value={fields.minPartitionFraction}
                  onChange={(e) => handleDecimalChange('minPartitionFraction', e.target.value)}
                  placeholder="0,0000"
                />
              </div>
            </div>

            {/* Subseção: Situação Jurídica do Imóvel Rural (Áreas Registradas) */}
            <div className="rp-modal__section">
              <div className="owners-table__header">
                <h4 className="rp-modal__section-title" style={{ margin: 0 }}>
                  Situação Jurídica do Imóvel Rural (Áreas Registradas)
                </h4>
                <button
                  className="owners-table__add-btn"
                  onClick={() => {
                    setEditingRegIdx(null);
                    setRegForm({
                      number: '',
                      cartorioName: '',
                      comarca: '',
                      state: '',
                      areaHa: '',
                      cnsCode: '',
                      livro: '',
                      registrationDate: '',
                      file: null,
                    });
                    setRegFormVisible(true);
                  }}
                  type="button"
                >
                  <Plus size={16} aria-hidden="true" /> Adicionar matrícula
                </button>
              </div>

              <input
                ref={regFileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (regAttachRef.current != null) {
                    const idx = regAttachRef.current.idx;
                    setPendingRegistrations((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, file } : r)),
                    );
                    regAttachRef.current = null;
                  } else if (regFormVisible) {
                    setRegForm((f) => ({ ...f, file }));
                  }
                  if (regFileInputRef.current) regFileInputRef.current.value = '';
                }}
                aria-hidden="true"
              />

              {pendingRegistrations.length === 0 && !regFormVisible && (
                <p className="owners-table__empty">Nenhuma matrícula cadastrada.</p>
              )}

              <ul className="owners-table__list">
                {pendingRegistrations.map((r, i) => (
                  <li key={i} className="owners-table__item">
                    <div className="owners-table__item-info">
                      <span className="owners-table__item-name">Matrícula {r.number}</span>
                      <span className="owners-table__item-detail">
                        {r.cartorioName && `${r.cartorioName}`}
                        {r.areaHa && ` · ${r.areaHa} ha`}
                        {r.registrationDate && ` · ${r.registrationDate}`}
                      </span>
                      {r.file && (
                        <span
                          className="owners-table__item-detail"
                          style={{ color: 'var(--color-primary-600)' }}
                        >
                          <FileText
                            size={12}
                            aria-hidden="true"
                            style={{ display: 'inline', verticalAlign: 'middle' }}
                          />{' '}
                          {r.file.name}
                        </span>
                      )}
                    </div>
                    <div className="owners-table__item-actions">
                      {!r.file && (
                        <button
                          className="owners-table__icon-btn"
                          onClick={() => {
                            regAttachRef.current = { idx: i };
                            regFileInputRef.current?.click();
                          }}
                          aria-label={`Anexar PDF da matrícula ${r.number}`}
                          title="Anexar PDF"
                          type="button"
                        >
                          <Upload size={16} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        className="owners-table__icon-btn"
                        onClick={() => {
                          setEditingRegIdx(i);
                          setRegForm({ ...r });
                          setRegFormVisible(true);
                        }}
                        aria-label={`Editar matrícula ${r.number}`}
                        type="button"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="owners-table__icon-btn owners-table__icon-btn--danger"
                        onClick={() =>
                          setPendingRegistrations((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        aria-label={`Remover matrícula ${r.number}`}
                        type="button"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {regFormVisible && (
                <div className="owner-form">
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="reg-number">
                      Matrícula *
                    </label>
                    <input
                      id="reg-number"
                      className="rp-modal__input"
                      value={regForm.number}
                      onChange={(e) => setRegForm((f) => ({ ...f, number: e.target.value }))}
                      aria-required="true"
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="reg-cartorio">
                      Cartório *
                    </label>
                    <input
                      id="reg-cartorio"
                      className="rp-modal__input"
                      value={regForm.cartorioName}
                      onChange={(e) => setRegForm((f) => ({ ...f, cartorioName: e.target.value }))}
                      aria-required="true"
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="reg-comarca">
                      Comarca *
                    </label>
                    <input
                      id="reg-comarca"
                      className="rp-modal__input"
                      value={regForm.comarca}
                      onChange={(e) => setRegForm((f) => ({ ...f, comarca: e.target.value }))}
                      aria-required="true"
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="reg-state">
                      UF *
                    </label>
                    <select
                      id="reg-state"
                      className="rp-modal__select"
                      value={regForm.state}
                      onChange={(e) => setRegForm((f) => ({ ...f, state: e.target.value }))}
                      aria-required="true"
                    >
                      <option value="">UF</option>
                      {VALID_UF.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="reg-area">
                      Área (ha) *
                    </label>
                    <input
                      id="reg-area"
                      type="text"
                      inputMode="decimal"
                      className="rp-modal__input"
                      value={regForm.areaHa}
                      onChange={(e) =>
                        setRegForm((f) => ({ ...f, areaHa: formatDecimal(e.target.value) }))
                      }
                      placeholder="0,0000"
                      aria-required="true"
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="reg-date">
                      Data registro
                    </label>
                    <input
                      id="reg-date"
                      type="date"
                      className="rp-modal__input"
                      value={regForm.registrationDate}
                      onChange={(e) =>
                        setRegForm((f) => ({ ...f, registrationDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="reg-cns">
                      CNS / Ofício
                    </label>
                    <input
                      id="reg-cns"
                      className="rp-modal__input"
                      value={regForm.cnsCode}
                      onChange={(e) => setRegForm((f) => ({ ...f, cnsCode: e.target.value }))}
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="reg-livro">
                      Livro / Ficha
                    </label>
                    <input
                      id="reg-livro"
                      className="rp-modal__input"
                      value={regForm.livro}
                      onChange={(e) => setRegForm((f) => ({ ...f, livro: e.target.value }))}
                    />
                  </div>
                  <div className="rp-modal__field rp-modal__field--full">
                    <label className="rp-modal__label">PDF da matrícula</label>
                    {regForm.file ? (
                      <div className="rp-modal__doc-attached">
                        <div className="rp-modal__doc-attached-info">
                          <FileText size={16} aria-hidden="true" />
                          <span className="rp-modal__doc-filename">{regForm.file.name}</span>
                        </div>
                        <button
                          className="rp-modal__doc-remove"
                          onClick={() => setRegForm((f) => ({ ...f, file: null }))}
                          aria-label="Remover PDF"
                          type="button"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="rp-modal__doc-upload-btn"
                        onClick={() => {
                          regAttachRef.current = null;
                          regFileInputRef.current?.click();
                        }}
                        type="button"
                      >
                        <Upload size={14} aria-hidden="true" /> Anexar PDF
                      </button>
                    )}
                  </div>
                  <div className="owner-form__actions">
                    <button
                      className="rp-modal__btn"
                      onClick={() => setRegFormVisible(false)}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button
                      className="rp-modal__btn rp-modal__btn--primary"
                      onClick={() => {
                        if (
                          !regForm.number.trim() ||
                          !regForm.cartorioName.trim() ||
                          !regForm.comarca.trim() ||
                          !regForm.state ||
                          !regForm.areaHa
                        )
                          return;
                        if (editingRegIdx != null) {
                          setPendingRegistrations((prev) =>
                            prev.map((r, i) => (i === editingRegIdx ? { ...regForm } : r)),
                          );
                        } else {
                          setPendingRegistrations((prev) => [...prev, { ...regForm }]);
                        }
                        setRegFormVisible(false);
                      }}
                      type="button"
                    >
                      {editingRegIdx != null ? 'Salvar' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="rp-modal__row rp-modal__row--4">
                <div className="rp-modal__field">
                  <label className="rp-modal__label" htmlFor="rp-registered-area">
                    Registrada (ha)
                  </label>
                  <input
                    id="rp-registered-area"
                    type="text"
                    inputMode="decimal"
                    className="rp-modal__input"
                    value={fields.registeredAreaHa}
                    onChange={(e) => handleDecimalChange('registeredAreaHa', e.target.value)}
                    placeholder="0,0000"
                  />
                </div>
                <div className="rp-modal__field">
                  <label className="rp-modal__label" htmlFor="rp-possession-title">
                    Posse a justo título (ha)
                  </label>
                  <input
                    id="rp-possession-title"
                    type="text"
                    inputMode="decimal"
                    className="rp-modal__input"
                    value={fields.possessionByTitleHa}
                    onChange={(e) => handleDecimalChange('possessionByTitleHa', e.target.value)}
                    placeholder="0,0000"
                  />
                </div>
                <div className="rp-modal__field">
                  <label className="rp-modal__label" htmlFor="rp-possession-occupation">
                    Posse por ocupação (ha)
                  </label>
                  <input
                    id="rp-possession-occupation"
                    type="text"
                    inputMode="decimal"
                    className="rp-modal__input"
                    value={fields.possessionByOccupationHa}
                    onChange={(e) =>
                      handleDecimalChange('possessionByOccupationHa', e.target.value)
                    }
                    placeholder="0,0000"
                  />
                </div>
                <div className="rp-modal__field">
                  <label className="rp-modal__label" htmlFor="rp-measured-area">
                    Área medida (ha)
                  </label>
                  <input
                    id="rp-measured-area"
                    type="text"
                    inputMode="decimal"
                    className="rp-modal__input"
                    value={fields.measuredAreaHa}
                    onChange={(e) => handleDecimalChange('measuredAreaHa', e.target.value)}
                    placeholder="0,0000"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Seção 2: Dados do Declarante */}
          <section className="rp-modal__section">
            <h3 className="rp-modal__section-title">Dados do Declarante</h3>
            <div className="rp-modal__row rp-modal__row--declarant">
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-declarant-name">
                  Nome
                </label>
                <input
                  id="rp-declarant-name"
                  className="rp-modal__input"
                  value={declarant.name}
                  onChange={(e) => setDeclarant((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Nome do declarante"
                />
              </div>
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-declarant-doc">
                  CPF/CNPJ
                </label>
                <input
                  id="rp-declarant-doc"
                  className="rp-modal__input"
                  value={declarant.document}
                  onChange={(e) => setDeclarant((d) => ({ ...d, document: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-declarant-nationality">
                  Nacionalidade
                </label>
                <input
                  id="rp-declarant-nationality"
                  className="rp-modal__input"
                  value={declarant.nationality}
                  onChange={(e) => setDeclarant((d) => ({ ...d, nationality: e.target.value }))}
                  placeholder="Brasileira"
                />
              </div>
            </div>
          </section>

          {/* Seção 3: Titulares */}
          <section className="rp-modal__section">
            <div className="owners-table">
              <div className="owners-table__header">
                <h3 className="rp-modal__section-title" style={{ margin: 0 }}>
                  Titulares
                </h3>
                <button
                  className="owners-table__add-btn"
                  onClick={() => {
                    setEditingOwnerIdx(null);
                    setOwnerForm({
                      name: '',
                      document: '',
                      documentType: 'CPF',
                      fractionPct: '',
                      ownerType: 'PROPRIETARIO',
                    });
                    setOwnerFormVisible(true);
                  }}
                  type="button"
                >
                  <Plus size={16} aria-hidden="true" /> Adicionar
                </button>
              </div>

              {pendingOwners.length === 0 && !ownerFormVisible && (
                <p className="owners-table__empty">Nenhum titular cadastrado.</p>
              )}

              <ul className="owners-table__list">
                {pendingOwners.map((o, i) => (
                  <li key={i} className="owners-table__item">
                    <div className="owners-table__item-info">
                      <span className="owners-table__item-name">{o.name}</span>
                      <span className="owners-table__item-detail">
                        {o.document && `${o.documentType || 'Doc'}: ${o.document}`}
                        {o.fractionPct != null && ` · ${o.fractionPct}%`}
                        {` · ${OWNER_TYPES.find((t) => t.value === o.ownerType)?.label || o.ownerType}`}
                      </span>
                    </div>
                    <div className="owners-table__item-actions">
                      <button
                        className="owners-table__icon-btn"
                        onClick={() => {
                          setEditingOwnerIdx(i);
                          setOwnerForm({
                            name: o.name,
                            document: o.document || '',
                            documentType: o.documentType || 'CPF',
                            fractionPct: o.fractionPct != null ? String(o.fractionPct) : '',
                            ownerType: o.ownerType || 'PROPRIETARIO',
                          });
                          setOwnerFormVisible(true);
                        }}
                        aria-label={`Editar ${o.name}`}
                        type="button"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="owners-table__icon-btn owners-table__icon-btn--danger"
                        onClick={() =>
                          setPendingOwners((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        aria-label={`Remover ${o.name}`}
                        type="button"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {ownerFormVisible && (
                <div className="owner-form">
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="owner-name">
                      Nome *
                    </label>
                    <input
                      id="owner-name"
                      className="rp-modal__input"
                      value={ownerForm.name}
                      onChange={(e) => setOwnerForm((f) => ({ ...f, name: e.target.value }))}
                      aria-required="true"
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="owner-doc-type">
                      Tipo doc.
                    </label>
                    <select
                      id="owner-doc-type"
                      className="rp-modal__select"
                      value={ownerForm.documentType}
                      onChange={(e) =>
                        setOwnerForm((f) => ({ ...f, documentType: e.target.value }))
                      }
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
                      value={ownerForm.document}
                      onChange={(e) => setOwnerForm((f) => ({ ...f, document: e.target.value }))}
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="owner-fraction">
                      Fração (%)
                    </label>
                    <input
                      id="owner-fraction"
                      type="text"
                      inputMode="decimal"
                      className="rp-modal__input"
                      value={ownerForm.fractionPct}
                      onChange={(e) => setOwnerForm((f) => ({ ...f, fractionPct: e.target.value }))}
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="owner-type">
                      Tipo
                    </label>
                    <select
                      id="owner-type"
                      className="rp-modal__select"
                      value={ownerForm.ownerType}
                      onChange={(e) => setOwnerForm((f) => ({ ...f, ownerType: e.target.value }))}
                    >
                      {OWNER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="owner-form__actions">
                    <button
                      className="rp-modal__btn"
                      onClick={() => setOwnerFormVisible(false)}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button
                      className="rp-modal__btn rp-modal__btn--primary"
                      onClick={() => {
                        if (!ownerForm.name.trim()) return;
                        const payload: CreateOwnerPayload = {
                          name: ownerForm.name.trim(),
                          document: ownerForm.document || undefined,
                          documentType: ownerForm.documentType || undefined,
                          fractionPct: ownerForm.fractionPct
                            ? parseFloat(ownerForm.fractionPct.replace(',', '.'))
                            : undefined,
                          ownerType: ownerForm.ownerType,
                        };
                        if (editingOwnerIdx != null) {
                          setPendingOwners((prev) =>
                            prev.map((o, i) => (i === editingOwnerIdx ? payload : o)),
                          );
                        } else {
                          setPendingOwners((prev) => [...prev, payload]);
                        }
                        setOwnerFormVisible(false);
                      }}
                      type="button"
                    >
                      {editingOwnerIdx != null ? 'Salvar' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Dados de Controle (última seção — será substituída pela Camada 2: Histórico CCIR) */}
          <section className="rp-modal__section">
            <h3 className="rp-modal__section-title">Dados de Controle</h3>
            <div className="rp-modal__row rp-modal__row--5">
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-ccir-issued">
                  Lançamento
                </label>
                <input
                  id="rp-ccir-issued"
                  type="date"
                  className="rp-modal__input"
                  value={fields.ccirIssuedAt}
                  onChange={(e) => handleChange('ccirIssuedAt', e.target.value)}
                />
              </div>
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-ccir">
                  Nº do CCIR
                </label>
                <input
                  id="rp-ccir"
                  className="rp-modal__input"
                  value={fields.ccirCode}
                  onChange={(e) => handleChange('ccirCode', e.target.value)}
                  placeholder="70896758258"
                />
              </div>
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-ccir-generated">
                  Geração
                </label>
                <input
                  id="rp-ccir-generated"
                  type="date"
                  className="rp-modal__input"
                  value={fields.ccirGeneratedAt}
                  onChange={(e) => handleChange('ccirGeneratedAt', e.target.value)}
                />
              </div>
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-ccir-valid">
                  Vencimento
                </label>
                <input
                  id="rp-ccir-valid"
                  type="date"
                  className="rp-modal__input"
                  value={fields.ccirValidUntil}
                  onChange={(e) => handleChange('ccirValidUntil', e.target.value)}
                />
              </div>
              <div className="rp-modal__field">
                <label className="rp-modal__label" htmlFor="rp-ccir-status">
                  Situação
                </label>
                <select
                  id="rp-ccir-status"
                  className="rp-modal__select"
                  value={fields.ccirPaymentStatus}
                  onChange={(e) => handleChange('ccirPaymentStatus', e.target.value)}
                >
                  <option value="">Selecione</option>
                  <option value="QUITADO">Quitado</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="VENCIDO">Vencido</option>
                </select>
              </div>
            </div>
          </section>

          {/* Seção: Perímetro */}
          <section className="rp-modal__section">
            <h3 className="rp-modal__section-title">Perímetro do Imóvel</h3>
            {pendingBoundaryFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--color-neutral-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-neutral-200)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    <MapPin
                      size={20}
                      aria-hidden="true"
                      style={{ color: 'var(--color-primary-600)' }}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--color-neutral-800)' }}>
                      Arquivo selecionado
                    </span>
                  </div>
                  <span style={{ color: 'var(--color-neutral-600)', fontSize: 'var(--text-sm)' }}>
                    {pendingBoundaryFile.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <label
                    className="rp-modal__btn"
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <Upload size={16} aria-hidden="true" /> Substituir arquivo
                    <input
                      ref={boundaryFileRef}
                      type="file"
                      accept=".geojson,.json,.kml,.kmz,.zip"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setPendingBoundaryFile(f);
                        if (boundaryFileRef.current) boundaryFileRef.current.value = '';
                      }}
                    />
                  </label>
                  <button
                    className="rp-modal__btn rp-modal__btn--danger"
                    type="button"
                    onClick={() => setPendingBoundaryFile(null)}
                  >
                    <Trash2 size={16} aria-hidden="true" /> Remover
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-8) var(--space-4)',
                  border: '2px dashed var(--color-neutral-300)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <MapPin
                  size={48}
                  aria-hidden="true"
                  style={{ color: 'var(--color-neutral-400)' }}
                />
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--color-neutral-700)', margin: 0 }}>
                    Nenhum perímetro selecionado
                  </p>
                  <p
                    style={{
                      color: 'var(--color-neutral-500)',
                      fontSize: 'var(--text-sm)',
                      margin: 'var(--space-1) 0 0',
                    }}
                  >
                    Envie um arquivo com os polígonos do imóvel. Será processado após o cadastro.
                  </p>
                </div>
                <label
                  className="rp-modal__btn rp-modal__btn--primary"
                  style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <Upload size={16} aria-hidden="true" /> Selecionar arquivo
                  <input
                    ref={boundaryFileRef}
                    type="file"
                    accept=".geojson,.json,.kml,.kmz,.zip"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setPendingBoundaryFile(f);
                      if (boundaryFileRef.current) boundaryFileRef.current.value = '';
                    }}
                  />
                </label>
                <p
                  style={{
                    color: 'var(--color-neutral-400)',
                    fontSize: 'var(--text-xs)',
                    margin: 0,
                  }}
                >
                  Formatos aceitos: GeoJSON, KML, KMZ, Shapefile (.zip)
                </p>
              </div>
            )}
          </section>

          {submitError && (
            <div className="rp-modal__error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
              <AlertCircle size={16} aria-hidden="true" /> {submitError}
            </div>
          )}
        </div>

        <div className="rp-modal__footer">
          <button className="rp-modal__btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="rp-modal__btn rp-modal__btn--primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            type="button"
          >
            {isSubmitting ? 'Cadastrando...' : 'Cadastrar imóvel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal (3 steps) ────────────────────────────────────────

function EditPropertyModal({
  onClose,
  onSuccess,
  farmId,
  propertyId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  farmId: string;
  propertyId: string;
}) {
  const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
  const [errors, setErrors] = useState<Partial<Record<keyof FormFields, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { property, isLoading } = useRuralPropertyDetail({ farmId, propertyId });

  // Boundary state
  const [boundaryInfo, setBoundaryInfo] = useState<PropertyBoundaryInfo | null>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundaryUploading, setBoundaryUploading] = useState(false);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [boundarySuccess, setBoundarySuccess] = useState<string | null>(null);
  const boundaryFileRef = useRef<HTMLInputElement>(null);

  const fetchBoundary = useCallback(async () => {
    setBoundaryLoading(true);
    setBoundaryError(null);
    try {
      const info = await getPropertyBoundary(farmId, propertyId);
      setBoundaryInfo(info);
    } catch {
      setBoundaryError('Erro ao carregar perímetro');
    } finally {
      setBoundaryLoading(false);
    }
  }, [farmId, propertyId]);

  const handleBoundaryUpload = useCallback(
    async (file: File) => {
      setBoundaryUploading(true);
      setBoundaryError(null);
      setBoundarySuccess(null);
      try {
        const result = await uploadPropertyBoundary(farmId, propertyId, file);
        setBoundarySuccess(
          `Perímetro enviado — ${result.polygonCount} polígono${result.polygonCount > 1 ? 's' : ''}, ${result.boundaryAreaHa.toLocaleString('pt-BR')} ha`,
        );
        await fetchBoundary();
      } catch (err: unknown) {
        setBoundaryError(err instanceof Error ? err.message : 'Erro ao enviar perímetro');
      } finally {
        setBoundaryUploading(false);
        if (boundaryFileRef.current) boundaryFileRef.current.value = '';
      }
    },
    [farmId, propertyId, fetchBoundary],
  );

  const handleBoundaryDelete = useCallback(async () => {
    setBoundaryError(null);
    setBoundarySuccess(null);
    try {
      await deletePropertyBoundary(farmId, propertyId);
      setBoundaryInfo({
        hasBoundary: false,
        boundaryAreaHa: null,
        boundaryGeoJSON: null,
        polygonCount: 0,
      });
      setBoundarySuccess('Perímetro removido');
    } catch {
      setBoundaryError('Erro ao remover perímetro');
    }
  }, [farmId, propertyId]);

  useEffect(() => {
    if (property) setFields(detailToFields(property));
  }, [property]);

  useEffect(() => {
    fetchBoundary();
  }, [fetchBoundary]);

  const handleChange = useCallback(
    (field: keyof FormFields, value: string | boolean) => {
      setFields((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors],
  );

  const handleDecimalChange = useCallback(
    (field: keyof FormFields, value: string, decimals: number = 4) => {
      handleChange(field, formatDecimal(value, decimals));
    },
    [handleChange],
  );

  const handleSubmit = async () => {
    const newErrors: Partial<Record<keyof FormFields, string>> = {};
    if (!fields.denomination.trim()) newErrors.denomination = 'Denominação é obrigatória';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await updateRuralProperty(farmId, propertyId, buildPayload(fields));
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao salvar imóvel rural');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="rp-modal__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Editar imóvel rural"
    >
      <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rp-modal__header">
          <h2 className="rp-modal__title">Editar Imóvel Rural</h2>
          <button className="rp-modal__close" onClick={onClose} aria-label="Fechar" type="button">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="rp-modal__body">
          {isLoading ? (
            <div className="rp-modal__fields">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rp-modal__field"
                  style={{
                    height: 72,
                    background: 'var(--color-neutral-100)',
                    borderRadius: 'var(--radius-md)',
                    animation: 'skeleton-pulse 1.5s infinite',
                  }}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Seção 1: Dados do Imóvel Rural */}
              <section className="rp-modal__section">
                <h3 className="rp-modal__section-title">Dados do Imóvel Rural</h3>
                {/* Linha 1: Código INCRA (1/3) + Denominação (2/3) */}
                <div className="rp-modal__row rp-modal__row--1-2">
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-incra">
                      Código do imóvel
                    </label>
                    <input
                      id="rp-incra"
                      className="rp-modal__input"
                      value={fields.incraCode}
                      onChange={(e) => handleChange('incraCode', e.target.value)}
                      placeholder="XXX.XXX.XXX.XXX-X"
                    />
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-denomination">
                      Denominação *
                    </label>
                    <input
                      id="rp-denomination"
                      className={`rp-modal__input ${errors.denomination ? 'rp-modal__input--error' : ''}`}
                      value={fields.denomination}
                      onChange={(e) => handleChange('denomination', e.target.value)}
                      placeholder="Ex: Fazenda Limeira"
                      aria-required="true"
                    />
                    {errors.denomination && (
                      <span className="rp-modal__error" role="alert">
                        <AlertCircle size={14} aria-hidden="true" /> {errors.denomination}
                      </span>
                    )}
                  </div>
                </div>

                {/* Linha 2: Área total, Classificação, Processamento, Área certificada */}
                <div className="rp-modal__row rp-modal__row--4">
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-area">
                      Área total (ha)
                    </label>
                    <input
                      id="rp-area"
                      type="text"
                      inputMode="decimal"
                      className="rp-modal__input"
                      value={fields.totalAreaHa}
                      onChange={(e) => handleDecimalChange('totalAreaHa', e.target.value)}
                      placeholder="0,0000"
                    />
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-classification">
                      Classificação
                    </label>
                    <select
                      id="rp-classification"
                      className="rp-modal__select"
                      value={fields.landClassification}
                      onChange={(e) => handleChange('landClassification', e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {LAND_CLASSIFICATIONS.map((c) => (
                        <option key={c} value={c}>
                          {CLASSIFICATION_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-proc-date">
                      Processamento
                    </label>
                    <input
                      id="rp-proc-date"
                      type="date"
                      className="rp-modal__input"
                      value={fields.lastProcessingDate}
                      onChange={(e) => handleChange('lastProcessingDate', e.target.value)}
                    />
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-certified-area">
                      Área certificada (ha)
                    </label>
                    <input
                      id="rp-certified-area"
                      type="text"
                      inputMode="decimal"
                      className="rp-modal__input"
                      value={fields.certifiedAreaHa}
                      onChange={(e) => handleDecimalChange('certifiedAreaHa', e.target.value)}
                      placeholder="0,0000"
                    />
                  </div>
                </div>

                {/* Linha 3: Localização, Município, UF */}
                <div className="rp-modal__row rp-modal__row--loc">
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-location">
                      Indicações para localização
                    </label>
                    <input
                      id="rp-location"
                      className="rp-modal__input"
                      value={fields.locationDirections}
                      onChange={(e) => handleChange('locationDirections', e.target.value)}
                      placeholder="Estrada, rodovia, km..."
                    />
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-municipality">
                      Município
                    </label>
                    <input
                      id="rp-municipality"
                      className="rp-modal__input"
                      value={fields.municipality}
                      onChange={(e) => handleChange('municipality', e.target.value)}
                      placeholder="Ex: Nepomuceno"
                    />
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-state">
                      UF
                    </label>
                    <select
                      id="rp-state"
                      className="rp-modal__select"
                      value={fields.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {VALID_UF.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Linha 4: Módulos */}
                <div className="rp-modal__row rp-modal__row--5">
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-rural-module">
                      Módulo rural (ha)
                    </label>
                    <input
                      id="rp-rural-module"
                      type="text"
                      inputMode="decimal"
                      className="rp-modal__input"
                      value={fields.ruralModuleHa}
                      onChange={(e) => handleDecimalChange('ruralModuleHa', e.target.value)}
                      placeholder="0,0000"
                    />
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-rural-count">
                      Nº mód. rurais
                    </label>
                    <input
                      id="rp-rural-count"
                      type="text"
                      inputMode="decimal"
                      className="rp-modal__input"
                      value={fields.ruralModulesCount}
                      onChange={(e) => handleDecimalChange('ruralModulesCount', e.target.value)}
                      placeholder="0,0000"
                    />
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-fiscal-module">
                      Módulo fiscal (ha)
                    </label>
                    <input
                      id="rp-fiscal-module"
                      type="text"
                      inputMode="decimal"
                      className="rp-modal__input"
                      value={fields.fiscalModuleHa}
                      onChange={(e) => handleDecimalChange('fiscalModuleHa', e.target.value)}
                      placeholder="0,0000"
                    />
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-fiscal-count">
                      Nº mód. fiscais
                    </label>
                    <input
                      id="rp-fiscal-count"
                      type="text"
                      inputMode="decimal"
                      className="rp-modal__input"
                      value={fields.fiscalModulesCount}
                      onChange={(e) => handleDecimalChange('fiscalModulesCount', e.target.value)}
                      placeholder="0,0000"
                    />
                  </div>

                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-min-partition">
                      Fração mín. (ha)
                    </label>
                    <input
                      id="rp-min-partition"
                      type="text"
                      inputMode="decimal"
                      className="rp-modal__input"
                      value={fields.minPartitionFraction}
                      onChange={(e) => handleDecimalChange('minPartitionFraction', e.target.value)}
                      placeholder="0,0000"
                    />
                  </div>
                </div>

                {/* Subseção: Situação Jurídica (Matrículas + CAR) */}
                <div className="rp-modal__section">
                  <h4 className="rp-modal__section-title">Situação Jurídica do Imóvel Rural</h4>

                  <PropertyLinkedEntities
                    farmId={farmId}
                    propertyId={propertyId}
                    show="registrations"
                  />

                  <div className="rp-modal__row rp-modal__row--4">
                    <div className="rp-modal__field">
                      <label className="rp-modal__label" htmlFor="rp-registered-area">
                        Registrada (ha)
                      </label>
                      <input
                        id="rp-registered-area"
                        type="text"
                        inputMode="decimal"
                        className="rp-modal__input"
                        value={fields.registeredAreaHa}
                        onChange={(e) => handleDecimalChange('registeredAreaHa', e.target.value)}
                        placeholder="0,0000"
                      />
                    </div>
                    <div className="rp-modal__field">
                      <label className="rp-modal__label" htmlFor="rp-possession-title">
                        Posse a justo título (ha)
                      </label>
                      <input
                        id="rp-possession-title"
                        type="text"
                        inputMode="decimal"
                        className="rp-modal__input"
                        value={fields.possessionByTitleHa}
                        onChange={(e) => handleDecimalChange('possessionByTitleHa', e.target.value)}
                        placeholder="0,0000"
                      />
                    </div>
                    <div className="rp-modal__field">
                      <label className="rp-modal__label" htmlFor="rp-possession-occupation">
                        Posse por ocupação (ha)
                      </label>
                      <input
                        id="rp-possession-occupation"
                        type="text"
                        inputMode="decimal"
                        className="rp-modal__input"
                        value={fields.possessionByOccupationHa}
                        onChange={(e) =>
                          handleDecimalChange('possessionByOccupationHa', e.target.value)
                        }
                        placeholder="0,0000"
                      />
                    </div>
                    <div className="rp-modal__field">
                      <label className="rp-modal__label" htmlFor="rp-measured-area">
                        Área medida (ha)
                      </label>
                      <input
                        id="rp-measured-area"
                        type="text"
                        inputMode="decimal"
                        className="rp-modal__input"
                        value={fields.measuredAreaHa}
                        onChange={(e) => handleDecimalChange('measuredAreaHa', e.target.value)}
                        placeholder="0,0000"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Seção 2: Titulares */}
              <section className="rp-modal__section">
                <h3 className="rp-modal__section-title">Titulares</h3>
                <PropertyOwnersTable farmId={farmId} propertyId={propertyId} />
              </section>

              {/* Seção 3: Dados de Controle */}
              <section className="rp-modal__section">
                <h3 className="rp-modal__section-title">Dados de Controle</h3>
                <div className="rp-modal__row rp-modal__row--5">
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-ccir-issued">
                      Lançamento
                    </label>
                    <input
                      id="rp-ccir-issued"
                      type="date"
                      className="rp-modal__input"
                      value={fields.ccirIssuedAt}
                      onChange={(e) => handleChange('ccirIssuedAt', e.target.value)}
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-ccir">
                      Nº do CCIR
                    </label>
                    <input
                      id="rp-ccir"
                      className="rp-modal__input"
                      value={fields.ccirCode}
                      onChange={(e) => handleChange('ccirCode', e.target.value)}
                      placeholder="70896758258"
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-ccir-generated">
                      Geração
                    </label>
                    <input
                      id="rp-ccir-generated"
                      type="date"
                      className="rp-modal__input"
                      value={fields.ccirGeneratedAt}
                      onChange={(e) => handleChange('ccirGeneratedAt', e.target.value)}
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-ccir-valid">
                      Vencimento
                    </label>
                    <input
                      id="rp-ccir-valid"
                      type="date"
                      className="rp-modal__input"
                      value={fields.ccirValidUntil}
                      onChange={(e) => handleChange('ccirValidUntil', e.target.value)}
                    />
                  </div>
                  <div className="rp-modal__field">
                    <label className="rp-modal__label" htmlFor="rp-ccir-status">
                      Situação
                    </label>
                    <select
                      id="rp-ccir-status"
                      className="rp-modal__select"
                      value={fields.ccirPaymentStatus}
                      onChange={(e) => handleChange('ccirPaymentStatus', e.target.value)}
                    >
                      <option value="">Selecione</option>
                      <option value="QUITADO">Quitado</option>
                      <option value="PENDENTE">Pendente</option>
                      <option value="VENCIDO">Vencido</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Seção 5: Documentos */}
              <section className="rp-modal__section">
                <h3 className="rp-modal__section-title">Documentos</h3>
                <p className="rp-modal__section-hint">
                  Gerencie CAFIR, CCIR, CAR, matrículas e outros documentos do imóvel.
                </p>
                <PropertyDocumentsSection farmId={farmId} propertyId={propertyId} />
              </section>

              {/* Seção 6: Perímetro */}
              <section className="rp-modal__section">
                <h3 className="rp-modal__section-title">Perímetro do Imóvel</h3>

                {boundarySuccess && (
                  <div
                    className="rp-modal__success"
                    role="status"
                    style={{ marginBottom: 'var(--space-3)' }}
                  >
                    <Check size={16} aria-hidden="true" /> {boundarySuccess}
                  </div>
                )}
                {boundaryError && (
                  <div
                    className="rp-modal__error"
                    role="alert"
                    style={{ marginBottom: 'var(--space-3)' }}
                  >
                    <AlertCircle size={16} aria-hidden="true" /> {boundaryError}
                  </div>
                )}

                {boundaryLoading ? (
                  <div className="rp-modal__fields">
                    <div
                      style={{
                        height: 120,
                        background: 'var(--color-neutral-100)',
                        borderRadius: 'var(--radius-md)',
                        animation: 'skeleton-pulse 1.5s infinite',
                      }}
                    />
                  </div>
                ) : boundaryInfo?.hasBoundary ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        background: 'var(--color-neutral-50)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-neutral-200)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          marginBottom: 'var(--space-2)',
                        }}
                      >
                        <MapPin
                          size={20}
                          aria-hidden="true"
                          style={{ color: 'var(--color-primary-600)' }}
                        />
                        <span style={{ fontWeight: 600, color: 'var(--color-neutral-800)' }}>
                          Perímetro cadastrado
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 'var(--space-6)',
                          color: 'var(--color-neutral-600)',
                          fontSize: 'var(--text-sm)',
                        }}
                      >
                        <span>
                          Área:{' '}
                          <strong>{boundaryInfo.boundaryAreaHa?.toLocaleString('pt-BR')} ha</strong>
                        </span>
                        <span>
                          Polígonos: <strong>{boundaryInfo.polygonCount}</strong>
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <label
                        className="rp-modal__btn"
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <Upload size={16} aria-hidden="true" />
                        {boundaryUploading ? 'Enviando...' : 'Substituir arquivo'}
                        <input
                          ref={boundaryFileRef}
                          type="file"
                          accept=".geojson,.json,.kml,.kmz,.zip"
                          style={{ display: 'none' }}
                          disabled={boundaryUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleBoundaryUpload(f);
                          }}
                        />
                      </label>
                      <button
                        className="rp-modal__btn rp-modal__btn--danger"
                        type="button"
                        onClick={handleBoundaryDelete}
                        disabled={boundaryUploading}
                      >
                        <Trash2 size={16} aria-hidden="true" /> Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-8) var(--space-4)',
                      border: '2px dashed var(--color-neutral-300)',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'center',
                    }}
                  >
                    <MapPin
                      size={48}
                      aria-hidden="true"
                      style={{ color: 'var(--color-neutral-400)' }}
                    />
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--color-neutral-700)', margin: 0 }}>
                        Nenhum perímetro cadastrado
                      </p>
                      <p
                        style={{
                          color: 'var(--color-neutral-500)',
                          fontSize: 'var(--text-sm)',
                          margin: 'var(--space-1) 0 0',
                        }}
                      >
                        Envie um arquivo com os polígonos do imóvel. Múltiplos polígonos serão
                        combinados.
                      </p>
                    </div>
                    <label
                      className="rp-modal__btn rp-modal__btn--primary"
                      style={{
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <Upload size={16} aria-hidden="true" />
                      {boundaryUploading ? 'Enviando...' : 'Enviar arquivo'}
                      <input
                        ref={boundaryFileRef}
                        type="file"
                        accept=".geojson,.json,.kml,.kmz,.zip"
                        style={{ display: 'none' }}
                        disabled={boundaryUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleBoundaryUpload(f);
                        }}
                      />
                    </label>
                    <p
                      style={{
                        color: 'var(--color-neutral-400)',
                        fontSize: 'var(--text-xs)',
                        margin: 0,
                      }}
                    >
                      Formatos aceitos: GeoJSON, KML, KMZ, Shapefile (.zip)
                    </p>
                  </div>
                )}
              </section>

              {/* Seção 7: CAR Vinculados */}
              <section className="rp-modal__section">
                <h3 className="rp-modal__section-title">CAR Vinculados</h3>
                <PropertyLinkedEntities farmId={farmId} propertyId={propertyId} show="cars" />
              </section>
            </>
          )}

          {submitError && (
            <div className="rp-modal__error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
              <AlertCircle size={16} aria-hidden="true" /> {submitError}
            </div>
          )}
        </div>

        <div className="rp-modal__footer">
          <button className="rp-modal__btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="rp-modal__btn rp-modal__btn--primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            type="button"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar imóvel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Exported wrapper ────────────────────────────────────────────

export function RuralPropertyModal({
  isOpen,
  onClose,
  onSuccess,
  farmId,
  propertyId,
}: RuralPropertyModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (propertyId && farmId) {
    return (
      <EditPropertyModal
        onClose={onClose}
        onSuccess={onSuccess}
        farmId={farmId}
        propertyId={propertyId}
      />
    );
  }

  return <CreatePropertyModal onClose={onClose} onSuccess={onSuccess} farmId={farmId} />;
}
