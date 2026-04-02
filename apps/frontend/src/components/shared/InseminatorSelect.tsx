import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import './InseminatorSelect.css';

interface InseminatorOption {
  id: string;
  name: string;
}

interface Props {
  farmId: string;
  value: { id: string; name: string } | null;
  onChange: (value: { id: string; name: string } | null) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

/** null = still loading, [] = loaded but empty */
function useInseminators(farmId: string, orgId: string) {
  const [options, setOptions] = useState<InseminatorOption[] | null>(null);

  useEffect(() => {
    if (!farmId || !orgId) return;
    let cancelled = false;
    void api
      .get<InseminatorOption[]>(`/org/${orgId}/employees/by-function/INSEMINATOR?farmId=${farmId}`)
      .then((res) => {
        if (!cancelled) setOptions(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId, orgId]);

  return options;
}

export default function InseminatorSelect({
  farmId,
  value,
  onChange,
  required,
  disabled,
  id,
}: Props) {
  const { user } = useAuth();
  const orgId = user?.organizationId ?? '';
  const optionsOrNull = useInseminators(farmId, orgId);
  const isLoading = optionsOrNull === null;
  const options = optionsOrNull ?? [];
  const [searchText, setSearchText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = options.filter((o) => o.name.toLowerCase().includes(searchText.toLowerCase()));

  const handleSelect = useCallback(
    (opt: InseminatorOption) => {
      onChange({ id: opt.id, name: opt.name });
      setSearchText('');
      setIsOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setSearchText('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    if (!isOpen) setIsOpen(true);
    // Clear selection when typing
    if (value) {
      onChange(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const displayValue = value ? value.name : searchText;

  return (
    <div
      className={`inseminator-select ${disabled ? 'inseminator-select--disabled' : ''}`}
      ref={containerRef}
    >
      <div className="inseminator-select__input-wrapper">
        <Search size={16} aria-hidden="true" className="inseminator-select__icon" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="inseminator-select__input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? 'Carregando...' : 'Buscar inseminador'}
          required={required}
          disabled={disabled || isLoading}
          aria-required={required}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={id ? `${id}-listbox` : undefined}
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            className="inseminator-select__clear"
            onClick={handleClear}
            aria-label="Limpar seleção"
            tabIndex={-1}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : (
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`inseminator-select__chevron ${isOpen ? 'inseminator-select__chevron--open' : ''}`}
          />
        )}
      </div>

      {isOpen && (
        <ul
          className="inseminator-select__dropdown"
          role="listbox"
          id={id ? `${id}-listbox` : undefined}
        >
          {filtered.length === 0 ? (
            <li
              className="inseminator-select__empty"
              role="option"
              aria-disabled="true"
              aria-selected={false}
            >
              {options.length === 0
                ? 'Nenhum inseminador cadastrado'
                : 'Nenhum resultado encontrado'}
            </li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={value?.id === opt.id}
                className={`inseminator-select__option ${value?.id === opt.id ? 'inseminator-select__option--selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
              >
                {opt.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
