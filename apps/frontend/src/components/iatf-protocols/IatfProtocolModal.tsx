import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import type {
  IatfProtocolDetail,
  CreateIatfProtocolInput,
  StepInput,
  StepProductInput,
} from '@/types/iatf-protocol';
import { TARGET_CATEGORIES, DOSE_UNITS, ADMINISTRATION_ROUTES_IATF } from '@/types/iatf-protocol';
import { useProducts, type ProductItem } from '@/hooks/useProducts';
import { useActiveIngredients } from '@/hooks/useActiveIngredients';
import ProductModal from '@/components/products/ProductModal';
import './IatfProtocolModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  protocol?: IatfProtocolDetail | null;
  onSuccess: () => void;
}

const EMPTY_PRODUCT: StepProductInput = {
  productId: null,
  productName: '',
  dose: 0,
  doseUnit: 'mL',
  administrationRoute: null,
  notes: null,
};

const EMPTY_STEP: StepInput = {
  dayNumber: 0,
  description: '',
  isAiDay: false,
  sortOrder: 1,
  products: [{ ...EMPTY_PRODUCT }],
};

interface FormData {
  name: string;
  description: string;
  targetCategory: string;
  veterinaryAuthor: string;
  status: string;
  notes: string;
  steps: StepInput[];
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  targetCategory: 'COWS',
  veterinaryAuthor: '',
  status: 'ACTIVE',
  notes: '',
  steps: [{ ...EMPTY_STEP, products: [{ ...EMPTY_PRODUCT }] }],
};

// ─── Ingredient Combobox ────────────────────────────────────────────

interface IngredientComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  ingredients: { id: string; name: string }[];
  onAdd: (name: string) => void;
  adding: boolean;
}

function IngredientCombobox({
  id,
  value,
  onChange,
  ingredients,
  onAdd,
  adding,
}: IngredientComboboxProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return ingredients;
    const lower = value.toLowerCase();
    return ingredients.filter((ai) => ai.name.toLowerCase().includes(lower));
  }, [ingredients, value]);

  const exactMatch =
    value.trim().length > 0 &&
    ingredients.some((ai) => ai.name.toLowerCase() === value.trim().toLowerCase());

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="iatf-protocol-modal__field" ref={ref}>
      <label htmlFor={id}>Princípio ativo</label>
      <div className="iatf-protocol-modal__combobox">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Digite para buscar..."
          autoComplete="off"
        />
        {open && (filtered.length > 0 || (value.trim() && !exactMatch)) && (
          <ul className="iatf-protocol-modal__combobox-list" role="listbox">
            {value.trim() && (
              <li
                className="iatf-protocol-modal__combobox-item iatf-protocol-modal__combobox-item--all"
                role="option"
                aria-selected={!value.trim()}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Mostrar todos os produtos
              </li>
            )}
            {filtered.map((ai) => (
              <li
                key={ai.id}
                className={`iatf-protocol-modal__combobox-item ${
                  ai.name.toLowerCase() === value.toLowerCase()
                    ? 'iatf-protocol-modal__combobox-item--active'
                    : ''
                }`}
                role="option"
                aria-selected={ai.name.toLowerCase() === value.toLowerCase()}
                onClick={() => {
                  onChange(ai.name);
                  setOpen(false);
                }}
              >
                {ai.name}
              </li>
            ))}
            {value.trim() && !exactMatch && (
              <li
                className="iatf-protocol-modal__combobox-item iatf-protocol-modal__combobox-item--add"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onAdd(value.trim());
                  setOpen(false);
                }}
              >
                <Plus size={14} aria-hidden="true" />
                {adding ? 'Salvando...' : `Incluir "${value.trim()}"`}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Product Combobox ───────────────────────────────────────────────

interface ProductComboboxProps {
  id: string;
  value: string; // productId
  displayValue: string; // product name for display
  products: ProductItem[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (productId: string, productName: string) => void;
  onCreateRequest: (name: string) => void;
}

function ProductCombobox({
  id,
  value,
  displayValue,
  products,
  disabled,
  placeholder,
  onChange,
  onCreateRequest,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Sync display when value changes externally
  useEffect(() => {
    setSearch(displayValue);
  }, [displayValue]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const lower = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(lower));
  }, [products, search]);

  const exactMatch =
    search.trim().length > 0 &&
    products.some((p) => p.name.toLowerCase() === search.trim().toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        // Restore display value if user didn't select
        if (!value) setSearch('');
        else setSearch(displayValue);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value, displayValue]);

  return (
    <div className="iatf-protocol-modal__combobox" ref={ref}>
      <input
        id={id}
        type="text"
        value={search}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) {
            onChange('', '');
          }
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && !disabled && (filtered.length > 0 || (search.trim() && !exactMatch)) && (
        <ul className="iatf-protocol-modal__combobox-list" role="listbox">
          {filtered.map((p) => (
            <li
              key={p.id}
              className={`iatf-protocol-modal__combobox-item ${
                p.id === value ? 'iatf-protocol-modal__combobox-item--active' : ''
              }`}
              role="option"
              aria-selected={p.id === value}
              onClick={() => {
                onChange(p.id, p.name);
                setSearch(p.name);
                setOpen(false);
              }}
            >
              {p.name}
            </li>
          ))}
          {search.trim() && !exactMatch && (
            <li
              className="iatf-protocol-modal__combobox-item iatf-protocol-modal__combobox-item--add"
              role="option"
              aria-selected={false}
              onClick={() => {
                onCreateRequest(search.trim());
                setOpen(false);
              }}
            >
              <Plus size={14} aria-hidden="true" />
              Cadastrar &quot;{search.trim()}&quot;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function IatfProtocolModal({ isOpen, onClose, protocol, onSuccess }: Props) {
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveMode, setSaveMode] = useState<'correction' | 'new-version'>('correction');
  // Map: "stepIdx-prodIdx" → selected active ingredient
  const [activeIngredientMap, setActiveIngredientMap] = useState<Record<string, string>>({});
  const [newIngredientName, setNewIngredientName] = useState('');
  const [addingIngredient, setAddingIngredient] = useState(false);
  // Product creation modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [productInitialName, setProductInitialName] = useState('');
  // Track which step/product triggered the creation: "stepIdx-prodIdx"
  const [_productCreateTarget, setProductCreateTarget] = useState<string | null>(null);
  const { products, refetch: refetchProducts } = useProducts({ limit: 500 });
  const { ingredients: activeIngredients, refetch: refetchIngredients } = useActiveIngredients();

  // Filter products by selected active ingredient
  const getFilteredProducts = useCallback(
    (ingredientName: string | undefined) => {
      if (!ingredientName) return products;
      const lower = ingredientName.toLowerCase();
      return products.filter((p) =>
        (p.compositions ?? []).some((c) => c.activeIngredient?.toLowerCase() === lower),
      );
    },
    [products],
  );

  const handleActiveIngredientChange = useCallback(
    (stepIdx: number, prodIdx: number, value: string) => {
      const key = `${stepIdx}-${prodIdx}`;
      setActiveIngredientMap((prev) => ({ ...prev, [key]: value }));
      // Clear product selection when changing active ingredient
      setFormData((prev) => {
        const steps = [...prev.steps];
        const prods = [...steps[stepIdx].products];
        prods[prodIdx] = { ...prods[prodIdx], productId: null, productName: '' };
        steps[stepIdx] = { ...steps[stepIdx], products: prods };
        return { ...prev, steps };
      });
    },
    [],
  );

  const handleAddIngredient = useCallback(
    async (ingredientName?: string) => {
      const name = (ingredientName ?? newIngredientName).trim();
      if (!name) return;
      setAddingIngredient(true);
      try {
        await api.post('/org/active-ingredients', { name, type: 'VETERINARY' });
        setNewIngredientName('');
        void refetchIngredients();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao cadastrar princípio ativo.');
      } finally {
        setAddingIngredient(false);
      }
    },
    [newIngredientName, refetchIngredients],
  );

  const handleProductSelect = useCallback(
    (stepIndex: number, productIndex: number, productId: string, productName: string) => {
      setFormData((prev) => {
        const steps = [...prev.steps];
        const prods = [...steps[stepIndex].products];
        prods[productIndex] = {
          ...prods[productIndex],
          productId: productId || null,
          productName,
        };
        steps[stepIndex] = { ...steps[stepIndex], products: prods };
        return { ...prev, steps };
      });

      // Auto-fill active ingredient from product composition
      if (productId) {
        const selectedProduct = products.find((p) => p.id === productId);
        const firstComposition = selectedProduct?.compositions?.[0];
        if (firstComposition?.activeIngredient) {
          const key = `${stepIndex}-${productIndex}`;
          setActiveIngredientMap((prev) => ({
            ...prev,
            [key]: firstComposition.activeIngredient,
          }));
        }
      }
    },
    [products],
  );

  const handleProductCreateRequest = useCallback(
    (stepIdx: number, prodIdx: number, name: string) => {
      setProductInitialName(name);
      setProductCreateTarget(`${stepIdx}-${prodIdx}`);
      setShowProductModal(true);
    },
    [],
  );

  const handleProductCreated = useCallback(() => {
    setShowProductModal(false);
    void refetchProducts();
    // The user will need to select the product from the refreshed list
    setProductCreateTarget(null);
    setProductInitialName('');
  }, [refetchProducts]);

  useEffect(() => {
    if (!isOpen) return;
    if (protocol) {
      setFormData({
        name: protocol.name,
        description: protocol.description ?? '',
        targetCategory: protocol.targetCategory,
        veterinaryAuthor: protocol.veterinaryAuthor ?? '',
        status: protocol.status,
        notes: protocol.notes ?? '',
        steps: protocol.steps.map((s) => ({
          dayNumber: s.dayNumber,
          description: s.description,
          isAiDay: s.isAiDay,
          sortOrder: s.sortOrder,
          products: s.products.map((p) => ({
            productId: p.productId,
            productName: p.productName,
            dose: p.dose,
            doseUnit: p.doseUnit,
            administrationRoute: p.administrationRoute,
            notes: p.notes,
          })),
        })),
      });
    } else {
      setFormData({
        ...EMPTY_FORM,
        steps: [{ ...EMPTY_STEP, products: [{ ...EMPTY_PRODUCT }] }],
      });
    }
    setError(null);
    setFieldErrors({});
    setSaveMode('correction');
    setActiveIngredientMap({});
  }, [protocol, isOpen]);

  const updateStep = useCallback((index: number, field: string, value: unknown) => {
    setFormData((prev) => {
      const steps = [...prev.steps];
      const updated = { ...steps[index], [field]: value };
      steps[index] = updated;
      return { ...prev, steps };
    });
  }, []);

  const addStep = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          ...EMPTY_STEP,
          sortOrder: prev.steps.length + 1,
          products: [{ ...EMPTY_PRODUCT }],
        },
      ],
    }));
  }, []);

  const removeStep = useCallback((index: number) => {
    setFormData((prev) => {
      const steps = prev.steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, sortOrder: i + 1 }));
      return { ...prev, steps };
    });
  }, []);

  const updateProduct = useCallback(
    (stepIndex: number, productIndex: number, field: string, value: unknown) => {
      setFormData((prev) => {
        const steps = [...prev.steps];
        const products = [...steps[stepIndex].products];
        products[productIndex] = { ...products[productIndex], [field]: value };
        steps[stepIndex] = { ...steps[stepIndex], products };
        return { ...prev, steps };
      });
    },
    [],
  );

  const addProduct = useCallback((stepIndex: number) => {
    setFormData((prev) => {
      const steps = [...prev.steps];
      steps[stepIndex] = {
        ...steps[stepIndex],
        products: [...steps[stepIndex].products, { ...EMPTY_PRODUCT }],
      };
      return { ...prev, steps };
    });
  }, []);

  const removeProduct = useCallback((stepIndex: number, productIndex: number) => {
    setFormData((prev) => {
      const steps = [...prev.steps];
      const products = steps[stepIndex].products.filter((_, i) => i !== productIndex);
      steps[stepIndex] = { ...steps[stepIndex], products };
      return { ...prev, steps };
    });
  }, []);

  const validate = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors['name'] = 'Nome do protocolo é obrigatório';
    }

    if (!formData.targetCategory) {
      errors['targetCategory'] = 'Categoria alvo é obrigatória';
    }

    if (formData.steps.length === 0) {
      errors['steps'] = 'Adicione pelo menos uma etapa';
    }

    formData.steps.forEach((step, stepIdx) => {
      if (!step.description.trim()) {
        errors[`step-${stepIdx}-description`] = 'Descrição da etapa é obrigatória';
      }

      const realProducts = step.products.filter((p) => p.productName?.trim());
      realProducts.forEach((prod, prodIdx) => {
        if (!prod.productId) {
          errors[`step-${stepIdx}-prod-${prodIdx}-product`] =
            'Selecione o produto pelo princípio ativo';
        }
        if (!prod.dose || prod.dose <= 0) {
          errors[`step-${stepIdx}-prod-${prodIdx}-dose`] = 'Dose é obrigatória';
        }
      });
    });

    return errors;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Corrija os campos destacados antes de salvar.');
      return;
    }

    setIsLoading(true);

    const payload: CreateIatfProtocolInput = {
      name: formData.name,
      description: formData.description || null,
      targetCategory: formData.targetCategory,
      veterinaryAuthor: formData.veterinaryAuthor || null,
      status: formData.status,
      notes: formData.notes || null,
      steps: formData.steps.map((s) => ({
        dayNumber: s.dayNumber,
        description: s.description,
        isAiDay: s.isAiDay,
        sortOrder: s.sortOrder,
        products: s.products
          .filter((p) => p.productName?.trim())
          .map((p) => ({
            productId: p.productId || null,
            productName: p.productName,
            dose: p.dose,
            doseUnit: p.doseUnit,
            administrationRoute: p.administrationRoute || null,
            notes: p.notes || null,
          })),
      })),
    };

    try {
      if (protocol) {
        const updatePayload = {
          ...payload,
          createNewVersion: saveMode === 'new-version',
        };
        await api.patch(`/org/iatf-protocols/${protocol.id}`, updatePayload);
      } else {
        await api.post('/org/iatf-protocols', payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar protocolo IATF.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="iatf-protocol-modal__overlay" onClick={onClose}>
      <div
        className="iatf-protocol-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="iatf-modal-title"
      >
        <header className="iatf-protocol-modal__header">
          <h2 id="iatf-modal-title">
            {protocol ? 'Editar protocolo IATF' : 'Novo protocolo IATF'}
          </h2>
          <button
            type="button"
            className="iatf-protocol-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="iatf-protocol-modal__form">
          {error && (
            <div className="iatf-protocol-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="iatf-protocol-modal__row">
            <div
              className={`iatf-protocol-modal__field${fieldErrors['name'] ? ' iatf-protocol-modal__field--error' : ''}`}
            >
              <label htmlFor="iatf-name">Nome do protocolo *</label>
              <input
                id="iatf-name"
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (fieldErrors['name'])
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next['name'];
                      return next;
                    });
                }}
                aria-required="true"
                aria-invalid={!!fieldErrors['name']}
                placeholder="Ex: P36 — Novilhas"
              />
              {fieldErrors['name'] && (
                <span className="iatf-protocol-modal__field-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" /> {fieldErrors['name']}
                </span>
              )}
            </div>
            <div
              className={`iatf-protocol-modal__field${fieldErrors['targetCategory'] ? ' iatf-protocol-modal__field--error' : ''}`}
            >
              <label htmlFor="iatf-category">Categoria alvo *</label>
              <select
                id="iatf-category"
                value={formData.targetCategory}
                onChange={(e) => {
                  setFormData({ ...formData, targetCategory: e.target.value });
                  if (fieldErrors['targetCategory'])
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next['targetCategory'];
                      return next;
                    });
                }}
                aria-required="true"
                aria-invalid={!!fieldErrors['targetCategory']}
              >
                {TARGET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="iatf-protocol-modal__row">
            <div className="iatf-protocol-modal__field">
              <label htmlFor="iatf-vet">Veterinário autor</label>
              <input
                id="iatf-vet"
                type="text"
                value={formData.veterinaryAuthor}
                onChange={(e) => setFormData({ ...formData, veterinaryAuthor: e.target.value })}
                placeholder="Nome do veterinário responsável"
              />
            </div>
            <div className="iatf-protocol-modal__field">
              <label htmlFor="iatf-status">Status</label>
              <select
                id="iatf-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
          </div>

          <div className="iatf-protocol-modal__field">
            <label htmlFor="iatf-description">Descrição</label>
            <textarea
              id="iatf-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Descrição do protocolo..."
            />
          </div>

          {/* Steps */}
          <fieldset className="iatf-protocol-modal__fieldset">
            <legend>Etapas do protocolo *</legend>
            {formData.steps.map((step, stepIdx) => (
              <div key={stepIdx} className="iatf-protocol-modal__step">
                <div className="iatf-protocol-modal__step-header">
                  <div className="iatf-protocol-modal__step-title">
                    <span
                      className={`iatf-protocol-modal__day-badge${step.isAiDay ? ' iatf-protocol-modal__day-badge--ai' : ''}`}
                    >
                      D{step.dayNumber}
                    </span>
                    <span className="iatf-protocol-modal__step-number">Etapa {stepIdx + 1}</span>
                  </div>
                  {formData.steps.length > 1 && (
                    <button
                      type="button"
                      className="iatf-protocol-modal__step-remove"
                      onClick={() => removeStep(stepIdx)}
                      aria-label={`Remover etapa ${stepIdx + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="iatf-protocol-modal__row--three iatf-protocol-modal__row">
                  <div className="iatf-protocol-modal__field">
                    <label htmlFor={`step-day-${stepIdx}`}>Dia *</label>
                    <input
                      id={`step-day-${stepIdx}`}
                      type="number"
                      min="0"
                      value={step.dayNumber}
                      onChange={(e) =>
                        updateStep(stepIdx, 'dayNumber', Number(e.target.value) || 0)
                      }
                      required
                      aria-required="true"
                    />
                  </div>
                  <div
                    className={`iatf-protocol-modal__field${fieldErrors[`step-${stepIdx}-description`] ? ' iatf-protocol-modal__field--error' : ''}`}
                    style={{ gridColumn: 'span 2' }}
                  >
                    <label htmlFor={`step-desc-${stepIdx}`}>Descrição *</label>
                    <input
                      id={`step-desc-${stepIdx}`}
                      type="text"
                      value={step.description}
                      onChange={(e) => {
                        updateStep(stepIdx, 'description', e.target.value);
                        const key = `step-${stepIdx}-description`;
                        if (fieldErrors[key])
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          });
                      }}
                      aria-required="true"
                      aria-invalid={!!fieldErrors[`step-${stepIdx}-description`]}
                      placeholder="Ex: Inserção de dispositivo intravaginal + BE"
                    />
                    {fieldErrors[`step-${stepIdx}-description`] && (
                      <span className="iatf-protocol-modal__field-error" role="alert">
                        <AlertCircle size={14} aria-hidden="true" />{' '}
                        {fieldErrors[`step-${stepIdx}-description`]}
                      </span>
                    )}
                  </div>
                </div>

                <div className="iatf-protocol-modal__checkbox">
                  <input
                    type="checkbox"
                    id={`step-ai-${stepIdx}`}
                    checked={step.isAiDay}
                    onChange={(e) => updateStep(stepIdx, 'isAiDay', e.target.checked)}
                  />
                  <label htmlFor={`step-ai-${stepIdx}`}>Dia da IA (inseminação)</label>
                </div>

                {/* Products sub-list */}
                <div className="iatf-protocol-modal__products-header">
                  <span className="iatf-protocol-modal__products-label">
                    Produtos{step.isAiDay ? ' (opcional)' : ''}
                  </span>
                  <button
                    type="button"
                    className="iatf-protocol-modal__add-btn iatf-protocol-modal__add-btn--small"
                    onClick={() => addProduct(stepIdx)}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Produto
                  </button>
                </div>

                {step.products.map((product, prodIdx) => (
                  <div key={prodIdx} className="iatf-protocol-modal__product">
                    <div className="iatf-protocol-modal__product-header">
                      <span className="iatf-protocol-modal__product-number">
                        Produto {prodIdx + 1}
                      </span>
                      {step.products.length > 1 && (
                        <button
                          type="button"
                          className="iatf-protocol-modal__product-remove"
                          onClick={() => removeProduct(stepIdx, prodIdx)}
                          aria-label={`Remover produto ${prodIdx + 1} da etapa ${stepIdx + 1}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div className="iatf-protocol-modal__row">
                      <IngredientCombobox
                        id={`prod-ai-${stepIdx}-${prodIdx}`}
                        value={activeIngredientMap[`${stepIdx}-${prodIdx}`] ?? ''}
                        onChange={(val) => handleActiveIngredientChange(stepIdx, prodIdx, val)}
                        ingredients={activeIngredients}
                        onAdd={(name) => void handleAddIngredient(name)}
                        adding={addingIngredient}
                      />
                      <div
                        className={`iatf-protocol-modal__field${fieldErrors[`step-${stepIdx}-prod-${prodIdx}-product`] ? ' iatf-protocol-modal__field--error' : ''}`}
                      >
                        <label htmlFor={`prod-select-${stepIdx}-${prodIdx}`}>Produto *</label>
                        <ProductCombobox
                          id={`prod-select-${stepIdx}-${prodIdx}`}
                          value={product.productId ?? ''}
                          displayValue={product.productName}
                          products={getFilteredProducts(
                            activeIngredientMap[`${stepIdx}-${prodIdx}`] || undefined,
                          )}
                          placeholder="Digite para buscar..."
                          onChange={(pid, pname) => {
                            handleProductSelect(stepIdx, prodIdx, pid, pname);
                            const key = `step-${stepIdx}-prod-${prodIdx}-product`;
                            if (fieldErrors[key])
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              });
                          }}
                          onCreateRequest={(name) =>
                            handleProductCreateRequest(stepIdx, prodIdx, name)
                          }
                        />
                        {fieldErrors[`step-${stepIdx}-prod-${prodIdx}-product`] && (
                          <span className="iatf-protocol-modal__field-error" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />{' '}
                            {fieldErrors[`step-${stepIdx}-prod-${prodIdx}-product`]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="iatf-protocol-modal__row iatf-protocol-modal__row--dose">
                      <div className="iatf-protocol-modal__field">
                        <label htmlFor={`prod-route-${stepIdx}-${prodIdx}`}>
                          Via de administração
                        </label>
                        <select
                          id={`prod-route-${stepIdx}-${prodIdx}`}
                          value={product.administrationRoute ?? ''}
                          onChange={(e) =>
                            updateProduct(
                              stepIdx,
                              prodIdx,
                              'administrationRoute',
                              e.target.value || null,
                            )
                          }
                        >
                          <option value="">Selecione...</option>
                          {ADMINISTRATION_ROUTES_IATF.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div
                        className={`iatf-protocol-modal__field${fieldErrors[`step-${stepIdx}-prod-${prodIdx}-dose`] ? ' iatf-protocol-modal__field--error' : ''}`}
                      >
                        <label htmlFor={`prod-dose-${stepIdx}-${prodIdx}`}>Dose *</label>
                        <input
                          id={`prod-dose-${stepIdx}-${prodIdx}`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={product.dose || ''}
                          onChange={(e) => {
                            updateProduct(
                              stepIdx,
                              prodIdx,
                              'dose',
                              e.target.value ? Number(e.target.value) : 0,
                            );
                            const key = `step-${stepIdx}-prod-${prodIdx}-dose`;
                            if (fieldErrors[key])
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              });
                          }}
                          aria-required="true"
                          aria-invalid={!!fieldErrors[`step-${stepIdx}-prod-${prodIdx}-dose`]}
                        />
                        {fieldErrors[`step-${stepIdx}-prod-${prodIdx}-dose`] && (
                          <span className="iatf-protocol-modal__field-error" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />{' '}
                            {fieldErrors[`step-${stepIdx}-prod-${prodIdx}-dose`]}
                          </span>
                        )}
                      </div>
                      <div className="iatf-protocol-modal__field">
                        <label htmlFor={`prod-unit-${stepIdx}-${prodIdx}`}>Unidade *</label>
                        <select
                          id={`prod-unit-${stepIdx}-${prodIdx}`}
                          value={product.doseUnit}
                          onChange={(e) =>
                            updateProduct(stepIdx, prodIdx, 'doseUnit', e.target.value)
                          }
                          required
                          aria-required="true"
                        >
                          {DOSE_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <button type="button" className="iatf-protocol-modal__add-btn" onClick={addStep}>
              <Plus size={16} aria-hidden="true" />
              Adicionar etapa
            </button>
          </fieldset>

          {/* Notes */}
          <div className="iatf-protocol-modal__field">
            <label htmlFor="iatf-notes">Observações gerais</label>
            <textarea
              id="iatf-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          {protocol && (
            <div className="iatf-protocol-modal__save-mode">
              <span className="iatf-protocol-modal__save-mode-label">Tipo de alteração:</span>
              <label className="iatf-protocol-modal__radio">
                <input
                  type="radio"
                  name="save-mode"
                  value="correction"
                  checked={saveMode === 'correction'}
                  onChange={() => setSaveMode('correction')}
                />
                Correção (atualiza o protocolo atual)
              </label>
              <label className="iatf-protocol-modal__radio">
                <input
                  type="radio"
                  name="save-mode"
                  value="new-version"
                  checked={saveMode === 'new-version'}
                  onChange={() => setSaveMode('new-version')}
                />
                Nova versão (mantém histórico da versão anterior)
              </label>
            </div>
          )}

          <footer className="iatf-protocol-modal__footer">
            <button
              type="button"
              className="iatf-protocol-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="iatf-protocol-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : protocol ? 'Salvar alterações' : 'Cadastrar protocolo'}
            </button>
          </footer>
        </form>

        <ProductModal
          isOpen={showProductModal}
          product={null}
          defaultNature="PRODUCT"
          initialName={productInitialName}
          onClose={() => {
            setShowProductModal(false);
            setProductCreateTarget(null);
            setProductInitialName('');
          }}
          onSuccess={handleProductCreated}
        />
      </div>
    </div>
  );
}
