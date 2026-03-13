import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Package } from 'lucide-react';
import { api } from '@/services/api';
import './ProductSearchInput.css';

export interface ProductSuggestion {
  id: string;
  name: string;
  commercialName: string | null;
  type: string;
  nutrientForm: string | null;
  measurementUnitSymbol: string | null;
}

interface ProductSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onProductSelect: (product: ProductSuggestion) => void;
  onProductClear: () => void;
  selectedProductId: string | null;
  /** Filter by product nature (default: PRODUCT) */
  nature?: string;
  /** Filter by product type prefix (e.g. 'defensivo_' for pesticides) */
  typeFilter?: string;
  placeholder?: string;
  label: string;
  id: string;
  required?: boolean;
  disabled?: boolean;
}

function ProductSearchInput({
  value,
  onChange,
  onProductSelect,
  onProductClear,
  selectedProductId,
  nature = 'PRODUCT',
  typeFilter,
  placeholder = 'Digite para buscar no estoque...',
  label,
  id,
  required = false,
  disabled = false,
}: ProductSearchInputProps) {
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchProducts = useCallback(
    async (search: string) => {
      if (search.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          search,
          nature,
          status: 'ACTIVE',
          limit: '8',
        });
        if (typeFilter) {
          params.set('type', typeFilter);
        }
        const result = await api.get<{
          data: ProductSuggestion[];
          meta: { total: number };
        }>(`/org/products?${params}`);
        setSuggestions(result.data);
        setShowDropdown(result.data.length > 0);
        setHighlightedIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [nature, typeFilter],
  );

  const handleInputChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      if (selectedProductId) {
        onProductClear();
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchProducts(newValue);
      }, 300);
    },
    [onChange, selectedProductId, onProductClear, fetchProducts],
  );

  const handleSelect = useCallback(
    (product: ProductSuggestion) => {
      onChange(product.commercialName || product.name);
      onProductSelect(product);
      setShowDropdown(false);
      setSuggestions([]);
    },
    [onChange, onProductSelect],
  );

  const handleClear = useCallback(() => {
    onChange('');
    onProductClear();
    setSuggestions([]);
    setShowDropdown(false);
  }, [onChange, onProductClear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || suggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    },
    [showDropdown, suggestions, highlightedIndex, handleSelect],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const productTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      defensivo_herbicida: 'Herbicida',
      defensivo_inseticida: 'Inseticida',
      defensivo_fungicida: 'Fungicida',
      defensivo_acaricida: 'Acaricida',
      adjuvante: 'Adjuvante',
      fertilizante: 'Fertilizante',
      corretivo_calcario: 'Calcário',
      corretivo_gesso: 'Gesso',
      semente: 'Semente',
      inoculante: 'Inoculante',
      biologico: 'Biológico',
    };
    return labels[type] || type;
  };

  return (
    <div className="product-search" ref={containerRef}>
      <label htmlFor={id} className="product-search__label">
        {label}
        {required && ' *'}
      </label>
      <div className="product-search__input-wrapper">
        <Search size={16} className="product-search__icon" aria-hidden="true" />
        <input
          id={id}
          type="text"
          className={`product-search__input${selectedProductId ? ' product-search__input--linked' : ''}`}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 && !selectedProductId) setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-required={required}
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          role="combobox"
          disabled={disabled}
          autoComplete="off"
        />
        {selectedProductId && (
          <button
            type="button"
            className="product-search__clear"
            onClick={handleClear}
            aria-label="Desvincular produto do estoque"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
        {loading && <span className="product-search__spinner" aria-hidden="true" />}
      </div>
      {selectedProductId && (
        <span className="product-search__linked-hint">
          <Package size={12} aria-hidden="true" />
          Vinculado ao estoque
        </span>
      )}
      {showDropdown && suggestions.length > 0 && (
        <ul
          id={`${id}-listbox`}
          className="product-search__dropdown"
          role="listbox"
          aria-label="Sugestões de produtos"
        >
          {suggestions.map((product, idx) => (
            <li
              key={product.id}
              role="option"
              aria-selected={idx === highlightedIndex}
              className={`product-search__option${idx === highlightedIndex ? ' product-search__option--highlighted' : ''}`}
              onClick={() => handleSelect(product)}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              <span className="product-search__option-name">
                {product.commercialName || product.name}
              </span>
              <span className="product-search__option-type">
                {productTypeLabel(product.type)}
                {product.nutrientForm ? ` · ${product.nutrientForm}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductSearchInput;
