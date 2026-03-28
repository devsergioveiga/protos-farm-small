import { useState, useEffect } from 'react';
import { FileText, Download, AlertTriangle, AlertCircle, Plus, X } from 'lucide-react';
import { useTaxGuides } from '@/hooks/useTaxGuides';
import type { TaxGuide, TaxGuideType, TaxGuideStatus } from '@/types/tax-guide';
import { TAX_GUIDE_TYPE_LABELS, TAX_GUIDE_STATUS_LABELS } from '@/types/tax-guide';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatCompetencia(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${yyyy}`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Status Badge ─────────────────────────────────────────────────────

interface StatusChipProps {
  status: TaxGuideStatus;
}

function StatusChip({ status }: StatusChipProps) {
  const classes: Record<TaxGuideStatus, string> = {
    PENDING: 'bg-neutral-100 text-neutral-600',
    GENERATED: 'bg-blue-100 text-blue-700',
    PAID: 'bg-green-100 text-green-700',
    OVERDUE: 'bg-red-100 text-red-700',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classes[status]}`}
    >
      {TAX_GUIDE_STATUS_LABELS[status]}
    </span>
  );
}

// ─── Alert Icon ───────────────────────────────────────────────────────

interface AlertIconProps {
  alertLevel: 'none' | 'warning' | 'danger' | undefined;
}

function AlertIcon({ alertLevel }: AlertIconProps) {
  if (!alertLevel || alertLevel === 'none') return null;
  if (alertLevel === 'warning') {
    return (
      <AlertTriangle
        size={16}
        className="text-yellow-500"
        aria-label="Vence em breve (menos de 10 dias)"
      />
    );
  }
  return (
    <AlertCircle
      size={16}
      className="text-red-600"
      aria-label="Vencimento crítico (menos de 5 dias)"
    />
  );
}

// ─── Generate Tax Guides Modal ─────────────────────────────────────────

interface GenerateGuidesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function GenerateGuidesModal({ isOpen, onClose, onSuccess }: GenerateGuidesModalProps) {
  const { generateGuides, loading, error } = useTaxGuides();
  const [referenceMonth, setReferenceMonth] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<TaxGuideType[]>([]);

  const ALL_TYPES: TaxGuideType[] = ['FGTS', 'INSS', 'IRRF', 'FUNRURAL'];

  function toggleType(type: TaxGuideType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!referenceMonth) return;
    // Convert "YYYY-MM" to "YYYY-MM-01"
    const refDate = `${referenceMonth}-01`;
    const result = await generateGuides({
      referenceMonth: refDate,
      guideTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    });
    if (result) {
      onSuccess();
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2
            id="generate-modal-title"
            className="text-lg font-bold text-[#2A2520]"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            Gerar Guias de Recolhimento
          </h2>
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="ref-month"
              className="block text-sm font-medium text-[#3E3833] mb-1"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              Competência <span aria-hidden="true">*</span>
            </label>
            <input
              id="ref-month"
              type="month"
              required
              aria-required="true"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            />
          </div>

          <fieldset className="mb-6">
            <legend className="block text-sm font-medium text-[#3E3833] mb-2">
              Tipos de Guia (deixe vazio para gerar todos)
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {ALL_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer text-sm text-[#3E3833]"
                  style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => toggleType(type)}
                    className="w-4 h-4 accent-[#2E7D32]"
                  />
                  {TAX_GUIDE_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p
              role="alert"
              className="text-sm text-red-600 mb-4"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors min-h-[48px]"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !referenceMonth}
              className="px-4 py-3 text-sm font-semibold text-white bg-[#2E7D32] rounded-lg hover:bg-[#256427] disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              {loading ? 'Gerando...' : 'Gerar Guias'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── TaxGuidesPage ────────────────────────────────────────────────────

export default function TaxGuidesPage() {
  const { guides, loading, error, successMessage, fetchGuides, downloadGuide } = useTaxGuides();
  const [filterMonth, setFilterMonth] = useState('');
  const [filterType, setFilterType] = useState<TaxGuideType | ''>('');
  const [filterStatus, setFilterStatus] = useState<TaxGuideStatus | ''>('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const ALL_TYPES: TaxGuideType[] = ['FGTS', 'INSS', 'IRRF', 'FUNRURAL'];
  const ALL_STATUSES: TaxGuideStatus[] = ['PENDING', 'GENERATED', 'PAID', 'OVERDUE'];

  useEffect(() => {
    fetchGuides({
      referenceMonth: filterMonth ? `${filterMonth}-01` : undefined,
      guideType: filterType || undefined,
      status: filterStatus || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterType, filterStatus]);

  function handleGenerateSuccess() {
    fetchGuides({
      referenceMonth: filterMonth ? `${filterMonth}-01` : undefined,
      guideType: filterType || undefined,
      status: filterStatus || undefined,
    });
  }

  async function handleDownload(guide: TaxGuide) {
    await downloadGuide(guide.id, guide.guideType, guide.referenceMonth);
  }

  return (
    <>
      <main className="p-6 max-w-[1280px] mx-auto" id="main-content">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol
            className="flex items-center gap-2 text-sm text-neutral-500"
            style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
          >
            <li>Obrigações Acessórias</li>
            <li aria-hidden="true">/</li>
            <li className="text-[#3E3833] font-medium">Guias de Recolhimento</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <h1
            className="text-2xl font-bold text-[#2A2520]"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            Guias de Recolhimento
          </h1>
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-[#2E7D32] rounded-lg hover:bg-[#256427] transition-colors min-h-[48px] w-fit"
            style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
          >
            <Plus size={20} aria-hidden="true" />
            Gerar Guias
          </button>
        </header>

        {/* Success message */}
        {successMessage && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700"
            style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
          >
            {successMessage}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
            style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
          >
            {error}
          </div>
        )}

        {/* Filters */}
        <section aria-label="Filtros" className="flex flex-wrap gap-3 mb-6">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-month"
              className="text-xs font-medium text-neutral-500 uppercase tracking-wide"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              COMPETÊNCIA
            </label>
            <input
              id="filter-month"
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="border border-neutral-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] min-h-[48px]"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-type"
              className="text-xs font-medium text-neutral-500 uppercase tracking-wide"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              TIPO
            </label>
            <select
              id="filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as TaxGuideType | '')}
              className="border border-neutral-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] min-h-[48px]"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              <option value="">Todos os tipos</option>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TAX_GUIDE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-status"
              className="text-xs font-medium text-neutral-500 uppercase tracking-wide"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              STATUS
            </label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TaxGuideStatus | '')}
              className="border border-neutral-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] min-h-[48px]"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              <option value="">Todos os status</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TAX_GUIDE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Table or skeleton or empty state */}
        {loading ? (
          <div aria-busy="true" aria-label="Carregando guias" className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-neutral-100 rounded-lg animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : guides.length === 0 ? (
          <section
            aria-label="Nenhuma guia encontrada"
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <FileText size={64} className="text-neutral-300 mb-4" aria-hidden="true" />
            <h2
              className="text-lg font-semibold text-[#2A2520] mb-2"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              Nenhuma guia gerada
            </h2>
            <p
              className="text-sm text-neutral-500 mb-6 max-w-sm"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              Gere as guias a partir de uma folha de pagamento fechada para a competência desejada.
            </p>
            <button
              type="button"
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-[#2E7D32] rounded-lg hover:bg-[#256427] transition-colors min-h-[48px]"
              style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            >
              <Plus size={20} aria-hidden="true" />
              Gerar Guias
            </button>
          </section>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">Lista de guias de recolhimento</caption>
              <thead>
                <tr className="border-b border-neutral-200">
                  {['TIPO', 'COMPETÊNCIA', 'VENCIMENTO', 'VALOR', 'STATUS', 'ALERTA', 'AÇÕES'].map(
                    (col) => (
                      <th
                        key={col}
                        scope="col"
                        className="py-3 px-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide"
                        style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {guides.map((guide) => (
                  <tr
                    key={guide.id}
                    className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                  >
                    {/* TIPO */}
                    <td className="py-4 px-4">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#2E7D32]/10 text-[#2E7D32]"
                        style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
                      >
                        {TAX_GUIDE_TYPE_LABELS[guide.guideType]}
                      </span>
                    </td>

                    {/* COMPETÊNCIA */}
                    <td
                      className="py-4 px-4 text-[#3E3833]"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {formatCompetencia(guide.referenceMonth)}
                    </td>

                    {/* VENCIMENTO */}
                    <td
                      className="py-4 px-4 text-[#3E3833]"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {formatDate(guide.dueDate)}
                    </td>

                    {/* VALOR */}
                    <td
                      className="py-4 px-4 font-medium text-[#3E3833]"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {formatCurrency(guide.totalAmount)}
                    </td>

                    {/* STATUS */}
                    <td className="py-4 px-4">
                      <StatusChip status={guide.status} />
                    </td>

                    {/* ALERTA */}
                    <td className="py-4 px-4">
                      <AlertIcon alertLevel={guide.alertLevel} />
                    </td>

                    {/* AÇÕES */}
                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => handleDownload(guide)}
                        disabled={guide.status === 'PENDING'}
                        aria-label={`Baixar guia ${TAX_GUIDE_TYPE_LABELS[guide.guideType]} de ${formatCompetencia(guide.referenceMonth)}`}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-[#2E7D32] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title={guide.status === 'PENDING' ? 'Guia ainda não gerada' : 'Baixar guia'}
                      >
                        <Download size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <GenerateGuidesModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSuccess={handleGenerateSuccess}
      />
    </>
  );
}
