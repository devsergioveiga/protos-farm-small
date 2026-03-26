import { useState, useEffect } from 'react';
import {
  FileCode,
  Download,
  RefreshCw,
  XCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { useEsocialEvents } from '@/hooks/useEsocialEvents';

const GROUP_TABS = [
  { key: '', label: 'Todos' },
  { key: 'TABELA', label: 'Tabela' },
  { key: 'NAO_PERIODICO', label: 'Não Periódicos' },
  { key: 'PERIODICO', label: 'Periódicos' },
  { key: 'SST', label: 'SST' },
] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  EXPORTADO: 'Exportado',
  ACEITO: 'Aceito',
  REJEITADO: 'Rejeitado',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDENTE: 'bg-yellow-100 text-yellow-800',
    EXPORTADO: 'bg-blue-100 text-blue-800',
    ACEITO: 'bg-green-100 text-green-800',
    REJEITADO: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function EsocialEventsPage() {
  const { events, stats, loading, error, generating, fetchEvents, generateEvents, downloadEvent, rejectEvent, reprocessEvent } = useEsocialEvents();
  const [activeGroup, setActiveGroup] = useState('');
  const [referenceMonth, setReferenceMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean }>({ id: '', open: false });
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    void fetchEvents(activeGroup || undefined, referenceMonth);
  }, [activeGroup, referenceMonth, fetchEvents]);

  async function handleGenerate() {
    await generateEvents(`${referenceMonth}-01`);
  }

  async function handleDownload(id: string) {
    await downloadEvent(id);
  }

  async function handleRejectConfirm() {
    if (!rejectReason.trim()) return;
    await rejectEvent(rejectModal.id, rejectReason);
    setRejectModal({ id: '', open: false });
    setRejectReason('');
  }

  async function handleReprocess(id: string) {
    await reprocessEvent(id);
  }

  return (
    <main className="p-6 max-w-screen-xl mx-auto">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--color-neutral-500)] mb-4">
        <span>RH</span>
        <span className="mx-2">/</span>
        <span className="text-[var(--color-neutral-700)]">Eventos eSocial</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-neutral-800)]" style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}>
          Eventos eSocial
        </h1>
        <div className="flex gap-3">
          <input
            type="month"
            value={referenceMonth}
            onChange={(e) => setReferenceMonth(e.target.value)}
            aria-label="Competência de referência"
            className="border border-[var(--color-neutral-300)] rounded px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)]"
          />
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            aria-label="Gerar eventos eSocial"
            className="flex items-center gap-2 bg-[var(--color-primary-600)] text-white px-4 py-2 rounded text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-50 min-h-[48px]"
          >
            <Plus size={16} aria-hidden="true" />
            {generating ? 'Gerando...' : 'Gerar Eventos'}
          </button>
        </div>
      </header>

      {/* Dashboard cards */}
      <section aria-label="Resumo de eventos" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: FileCode, color: 'text-[var(--color-neutral-700)]' },
          { label: 'Pendentes', value: stats.pendente, icon: Clock, color: 'text-yellow-600' },
          { label: 'Exportados', value: stats.exportado, icon: CheckCircle, color: 'text-blue-600' },
          { label: 'Rejeitados', value: stats.rejeitado, icon: XCircle, color: 'text-[var(--color-error-500)]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-4">
            <div className={`flex items-center gap-2 mb-1 ${color}`}>
              <Icon size={20} aria-hidden="true" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-neutral-800)]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
          </div>
        ))}
      </section>

      {error && (
        <div role="alert" className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Group tabs */}
      <div role="tablist" aria-label="Grupos de eventos" className="flex gap-1 border-b border-[var(--color-neutral-200)] mb-4 overflow-x-auto">
        {GROUP_TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeGroup === key}
            onClick={() => setActiveGroup(key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeGroup === key ? 'border-[var(--color-primary-600)] text-[var(--color-primary-600)]' : 'border-transparent text-[var(--color-neutral-600)] hover:text-[var(--color-neutral-800)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Events table */}
      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando eventos">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-[var(--color-neutral-100)] rounded animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <FileCode size={48} className="mx-auto text-[var(--color-neutral-400)] mb-3" aria-hidden="true" />
          <p className="font-semibold text-[var(--color-neutral-700)]">Nenhum evento encontrado</p>
          <p className="text-sm text-[var(--color-neutral-500)] mt-1">Clique em "Gerar Eventos" para criar os eventos da competência selecionada.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Lista de eventos eSocial</caption>
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)] text-left text-xs uppercase text-[var(--color-neutral-500)]">
                <th scope="col" className="py-3 pr-4 font-medium">TIPO</th>
                <th scope="col" className="py-3 pr-4 font-medium">GRUPO</th>
                <th scope="col" className="py-3 pr-4 font-medium">COMPETÊNCIA</th>
                <th scope="col" className="py-3 pr-4 font-medium">STATUS</th>
                <th scope="col" className="py-3 font-medium">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
                  <td className="py-3 pr-4 font-mono text-xs">{ev.eventType}</td>
                  <td className="py-3 pr-4 text-[var(--color-neutral-600)]">{ev.eventGroup}</td>
                  <td className="py-3 pr-4 text-[var(--color-neutral-600)]">
                    {ev.referenceMonth ? ev.referenceMonth.slice(0, 7) : '—'}
                  </td>
                  <td className="py-3 pr-4"><StatusBadge status={ev.status} /></td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      {ev.status !== 'REJEITADO' && (
                        <button
                          type="button"
                          onClick={() => void handleDownload(ev.id)}
                          aria-label={`Baixar XML do evento ${ev.eventType}`}
                          className="p-1 text-[var(--color-neutral-500)] hover:text-[var(--color-primary-600)] min-h-[48px] min-w-[48px] flex items-center justify-center"
                        >
                          <Download size={16} aria-hidden="true" />
                        </button>
                      )}
                      {ev.status === 'EXPORTADO' && (
                        <button
                          type="button"
                          onClick={() => setRejectModal({ id: ev.id, open: true })}
                          aria-label={`Marcar evento ${ev.eventType} como rejeitado`}
                          className="p-1 text-[var(--color-neutral-500)] hover:text-[var(--color-error-500)] min-h-[48px] min-w-[48px] flex items-center justify-center"
                        >
                          <XCircle size={16} aria-hidden="true" />
                        </button>
                      )}
                      {ev.status === 'REJEITADO' && (
                        <button
                          type="button"
                          onClick={() => void handleReprocess(ev.id)}
                          aria-label={`Reprocessar evento ${ev.eventType}`}
                          className="p-1 text-[var(--color-neutral-500)] hover:text-[var(--color-primary-600)] min-h-[48px] min-w-[48px] flex items-center justify-center"
                        >
                          <RefreshCw size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rejection modal */}
      {rejectModal.open && (
        <div role="dialog" aria-modal="true" aria-labelledby="reject-modal-title" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 id="reject-modal-title" className="text-lg font-bold text-[var(--color-neutral-800)] mb-4" style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}>
              Informar motivo de rejeição
            </h2>
            <label htmlFor="reject-reason" className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1">
              Motivo da rejeição <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              aria-required="true"
              className="w-full border border-[var(--color-neutral-300)] rounded px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)] mb-4"
              placeholder="Descreva o motivo da rejeição pelo eSocial..."
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setRejectModal({ id: '', open: false }); setRejectReason(''); }}
                className="px-4 py-2 text-sm text-[var(--color-neutral-700)] border border-[var(--color-neutral-300)] rounded hover:bg-[var(--color-neutral-50)] min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleRejectConfirm()}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 text-sm bg-[var(--color-error-500)] text-white rounded hover:bg-[var(--color-error-600)] disabled:opacity-50 min-h-[48px]"
              >
                Confirmar rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
