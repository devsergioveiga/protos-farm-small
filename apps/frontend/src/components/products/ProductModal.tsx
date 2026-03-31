import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  Loader2,
  FlaskConical,
  Beaker,
  Pill,
  Sprout,
  Wrench,
  Package,
} from 'lucide-react';
import { api } from '@/services/api';
import { useMeasurementUnits } from '@/hooks/useMeasurementUnits';
import { useProductClasses } from '@/hooks/useProductClasses';
import { useManufacturers } from '@/hooks/useManufacturers';
import { useActiveIngredients } from '@/hooks/useActiveIngredients';
import ActiveIngredientModal from '@/components/active-ingredients/ActiveIngredientModal';
import type { ProductItem } from '@/hooks/useProducts';
import './ProductModal.css';

// ─── Constants ──────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { value: 'semente', label: 'Semente' },
  { value: 'fertilizante', label: 'Fertilizante' },
  { value: 'defensivo_herbicida', label: 'Herbicida' },
  { value: 'defensivo_inseticida', label: 'Inseticida' },
  { value: 'defensivo_fungicida', label: 'Fungicida' },
  { value: 'defensivo_acaricida', label: 'Acaricida' },
  { value: 'adjuvante', label: 'Adjuvante' },
  { value: 'corretivo_calcario', label: 'Calcário' },
  { value: 'corretivo_gesso', label: 'Gesso' },
  { value: 'inoculante', label: 'Inoculante' },
  { value: 'biologico', label: 'Biológico' },
  { value: 'vacina', label: 'Vacina' },
  { value: 'medicamento_veterinario', label: 'Medicamento Veterinário' },
  { value: 'hormonio_reprodutivo', label: 'Hormônio Reprodutivo' },
  { value: 'suplemento_mineral_vitaminico', label: 'Suplemento Mineral/Vitamínico' },
  { value: 'semen', label: 'Sêmen' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'peca_componente', label: 'Peça/Componente' },
  { value: 'epi', label: 'EPI' },
  { value: 'material_consumo', label: 'Material de Consumo' },
  { value: 'outro', label: 'Outro' },
];

const SERVICE_TYPES = [
  { value: 'consultoria_agronomica', label: 'Consultoria Agronômica' },
  { value: 'consultoria_veterinaria', label: 'Consultoria Veterinária' },
  { value: 'inseminacao_artificial', label: 'Inseminação Artificial' },
  { value: 'analise_laboratorial', label: 'Análise Laboratorial' },
  { value: 'transporte_leite', label: 'Transporte de Leite' },
  { value: 'frete_insumos', label: 'Frete de Insumos' },
  { value: 'manutencao_equipamento', label: 'Manutenção de Equipamento' },
  { value: 'topografia_georreferenciamento', label: 'Topografia/Georreferenciamento' },
  { value: 'assessoria_contabil_fiscal', label: 'Assessoria Contábil/Fiscal' },
  { value: 'servico_maquinas_terceirizado', label: 'Serviço de Máquinas Terceirizado' },
  { value: 'certificacao_auditoria', label: 'Certificação/Auditoria' },
  { value: 'outro', label: 'Outro' },
];

const CHARGE_UNITS = [
  { value: 'hora', label: 'Hora' },
  { value: 'diaria', label: 'Diária' },
  { value: 'visita', label: 'Visita' },
  { value: 'hectare', label: 'Hectare' },
  { value: 'amostra', label: 'Amostra' },
  { value: 'km', label: 'Km' },
  { value: 'cabeca', label: 'Cabeça' },
  { value: 'mes', label: 'Mês' },
  { value: 'valor_fixo', label: 'Valor Fixo' },
];

const FREQUENCIES = [
  { value: 'avulso', label: 'Avulso' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'por_demanda', label: 'Por Demanda' },
];

const TOXICITY_CLASSES = [
  { value: 'I', label: 'I — Extremamente tóxico' },
  { value: 'II', label: 'II — Altamente tóxico' },
  { value: 'III', label: 'III — Moderadamente tóxico' },
  { value: 'IV', label: 'IV — Pouco tóxico' },
  { value: 'V', label: 'V — Improvável toxicidade' },
];

const ENVIRONMENTAL_CLASSES = [
  { value: 'I', label: 'I — Altamente perigoso' },
  { value: 'II', label: 'II — Muito perigoso' },
  { value: 'III', label: 'III — Perigoso' },
  { value: 'IV', label: 'IV — Pouco perigoso' },
];

const NUTRIENT_FORMS = [
  { value: 'granulado', label: 'Granulado' },
  { value: 'liquido', label: 'Líquido' },
  { value: 'foliar', label: 'Foliar' },
  { value: 'fertirrigacao', label: 'Fertirrigação' },
];

const SOLUBILITY_OPTIONS = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'lenta_liberacao', label: 'Lenta Liberação' },
];

const THERAPEUTIC_CLASSES = [
  { value: 'antibiotico', label: 'Antibiótico' },
  { value: 'anti_inflamatorio', label: 'Anti-inflamatório' },
  { value: 'antiparasitario', label: 'Antiparasitário' },
  { value: 'hormonio', label: 'Hormônio' },
  { value: 'vacina', label: 'Vacina' },
  { value: 'vitamina', label: 'Vitamina' },
  { value: 'mineral', label: 'Mineral' },
  { value: 'anestesico', label: 'Anestésico' },
  { value: 'outro', label: 'Outro' },
];

const ADMIN_ROUTES = [
  { value: 'IM', label: 'Intramuscular (IM)' },
  { value: 'SC', label: 'Subcutânea (SC)' },
  { value: 'IV', label: 'Intravenosa (IV)' },
  { value: 'oral', label: 'Oral' },
  { value: 'intramamaria', label: 'Intramamária' },
  { value: 'intravaginal', label: 'Intravaginal' },
  { value: 'topica', label: 'Tópica' },
  { value: 'outro', label: 'Outro' },
];

const STORAGE_CONDITIONS = [
  { value: 'ambiente', label: 'Ambiente' },
  { value: 'refrigerado_2_8', label: 'Refrigerado (2–8°C)' },
  { value: 'congelado', label: 'Congelado' },
];

// ─── Helpers ────────────────────────────────────────────────────────

function isDefensivo(type: string) {
  return [
    'defensivo_herbicida',
    'defensivo_inseticida',
    'defensivo_fungicida',
    'defensivo_acaricida',
  ].includes(type);
}

function isFertilizante(type: string) {
  return type === 'fertilizante';
}

function isSemente(type: string) {
  return type === 'semente';
}

function isMedicamentoVet(type: string) {
  return [
    'vacina',
    'medicamento_veterinario',
    'hormonio_reprodutivo',
    'suplemento_mineral_vitaminico',
  ].includes(type);
}

// ─── Types ──────────────────────────────────────────────────────────

interface CompositionRow {
  activeIngredient: string;
  concentration: string;
  function: string;
}

interface WithdrawalRow {
  crop: string;
  days: string;
}

interface Props {
  isOpen: boolean;
  product: ProductItem | null;
  defaultNature: 'PRODUCT' | 'SERVICE';
  onClose: () => void;
  onSuccess: (created?: { id: string; name: string }) => void;
  initialName?: string;
}

// ─── Component ──────────────────────────────────────────────────────

export default function ProductModal({
  isOpen,
  product,
  defaultNature,
  onClose,
  onSuccess,
  initialName,
}: Props) {
  const isEditing = !!product;

  // Basic fields
  const [nature, setNature] = useState<'PRODUCT' | 'SERVICE'>(defaultNature);
  const [_name, setName] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [notes, setNotes] = useState('');

  // Product class
  const [productClassId, setProductClassId] = useState('');
  const [productClassSearch, setProductClassSearch] = useState('');
  const [showProductClassDropdown, setShowProductClassDropdown] = useState(false);
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  // Product fields
  const [commercialName, setCommercialName] = useState('');
  const [manufacturerName, setManufacturerName] = useState('');
  const [manufacturerCnpj, setManufacturerCnpj] = useState('');
  const [showManufacturerDropdown, setShowManufacturerDropdown] = useState(false);
  const [isCreatingManufacturer, setIsCreatingManufacturer] = useState(false);
  const [measurementUnitId, setMeasurementUnitId] = useState('');
  const [barcode, setBarcode] = useState('');

  // Service fields
  const [chargeUnit, setChargeUnit] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [typicalFrequency, setTypicalFrequency] = useState('');
  const [requiresScheduling, setRequiresScheduling] = useState(false);
  const [linkedActivity, setLinkedActivity] = useState('');

  // Compositions
  const [compositions, setCompositions] = useState<CompositionRow[]>([]);
  const [activeIngredientDropdown, setActiveIngredientDropdown] = useState<number | null>(null);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [ingredientModalIndex, setIngredientModalIndex] = useState<number | null>(null);

  // CA8: Defensivos
  const [toxicityClass, setToxicityClass] = useState('');
  const [mapaRegistration, setMapaRegistration] = useState('');
  const [environmentalClass, setEnvironmentalClass] = useState('');
  const [actionMode, setActionMode] = useState('');
  const [chemicalGroup, setChemicalGroup] = useState('');
  const [withdrawalPeriods, setWithdrawalPeriods] = useState<WithdrawalRow[]>([]);

  // CA9: Fertilizantes
  const [npkFormulation, setNpkFormulation] = useState('');
  const [nutrientForm, setNutrientForm] = useState('');
  const [solubility, setSolubility] = useState('');

  // CA11: Medicamentos
  const [therapeuticClass, setTherapeuticClass] = useState('');
  const [administrationRoute, setAdministrationRoute] = useState('');
  const [milkWithdrawalHours, setMilkWithdrawalHours] = useState('');
  const [slaughterWithdrawalDays, setSlaughterWithdrawalDays] = useState('');
  const [vetMapaRegistration, setVetMapaRegistration] = useState('');
  const [requiresPrescription, setRequiresPrescription] = useState(false);
  const [storageCondition, setStorageCondition] = useState('');

  // CA12: Sementes
  const [sieveSize, setSieveSize] = useState('');
  const [industrialTreatment, setIndustrialTreatment] = useState('');
  const [germinationPct, setGerminationPct] = useState('');
  const [purityPct, setPurityPct] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load measurement units for select
  const { units: measurementUnits } = useMeasurementUnits({ limit: 100 });

  // Load product classes for autocomplete
  const { productClasses, createProductClass } = useProductClasses();
  const filteredProductClasses = productClasses.filter(
    (pc) => !productClassSearch || pc.name.toLowerCase().includes(productClassSearch.toLowerCase()),
  );

  // Load manufacturers for autocomplete
  const { manufacturers, createManufacturer } = useManufacturers();

  // Load active ingredients for composition autocomplete
  const { ingredients: activeIngredients, createIngredient } = useActiveIngredients();
  const filteredManufacturers = manufacturers.filter(
    (m) => !manufacturerName || m.name.toLowerCase().includes(manufacturerName.toLowerCase()),
  );

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setNature(product.nature as 'PRODUCT' | 'SERVICE');
        setName(product.name);
        setType(product.type);
        setStatus(product.status);
        setNotes(product.notes ?? '');
        setProductClassId(product.productClassId ?? '');
        setProductClassSearch(product.productClassName ?? '');
        setShowProductClassDropdown(false);
        setIsCreatingClass(false);
        setCommercialName(product.commercialName ?? '');
        setManufacturerName(product.manufacturer?.name ?? '');
        setManufacturerCnpj(product.manufacturer?.cnpj ?? '');
        setShowManufacturerDropdown(false);
        setIsCreatingManufacturer(false);
        setMeasurementUnitId(product.measurementUnitId ?? '');
        setBarcode(product.barcode ?? '');
        setChargeUnit(product.chargeUnit ?? '');
        setUnitCost(product.unitCost != null ? String(product.unitCost) : '');
        setTypicalFrequency(product.typicalFrequency ?? '');
        setRequiresScheduling(product.requiresScheduling);
        setLinkedActivity(product.linkedActivity ?? '');
        setCompositions(
          (product.compositions ?? []).map((c) => ({
            activeIngredient: c.activeIngredient,
            concentration: c.concentration ?? '',
            function: c.function ?? '',
          })),
        );
        setToxicityClass(product.toxicityClass ?? '');
        setMapaRegistration(product.mapaRegistration ?? '');
        setEnvironmentalClass(product.environmentalClass ?? '');
        setActionMode(product.actionMode ?? '');
        setChemicalGroup(product.chemicalGroup ?? '');
        setWithdrawalPeriods(
          (product.withdrawalPeriods ?? []).map((w) => ({
            crop: w.crop,
            days: String(w.days),
          })),
        );
        setNpkFormulation(product.npkFormulation ?? '');
        setNutrientForm(product.nutrientForm ?? '');
        setSolubility(product.solubility ?? '');
        setTherapeuticClass(product.therapeuticClass ?? '');
        setAdministrationRoute(product.administrationRoute ?? '');
        setMilkWithdrawalHours(
          product.milkWithdrawalHours != null ? String(product.milkWithdrawalHours) : '',
        );
        setSlaughterWithdrawalDays(
          product.slaughterWithdrawalDays != null ? String(product.slaughterWithdrawalDays) : '',
        );
        setVetMapaRegistration(product.vetMapaRegistration ?? '');
        setRequiresPrescription(product.requiresPrescription);
        setStorageCondition(product.storageCondition ?? '');
        setSieveSize(product.sieveSize ?? '');
        setIndustrialTreatment(product.industrialTreatment ?? '');
        setGerminationPct(product.germinationPct != null ? String(product.germinationPct) : '');
        setPurityPct(product.purityPct != null ? String(product.purityPct) : '');
      } else {
        setNature(defaultNature);
        setName('');
        setType('');
        setStatus('ACTIVE');
        setNotes('');
        setProductClassId('');
        setProductClassSearch('');
        setShowProductClassDropdown(false);
        setIsCreatingClass(false);
        setCommercialName(initialName ?? '');
        setManufacturerName('');
        setManufacturerCnpj('');
        setShowManufacturerDropdown(false);
        setIsCreatingManufacturer(false);
        setMeasurementUnitId('');
        setBarcode('');
        setChargeUnit('');
        setUnitCost('');
        setTypicalFrequency('');
        setRequiresScheduling(false);
        setLinkedActivity('');
        setCompositions([]);
        setToxicityClass('');
        setMapaRegistration('');
        setEnvironmentalClass('');
        setActionMode('');
        setChemicalGroup('');
        setWithdrawalPeriods([]);
        setNpkFormulation('');
        setNutrientForm('');
        setSolubility('');
        setTherapeuticClass('');
        setAdministrationRoute('');
        setMilkWithdrawalHours('');
        setSlaughterWithdrawalDays('');
        setVetMapaRegistration('');
        setRequiresPrescription(false);
        setStorageCondition('');
        setSieveSize('');
        setIndustrialTreatment('');
        setGerminationPct('');
        setPurityPct('');
      }
      setSubmitError(null);
    }
  }, [isOpen, product, defaultNature]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const canSubmit = productClassId && type && !isSubmitting;

  const buildPayload = () => {
    // name é derivado da classe do produto (campo obrigatório no DB)
    const derivedName = commercialName.trim() || productClassSearch.trim();
    const payload: Record<string, unknown> = {
      nature,
      name: derivedName,
      type,
      status,
      notes: notes.trim() || null,
    };

    payload.productClassId = productClassId || null;

    if (nature === 'PRODUCT') {
      payload.commercialName = commercialName.trim() || null;
      payload.manufacturerName = manufacturerName.trim() || null;
      payload.manufacturerCnpj = manufacturerCnpj || null;
      payload.measurementUnitId = measurementUnitId || null;
      payload.barcode = barcode.trim() || null;

      if (compositions.length > 0) {
        payload.compositions = compositions
          .filter((c) => c.activeIngredient.trim())
          .map((c) => ({
            activeIngredient: c.activeIngredient.trim(),
            concentration: c.concentration.trim() || null,
            function: c.function.trim() || null,
          }));
      } else {
        payload.compositions = [];
      }

      // CA8: Defensivos
      if (isDefensivo(type)) {
        payload.toxicityClass = toxicityClass || null;
        payload.mapaRegistration = mapaRegistration.trim() || null;
        payload.environmentalClass = environmentalClass || null;
        payload.actionMode = actionMode.trim() || null;
        payload.chemicalGroup = chemicalGroup.trim() || null;
        if (withdrawalPeriods.length > 0) {
          payload.withdrawalPeriods = withdrawalPeriods
            .filter((w) => w.crop.trim() && w.days)
            .map((w) => ({ crop: w.crop.trim(), days: Number(w.days) }));
        }
      }

      // CA9: Fertilizantes
      if (isFertilizante(type)) {
        payload.npkFormulation = npkFormulation.trim() || null;
        payload.nutrientForm = nutrientForm || null;
        payload.solubility = solubility || null;
      }

      // CA11: Medicamentos veterinários
      if (isMedicamentoVet(type)) {
        payload.therapeuticClass = therapeuticClass || null;
        payload.administrationRoute = administrationRoute || null;
        payload.milkWithdrawalHours = milkWithdrawalHours ? Number(milkWithdrawalHours) : null;
        payload.slaughterWithdrawalDays = slaughterWithdrawalDays
          ? Number(slaughterWithdrawalDays)
          : null;
        payload.vetMapaRegistration = vetMapaRegistration.trim() || null;
        payload.requiresPrescription = requiresPrescription;
        payload.storageCondition = storageCondition || null;
      }

      // CA12: Sementes
      if (isSemente(type)) {
        payload.sieveSize = sieveSize.trim() || null;
        payload.industrialTreatment = industrialTreatment.trim() || null;
        payload.germinationPct = germinationPct ? Number(germinationPct) : null;
        payload.purityPct = purityPct ? Number(purityPct) : null;
      }
    } else {
      // Service
      payload.chargeUnit = chargeUnit || null;
      payload.unitCost = unitCost ? Number(unitCost) : null;
      payload.typicalFrequency = typicalFrequency || null;
      payload.requiresScheduling = requiresScheduling;
      payload.linkedActivity = linkedActivity.trim() || null;
    }

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildPayload();
      if (isEditing) {
        await api.put(`/org/products/${product.id}`, payload);
        onSuccess();
      } else {
        const result = await api.post<{ id: string; name: string }>('/org/products', payload);
        onSuccess({ id: result.id, name: result.name });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Composition handlers ──────────────────────────────────────────

  const addComposition = () => {
    setCompositions([...compositions, { activeIngredient: '', concentration: '', function: '' }]);
  };

  const updateComposition = (index: number, field: keyof CompositionRow, value: string) => {
    setCompositions(compositions.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const removeComposition = (index: number) => {
    setCompositions(compositions.filter((_, i) => i !== index));
  };

  // ─── Withdrawal handlers ──────────────────────────────────────────

  const addWithdrawal = () => {
    setWithdrawalPeriods([...withdrawalPeriods, { crop: '', days: '' }]);
  };

  const updateWithdrawal = (index: number, field: keyof WithdrawalRow, value: string) => {
    setWithdrawalPeriods(
      withdrawalPeriods.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
    );
  };

  const removeWithdrawal = (index: number) => {
    setWithdrawalPeriods(withdrawalPeriods.filter((_, i) => i !== index));
  };

  const typeOptions = nature === 'PRODUCT' ? PRODUCT_TYPES : SERVICE_TYPES;
  const modalTitle = isEditing
    ? `Editar ${nature === 'PRODUCT' ? 'produto' : 'serviço'}`
    : `Novo ${nature === 'PRODUCT' ? 'produto' : 'serviço'}`;

  return (
    <div className="product-modal__overlay" onClick={onClose}>
      <div
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="product-modal__header">
          <h2>{modalTitle}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="product-modal__body">
            {submitError && (
              <div className="product-modal__error" role="alert">
                {submitError}
              </div>
            )}

            {/* ─── Dados Básicos ──────────────────────────────── */}
            <div className="product-modal__section">
              <div className="product-modal__field">
                <label htmlFor="prod-commercial">Nome Comercial</label>
                <input
                  id="prod-commercial"
                  type="text"
                  value={commercialName}
                  onChange={(e) => setCommercialName(e.target.value)}
                  placeholder="Nome comercial do produto"
                />
              </div>

              <div className={isEditing ? 'product-modal__row' : ''}>
                <div className="product-modal__field">
                  <label htmlFor="prod-nature">
                    Natureza <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="prod-nature"
                    value={nature}
                    onChange={(e) => {
                      setNature(e.target.value as 'PRODUCT' | 'SERVICE');
                      setType('');
                    }}
                    aria-required="true"
                  >
                    <option value="PRODUCT">Produto / Insumo</option>
                    <option value="SERVICE">Serviço</option>
                  </select>
                </div>

                {isEditing && (
                  <div className="product-modal__toggle-field">
                    <span className="product-modal__toggle-label">Ativo</span>
                    <label className="product-modal__toggle" htmlFor="prod-status">
                      <input
                        type="checkbox"
                        id="prod-status"
                        checked={status === 'ACTIVE'}
                        onChange={(e) => setStatus(e.target.checked ? 'ACTIVE' : 'INACTIVE')}
                      />
                      <span className="product-modal__toggle-track" aria-hidden="true" />
                      <span className="product-modal__toggle-thumb" aria-hidden="true" />
                    </label>
                  </div>
                )}
              </div>

              <div className="product-modal__row">
                <div className="product-modal__field">
                  <label htmlFor="prod-type">
                    Tipo <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="prod-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    aria-required="true"
                  >
                    <option value="">Selecione...</option>
                    {typeOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="product-modal__field product-modal__autocomplete">
                  <label htmlFor="prod-class">
                    Classe do Produto <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="prod-class"
                    type="text"
                    value={productClassSearch}
                    onChange={(e) => {
                      setProductClassSearch(e.target.value);
                      setShowProductClassDropdown(true);
                      if (!e.target.value.trim()) {
                        setProductClassId('');
                      }
                    }}
                    onFocus={() => setShowProductClassDropdown(true)}
                    onBlur={() => {
                      // Delay to allow click on dropdown items
                      setTimeout(() => setShowProductClassDropdown(false), 200);
                    }}
                    placeholder="Ex: Antibiótico Mastite"
                    autoComplete="off"
                    aria-required="true"
                  />
                  {showProductClassDropdown &&
                    (filteredProductClasses.length > 0 || productClassSearch.trim()) && (
                      <ul className="product-modal__dropdown" role="listbox">
                        {filteredProductClasses.map((pc) => (
                          <li
                            key={pc.id}
                            role="option"
                            aria-selected={pc.id === productClassId}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setProductClassId(pc.id);
                              setProductClassSearch(pc.name);
                              setShowProductClassDropdown(false);
                            }}
                          >
                            {pc.name}
                          </li>
                        ))}
                        {filteredProductClasses.length === 0 &&
                          productClassSearch.trim() &&
                          !isCreatingClass && (
                            <li
                              className="product-modal__dropdown-create"
                              role="option"
                              aria-selected={false}
                              onMouseDown={async (e) => {
                                e.preventDefault();
                                setIsCreatingClass(true);
                                try {
                                  const created = await createProductClass(
                                    productClassSearch.trim(),
                                  );
                                  setProductClassId(created.id);
                                  setProductClassSearch(created.name);
                                  setShowProductClassDropdown(false);
                                } catch {
                                  // Keep dropdown open on error
                                } finally {
                                  setIsCreatingClass(false);
                                }
                              }}
                            >
                              <Plus size={14} aria-hidden="true" /> Criar &quot;
                              {productClassSearch.trim()}&quot;
                            </li>
                          )}
                        {isCreatingClass && (
                          <li className="product-modal__dropdown-loading">Criando...</li>
                        )}
                      </ul>
                    )}
                </div>
              </div>
            </div>

            {/* ─── Campos de Produto ─────────────────────────── */}
            {nature === 'PRODUCT' && (
              <div className="product-modal__section">
                <h3 className="product-modal__section-title">
                  <Package size={16} aria-hidden="true" />
                  Dados do Produto
                </h3>

                <div className="product-modal__field product-modal__autocomplete">
                  <label htmlFor="prod-manufacturer">Fabricante</label>
                  <input
                    id="prod-manufacturer"
                    type="text"
                    value={manufacturerName}
                    onChange={(e) => {
                      setManufacturerName(e.target.value);
                      setShowManufacturerDropdown(true);
                    }}
                    onFocus={() => setShowManufacturerDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowManufacturerDropdown(false), 200);
                    }}
                    placeholder="Nome do fabricante"
                    autoComplete="off"
                  />
                  {showManufacturerDropdown &&
                    (filteredManufacturers.length > 0 || manufacturerName.trim()) && (
                      <ul className="product-modal__dropdown" role="listbox">
                        {filteredManufacturers.map((m) => (
                          <li
                            key={m.id}
                            role="option"
                            aria-selected={m.name === manufacturerName}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setManufacturerName(m.name);
                              setManufacturerCnpj(m.cnpj ?? '');
                              setShowManufacturerDropdown(false);
                            }}
                          >
                            {m.name}
                            {m.cnpj && (
                              <span className="product-modal__dropdown-hint">{m.cnpj}</span>
                            )}
                          </li>
                        ))}
                        {filteredManufacturers.length === 0 &&
                          manufacturerName.trim() &&
                          !isCreatingManufacturer && (
                            <li
                              className="product-modal__dropdown-create"
                              role="option"
                              aria-selected={false}
                              onMouseDown={async (e) => {
                                e.preventDefault();
                                setIsCreatingManufacturer(true);
                                try {
                                  const created = await createManufacturer(manufacturerName.trim());
                                  setManufacturerName(created.name);
                                  setManufacturerCnpj(created.cnpj ?? '');
                                  setShowManufacturerDropdown(false);
                                } catch {
                                  // Keep dropdown open on error
                                } finally {
                                  setIsCreatingManufacturer(false);
                                }
                              }}
                            >
                              <Plus size={14} aria-hidden="true" /> Criar &quot;
                              {manufacturerName.trim()}&quot;
                            </li>
                          )}
                        {isCreatingManufacturer && (
                          <li className="product-modal__dropdown-loading">Criando...</li>
                        )}
                      </ul>
                    )}
                </div>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-unit">Unidade de Medida</label>
                    <select
                      id="prod-unit"
                      value={measurementUnitId}
                      onChange={(e) => setMeasurementUnitId(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {measurementUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.abbreviation})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-barcode">Código de Barras</label>
                    <input
                      id="prod-barcode"
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── Campos de Serviço ─────────────────────────── */}
            {nature === 'SERVICE' && (
              <div className="product-modal__section">
                <h3 className="product-modal__section-title">
                  <Wrench size={16} aria-hidden="true" />
                  Dados do Serviço
                </h3>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-charge-unit">Unidade de Cobrança</label>
                    <select
                      id="prod-charge-unit"
                      value={chargeUnit}
                      onChange={(e) => setChargeUnit(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {CHARGE_UNITS.map((cu) => (
                        <option key={cu.value} value={cu.value}>
                          {cu.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-unit-cost">Custo Unitário (R$)</label>
                    <input
                      id="prod-unit-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                    />
                  </div>
                </div>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-frequency">Frequência Típica</label>
                    <select
                      id="prod-frequency"
                      value={typicalFrequency}
                      onChange={(e) => setTypicalFrequency(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-linked-activity">Atividade Vinculada</label>
                    <input
                      id="prod-linked-activity"
                      type="text"
                      value={linkedActivity}
                      onChange={(e) => setLinkedActivity(e.target.value)}
                      placeholder="Ex: Manejo sanitário"
                    />
                  </div>
                </div>

                <div className="product-modal__checkbox">
                  <input
                    id="prod-scheduling"
                    type="checkbox"
                    checked={requiresScheduling}
                    onChange={(e) => setRequiresScheduling(e.target.checked)}
                  />
                  <label htmlFor="prod-scheduling">Requer agendamento</label>
                </div>
              </div>
            )}

            {/* ─── Composição (CA7) ─────────────────────────── */}
            {nature === 'PRODUCT' && (
              <div className="product-modal__section">
                <h3 className="product-modal__section-title">
                  <Beaker size={16} aria-hidden="true" />
                  Composição
                </h3>
                <div className="product-modal__comp-list">
                  {compositions.map((comp, i) => {
                    const searchTerm = comp.activeIngredient.toLowerCase();
                    const isSelected = activeIngredients.some(
                      (ing) => ing.name === comp.activeIngredient,
                    );
                    const filteredIngredients = activeIngredients.filter(
                      (ing) => !searchTerm || ing.name.toLowerCase().includes(searchTerm),
                    );
                    const hasExactMatch = activeIngredients.some(
                      (ing) => ing.name.toLowerCase() === searchTerm,
                    );
                    return (
                      <div key={i} className="product-modal__comp-item">
                        <div className="product-modal__field product-modal__autocomplete">
                          <label htmlFor={`comp-ingredient-${i}`}>Princípio Ativo</label>
                          <input
                            id={`comp-ingredient-${i}`}
                            type="text"
                            value={comp.activeIngredient}
                            onChange={(e) => {
                              updateComposition(i, 'activeIngredient', e.target.value);
                              setActiveIngredientDropdown(i);
                            }}
                            onFocus={() => setActiveIngredientDropdown(i)}
                            onBlur={() => {
                              setTimeout(() => {
                                setActiveIngredientDropdown(null);
                                if (!isSelected && comp.activeIngredient.trim()) {
                                  updateComposition(i, 'activeIngredient', '');
                                }
                              }, 200);
                            }}
                            placeholder="Buscar princípio ativo..."
                            autoComplete="off"
                            className={isSelected ? 'product-modal__input--selected' : ''}
                          />
                          {activeIngredientDropdown === i && (
                            <ul className="product-modal__dropdown" role="listbox">
                              {filteredIngredients.slice(0, 10).map((ing) => (
                                <li
                                  key={ing.id}
                                  role="option"
                                  aria-selected={ing.name === comp.activeIngredient}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    updateComposition(i, 'activeIngredient', ing.name);
                                    setActiveIngredientDropdown(null);
                                  }}
                                >
                                  {ing.name}
                                </li>
                              ))}
                              {comp.activeIngredient.trim() && !hasExactMatch && (
                                <li
                                  className="product-modal__dropdown-create"
                                  role="option"
                                  aria-selected={false}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setIngredientModalIndex(i);
                                    setShowIngredientModal(true);
                                    setActiveIngredientDropdown(null);
                                  }}
                                >
                                  <Plus size={14} aria-hidden="true" /> Cadastrar &quot;
                                  {comp.activeIngredient.trim()}&quot;
                                </li>
                              )}
                              {filteredIngredients.length === 0 &&
                                !comp.activeIngredient.trim() && (
                                  <li className="product-modal__dropdown-loading">
                                    Nenhum ingrediente cadastrado
                                  </li>
                                )}
                            </ul>
                          )}
                        </div>
                        <div className="product-modal__field">
                          <label htmlFor={`comp-conc-${i}`}>Concentração</label>
                          <input
                            id={`comp-conc-${i}`}
                            type="text"
                            value={comp.concentration}
                            onChange={(e) => updateComposition(i, 'concentration', e.target.value)}
                            placeholder="Ex: 480 g/L"
                          />
                        </div>
                        <button
                          type="button"
                          className="product-modal__comp-remove"
                          onClick={() => removeComposition(i)}
                          aria-label={`Remover composição ${i + 1}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button type="button" className="product-modal__btn-add" onClick={addComposition}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar princípio ativo
                </button>
              </div>
            )}

            {/* ─── CA8: Defensivos ───────────────────────────── */}
            {nature === 'PRODUCT' && isDefensivo(type) && (
              <div className="product-modal__section">
                <h3 className="product-modal__section-title">
                  <FlaskConical size={16} aria-hidden="true" />
                  Dados do Defensivo
                </h3>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-mapa">Registro MAPA</label>
                    <input
                      id="prod-mapa"
                      type="text"
                      value={mapaRegistration}
                      onChange={(e) => setMapaRegistration(e.target.value)}
                    />
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-chemical-group">Grupo Químico</label>
                    <input
                      id="prod-chemical-group"
                      type="text"
                      value={chemicalGroup}
                      onChange={(e) => setChemicalGroup(e.target.value)}
                    />
                  </div>
                </div>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-toxicity">Classe Toxicológica</label>
                    <select
                      id="prod-toxicity"
                      value={toxicityClass}
                      onChange={(e) => setToxicityClass(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {TOXICITY_CLASSES.map((tc) => (
                        <option key={tc.value} value={tc.value}>
                          {tc.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-env-class">Classe Ambiental</label>
                    <select
                      id="prod-env-class"
                      value={environmentalClass}
                      onChange={(e) => setEnvironmentalClass(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {ENVIRONMENTAL_CLASSES.map((ec) => (
                        <option key={ec.value} value={ec.value}>
                          {ec.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="product-modal__field">
                  <label htmlFor="prod-action-mode">Modo de Ação</label>
                  <input
                    id="prod-action-mode"
                    type="text"
                    value={actionMode}
                    onChange={(e) => setActionMode(e.target.value)}
                    placeholder="Ex: Sistêmico, Contato"
                  />
                </div>

                {/* Períodos de carência */}
                <h3 className="product-modal__section-title">Períodos de Carência</h3>
                <div className="product-modal__comp-list">
                  {withdrawalPeriods.map((wp, i) => (
                    <div key={i} className="product-modal__comp-item">
                      <div className="product-modal__field">
                        <label htmlFor={`wp-crop-${i}`}>Cultura</label>
                        <input
                          id={`wp-crop-${i}`}
                          type="text"
                          value={wp.crop}
                          onChange={(e) => updateWithdrawal(i, 'crop', e.target.value)}
                          placeholder="Ex: Soja"
                        />
                      </div>
                      <div className="product-modal__field">
                        <label htmlFor={`wp-days-${i}`}>Dias</label>
                        <input
                          id={`wp-days-${i}`}
                          type="number"
                          min="0"
                          value={wp.days}
                          onChange={(e) => updateWithdrawal(i, 'days', e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="product-modal__comp-remove"
                        onClick={() => removeWithdrawal(i)}
                        aria-label={`Remover carência ${i + 1}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="product-modal__btn-add" onClick={addWithdrawal}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar período de carência
                </button>
              </div>
            )}

            {/* ─── CA9: Fertilizantes ────────────────────────── */}
            {nature === 'PRODUCT' && isFertilizante(type) && (
              <div className="product-modal__section">
                <h3 className="product-modal__section-title">
                  <Sprout size={16} aria-hidden="true" />
                  Dados do Fertilizante
                </h3>

                <div className="product-modal__field">
                  <label htmlFor="prod-npk">Formulação NPK</label>
                  <input
                    id="prod-npk"
                    type="text"
                    value={npkFormulation}
                    onChange={(e) => setNpkFormulation(e.target.value)}
                    placeholder="Ex: 04-14-08"
                  />
                </div>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-nutrient-form">Forma</label>
                    <select
                      id="prod-nutrient-form"
                      value={nutrientForm}
                      onChange={(e) => setNutrientForm(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {NUTRIENT_FORMS.map((nf) => (
                        <option key={nf.value} value={nf.value}>
                          {nf.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-solubility">Solubilidade</label>
                    <select
                      id="prod-solubility"
                      value={solubility}
                      onChange={(e) => setSolubility(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {SOLUBILITY_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ─── CA11: Medicamentos Veterinários ───────────── */}
            {nature === 'PRODUCT' && isMedicamentoVet(type) && (
              <div className="product-modal__section">
                <h3 className="product-modal__section-title">
                  <Pill size={16} aria-hidden="true" />
                  Dados do Medicamento
                </h3>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-therapeutic">Classe Terapêutica</label>
                    <select
                      id="prod-therapeutic"
                      value={therapeuticClass}
                      onChange={(e) => setTherapeuticClass(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {THERAPEUTIC_CLASSES.map((tc) => (
                        <option key={tc.value} value={tc.value}>
                          {tc.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-admin-route">Via de Administração</label>
                    <select
                      id="prod-admin-route"
                      value={administrationRoute}
                      onChange={(e) => setAdministrationRoute(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {ADMIN_ROUTES.map((ar) => (
                        <option key={ar.value} value={ar.value}>
                          {ar.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-vet-mapa">Registro MAPA Vet.</label>
                    <input
                      id="prod-vet-mapa"
                      type="text"
                      value={vetMapaRegistration}
                      onChange={(e) => setVetMapaRegistration(e.target.value)}
                    />
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-storage">Armazenamento</label>
                    <select
                      id="prod-storage"
                      value={storageCondition}
                      onChange={(e) => setStorageCondition(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {STORAGE_CONDITIONS.map((sc) => (
                        <option key={sc.value} value={sc.value}>
                          {sc.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-milk-withdrawal">Carência Leite (horas)</label>
                    <input
                      id="prod-milk-withdrawal"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={milkWithdrawalHours}
                      onChange={(e) => setMilkWithdrawalHours(e.target.value)}
                    />
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-slaughter-withdrawal">Carência Abate (dias)</label>
                    <input
                      id="prod-slaughter-withdrawal"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={slaughterWithdrawalDays}
                      onChange={(e) => setSlaughterWithdrawalDays(e.target.value)}
                    />
                  </div>
                </div>

                <div className="product-modal__checkbox">
                  <input
                    id="prod-prescription"
                    type="checkbox"
                    checked={requiresPrescription}
                    onChange={(e) => setRequiresPrescription(e.target.checked)}
                  />
                  <label htmlFor="prod-prescription">Requer receituário</label>
                </div>
              </div>
            )}

            {/* ─── CA12: Sementes ────────────────────────────── */}
            {nature === 'PRODUCT' && isSemente(type) && (
              <div className="product-modal__section">
                <h3 className="product-modal__section-title">
                  <Sprout size={16} aria-hidden="true" />
                  Dados da Semente
                </h3>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-sieve">Peneira</label>
                    <input
                      id="prod-sieve"
                      type="text"
                      value={sieveSize}
                      onChange={(e) => setSieveSize(e.target.value)}
                      placeholder="Ex: 6.5mm"
                    />
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-treatment">Tratamento Industrial</label>
                    <input
                      id="prod-treatment"
                      type="text"
                      value={industrialTreatment}
                      onChange={(e) => setIndustrialTreatment(e.target.value)}
                    />
                  </div>
                </div>

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-germination">Germinação (%)</label>
                    <input
                      id="prod-germination"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      inputMode="decimal"
                      value={germinationPct}
                      onChange={(e) => setGerminationPct(e.target.value)}
                    />
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-purity">Pureza (%)</label>
                    <input
                      id="prod-purity"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      inputMode="decimal"
                      value={purityPct}
                      onChange={(e) => setPurityPct(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── Observações ───────────────────────────────── */}
            <div className="product-modal__section">
              <div className="product-modal__field">
                <label htmlFor="prod-notes">Observações</label>
                <textarea
                  id="prod-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais..."
                />
              </div>
            </div>
          </div>

          <footer className="product-modal__footer">
            <button
              type="button"
              className="product-modal__btn--ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button type="submit" className="product-modal__btn--primary" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="product-modal__spinner" aria-hidden="true" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar'
              ) : (
                'Criar'
              )}
            </button>
          </footer>
        </form>
      </div>

      <ActiveIngredientModal
        isOpen={showIngredientModal}
        initialName={
          ingredientModalIndex !== null ? compositions[ingredientModalIndex]?.activeIngredient : ''
        }
        onClose={() => {
          setShowIngredientModal(false);
          setIngredientModalIndex(null);
        }}
        onSave={async (ingredientName, ingredientType) => {
          const created = await createIngredient(ingredientName, ingredientType);
          if (ingredientModalIndex !== null) {
            updateComposition(ingredientModalIndex, 'activeIngredient', created.name);
          }
        }}
      />
    </div>
  );
}
