import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useMeasurementUnits } from '@/hooks/useMeasurementUnits';
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
  onSuccess: () => void;
}

// ─── Component ──────────────────────────────────────────────────────

export default function ProductModal({
  isOpen,
  product,
  defaultNature,
  onClose,
  onSuccess,
}: Props) {
  const isEditing = !!product;

  // Basic fields
  const [nature, setNature] = useState<'PRODUCT' | 'SERVICE'>(defaultNature);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [notes, setNotes] = useState('');

  // Product fields
  const [commercialName, setCommercialName] = useState('');
  const [manufacturerName, setManufacturerName] = useState('');
  const [manufacturerCnpj, setManufacturerCnpj] = useState('');
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

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setNature(product.nature as 'PRODUCT' | 'SERVICE');
        setName(product.name);
        setType(product.type);
        setCategory(product.category ?? '');
        setStatus(product.status);
        setNotes(product.notes ?? '');
        setCommercialName(product.commercialName ?? '');
        setManufacturerName(product.manufacturer?.name ?? '');
        setManufacturerCnpj(product.manufacturer?.cnpj ?? '');
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
        setCategory('');
        setStatus('ACTIVE');
        setNotes('');
        setCommercialName('');
        setManufacturerName('');
        setManufacturerCnpj('');
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

  const canSubmit = name.trim() && type && !isSubmitting;

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      nature,
      name: name.trim(),
      type,
      category: category.trim() || null,
      status,
      notes: notes.trim() || null,
    };

    if (nature === 'PRODUCT') {
      payload.commercialName = commercialName.trim() || null;
      payload.manufacturerName = manufacturerName.trim() || null;
      payload.manufacturerCnpj = manufacturerCnpj.trim() || null;
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
      } else {
        await api.post('/org/products', payload);
      }
      onSuccess();
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
              <div className="product-modal__row">
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

                <div className="product-modal__field">
                  <label htmlFor="prod-status">Status</label>
                  <select
                    id="prod-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="product-modal__field">
                <label htmlFor="prod-name">
                  Nome <span aria-hidden="true">*</span>
                </label>
                <input
                  id="prod-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    nature === 'PRODUCT' ? 'Ex: Glifosato 480 SL' : 'Ex: Consultoria Agronômica'
                  }
                  aria-required="true"
                />
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

                <div className="product-modal__field">
                  <label htmlFor="prod-category">Categoria</label>
                  <input
                    id="prod-category"
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Categoria livre"
                  />
                </div>
              </div>
            </div>

            {/* ─── Campos de Produto ─────────────────────────── */}
            {nature === 'PRODUCT' && (
              <div className="product-modal__section">
                <h3 className="product-modal__section-title">Dados do Produto</h3>

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

                <div className="product-modal__row">
                  <div className="product-modal__field">
                    <label htmlFor="prod-manufacturer">Fabricante</label>
                    <input
                      id="prod-manufacturer"
                      type="text"
                      value={manufacturerName}
                      onChange={(e) => setManufacturerName(e.target.value)}
                      placeholder="Nome do fabricante"
                    />
                  </div>
                  <div className="product-modal__field">
                    <label htmlFor="prod-cnpj">CNPJ do Fabricante</label>
                    <input
                      id="prod-cnpj"
                      type="text"
                      value={manufacturerCnpj}
                      onChange={(e) => setManufacturerCnpj(e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
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
                <h3 className="product-modal__section-title">Dados do Serviço</h3>

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
                <h3 className="product-modal__section-title">Composição</h3>
                <div className="product-modal__comp-list">
                  {compositions.map((comp, i) => (
                    <div key={i} className="product-modal__comp-item">
                      <div className="product-modal__field">
                        <label htmlFor={`comp-ingredient-${i}`}>Ingrediente Ativo</label>
                        <input
                          id={`comp-ingredient-${i}`}
                          type="text"
                          value={comp.activeIngredient}
                          onChange={(e) => updateComposition(i, 'activeIngredient', e.target.value)}
                        />
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
                  ))}
                </div>
                <button type="button" className="product-modal__btn-add" onClick={addComposition}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar ingrediente
                </button>
              </div>
            )}

            {/* ─── CA8: Defensivos ───────────────────────────── */}
            {nature === 'PRODUCT' && isDefensivo(type) && (
              <div className="product-modal__section">
                <h3 className="product-modal__section-title">Dados do Defensivo</h3>

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
                <h3 className="product-modal__section-title">Dados do Fertilizante</h3>

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
                <h3 className="product-modal__section-title">Dados do Medicamento</h3>

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
                <h3 className="product-modal__section-title">Dados da Semente</h3>

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
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
