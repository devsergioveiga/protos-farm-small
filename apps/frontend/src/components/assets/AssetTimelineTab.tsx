import { Package, Edit } from 'lucide-react';
import type { Asset } from '@/types/asset';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

// ─── AssetTimelineTab ─────────────────────────────────────────────────

interface AssetTimelineTabProps {
  asset: Asset;
}

interface TimelineEvent {
  id: string;
  date: string;
  description: string;
  icon: React.ElementType;
}

export default function AssetTimelineTab({ asset }: AssetTimelineTabProps) {
  const events: TimelineEvent[] = [];

  events.push({
    id: 'created',
    date: asset.createdAt,
    description: 'Ativo cadastrado no sistema',
    icon: Package,
  });

  if (asset.updatedAt && asset.updatedAt !== asset.createdAt) {
    events.push({
      id: 'updated',
      date: asset.updatedAt,
      description: 'Ultima atualizacao de dados',
      icon: Edit,
    });
  }

  // Sort events descending (most recent first)
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="timeline-tab">
      <ol className="timeline-tab__list" aria-label="Historico de eventos do ativo">
        {events.map((event) => {
          const Icon = event.icon;
          return (
            <li key={event.id} className="timeline-tab__item">
              <div className="timeline-tab__dot" aria-hidden="true">
                <Icon size={16} aria-hidden="true" />
              </div>
              <div className="timeline-tab__content">
                <span className="timeline-tab__description">{event.description}</span>
                <time className="timeline-tab__date" dateTime={event.date}>
                  {formatDateTime(event.date)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>

      {events.length <= 1 && (
        <p className="timeline-tab__hint">
          Eventos futuros aparecerao aqui conforme o ativo for utilizado.
        </p>
      )}
    </div>
  );
}
