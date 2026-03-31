import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import type { ManufacturerItem } from '@/hooks/useManufacturers';
import './ManufacturerModal.css';

// ─── CNPJ Helpers ──────────────────────────────────────────────────

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function cnpjDigits(value: string): string {
  return value.replace(/\D/g, '');
}

interface BrasilApiResponse {
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  municipio: string;
  uf: string;
}

async function fetchCnpjData(cnpj: string): Promise<BrasilApiResponse> {
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!res.ok) throw new Error('CNPJ não encontrado');
  return res.json();
}

// ─── Component ─────────────────────────────────────────────────────

interface ManufacturerModalProps {
  isOpen: boolean;
  manufacturer: ManufacturerItem | null;
  onClose: () => void;
  onSave: (name: string, cnpj: string | null) => Promise<void>;
}

export default function ManufacturerModal({
  isOpen,
  manufacturer,
  onClose,
  onSave,
}: ManufacturerModalProps) {
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [cnpjLookupStatus, setCnpjLookupStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [cnpjLookupMessage, setCnpjLookupMessage] = useState('');
  const cnpjLookupRef = useRef<AbortController | null>(null);

  const handleCnpjLookup = useCallback(async (rawCnpj: string) => {
    const digits = cnpjDigits(rawCnpj);
    if (digits.length !== 14) return;

    if (cnpjLookupRef.current) cnpjLookupRef.current.abort();
    const controller = new AbortController();
    cnpjLookupRef.current = controller;

    setCnpjLookupStatus('loading');
    setCnpjLookupMessage('Consultando CNPJ...');
    try {
      const data = await fetchCnpjData(digits);
      if (controller.signal.aborted) return;
      const razao = data.razao_social || data.nome_fantasia || '';
      if (razao) {
        setName(razao);
      }
      const location = [data.municipio, data.uf].filter(Boolean).join('/');
      setCnpjLookupStatus('success');
      setCnpjLookupMessage(
        `${razao}${location ? ` — ${location}` : ''}${data.situacao_cadastral && data.situacao_cadastral !== 'ATIVA' ? ` (${data.situacao_cadastral})` : ''}`,
      );
    } catch {
      if (controller.signal.aborted) return;
      setCnpjLookupStatus('error');
      setCnpjLookupMessage('CNPJ não encontrado na Receita Federal');
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      if (manufacturer) {
        setName(manufacturer.name);
        setCnpj(manufacturer.cnpj ? formatCnpj(manufacturer.cnpj) : '');
      } else {
        setName('');
        setCnpj('');
      }
      setSubmitError(null);
      setCnpjLookupStatus('idle');
      setCnpjLookupMessage('');
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, manufacturer, handleKeyDown]);

  if (!isOpen) return null;

  const canSubmit = name.trim() && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSave(name.trim(), cnpjDigits(cnpj) || null);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao salvar fabricante.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mfr-modal__overlay" onClick={onClose}>
      <div
        className="mfr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfr-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mfr-modal__header">
          <h2 id="mfr-modal-title">{manufacturer ? 'Editar fabricante' : 'Novo fabricante'}</h2>
          <button onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="mfr-modal__body">
            {submitError && (
              <div className="mfr-modal__error" role="alert">
                {submitError}
              </div>
            )}

            <div className="mfr-modal__field">
              <label htmlFor="mfr-cnpj">CNPJ</label>
              <div className="mfr-modal__cnpj-wrapper">
                <input
                  id="mfr-cnpj"
                  type="text"
                  value={cnpj}
                  onChange={(e) => {
                    const formatted = formatCnpj(e.target.value);
                    setCnpj(formatted);
                    setCnpjLookupStatus('idle');
                    setCnpjLookupMessage('');
                    if (cnpjDigits(formatted).length === 14) {
                      void handleCnpjLookup(formatted);
                    }
                  }}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  maxLength={18}
                  autoFocus
                />
                {cnpjLookupStatus === 'loading' && (
                  <Loader2
                    size={16}
                    className="mfr-modal__cnpj-icon mfr-modal__spinner"
                    aria-hidden="true"
                  />
                )}
                {cnpjLookupStatus !== 'loading' && cnpjDigits(cnpj).length === 14 && (
                  <button
                    type="button"
                    className="mfr-modal__cnpj-btn"
                    aria-label="Consultar CNPJ"
                    onClick={() => void handleCnpjLookup(cnpj)}
                  >
                    <Search size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              {cnpjLookupMessage && (
                <span
                  className={`mfr-modal__cnpj-feedback mfr-modal__cnpj-feedback--${cnpjLookupStatus}`}
                  role={cnpjLookupStatus === 'error' ? 'alert' : undefined}
                >
                  {cnpjLookupMessage}
                </span>
              )}
            </div>

            <div className="mfr-modal__field">
              <label htmlFor="mfr-name">
                Nome / Razão Social <span>*</span>
              </label>
              <input
                id="mfr-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Bayer CropScience"
                required
              />
            </div>
          </div>

          <footer className="mfr-modal__footer">
            <button type="button" className="mfr-modal__btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="mfr-modal__btn--primary" disabled={!canSubmit}>
              {isSubmitting && (
                <Loader2 size={16} className="mfr-modal__spinner" aria-hidden="true" />
              )}
              {manufacturer ? 'Salvar' : 'Cadastrar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
