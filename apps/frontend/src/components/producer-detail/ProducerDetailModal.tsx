import { useEffect, useCallback, useState } from 'react';
import {
  X,
  AlertCircle,
  FileText,
  MapPin,
  Users,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useProducerDetail } from '@/hooks/useProducerDetail';
import PermissionGate from '@/components/auth/PermissionGate';
import ConfirmModal from '@/components/ui/ConfirmModal';
import FarmLinkFormModal from '@/components/producer-form/FarmLinkFormModal';
import IeFormModal from '@/components/producer-form/IeFormModal';
import { api } from '@/services/api';
import type {
  ProducerType,
  ProducerDetail,
  ProducerStateRegistration,
  ProducerFarmLink,
  SocietyParticipant,
} from '@/types/producer';
import './ProducerDetailModal.css';

const TYPE_LABELS: Record<ProducerType, string> = {
  PF: 'Pessoa Física',
  PJ: 'Pessoa Jurídica',
  SOCIEDADE_EM_COMUM: 'Sociedade',
};

const BOND_TYPE_LABELS: Record<string, string> = {
  PROPRIETARIO: 'Proprietário',
  ARRENDATARIO: 'Arrendatário',
  COMODATARIO: 'Comodatário',
  PARCEIRO: 'Parceiro',
  MEEIRO: 'Meeiro',
  USUFRUTUARIO: 'Usufrutuário',
  CONDOMINO: 'Condômino',
};

const TAX_REGIME_LABELS: Record<string, string> = {
  REAL: 'Lucro Real',
  PRESUMIDO: 'Lucro Presumido',
  SIMPLES: 'Simples Nacional',
  ISENTO: 'Isento',
};

const IE_SITUATION_LABELS: Record<string, string> = {
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
};

interface ProducerDetailModalProps {
  producerId: string | null;
  onClose: () => void;
  onStatusChange: () => void;
  onEdit?: (producerId: string, type: ProducerType) => void;
  onDelete?: () => void;
}

function formatDocument(doc: string | null, type: ProducerType): string {
  if (!doc) return '—';
  const digits = doc.replace(/\D/g, '');
  if (type === 'PJ' && digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return doc;
}

function formatCpf(cpf: string | null): string {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}

function formatCep(cep: string | null): string {
  if (!cep) return '—';
  const digits = cep.replace(/\D/g, '');
  if (digits.length === 8) {
    return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  return cep;
}

// ─── Sub-components ────────────────────────────────────────────────

function DlItem({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  const isEmpty = value === '—' || !value;
  return (
    <div className={`producer-detail__dl-item${full ? ' producer-detail__dl-item--full' : ''}`}>
      <dt className="producer-detail__dt">{label}</dt>
      <dd
        className={`producer-detail__dd${mono ? ' producer-detail__dd--mono' : ''}${isEmpty ? ' producer-detail__dd--empty' : ''}`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

function GeneralSection({ producer }: { producer: ProducerDetail }) {
  return (
    <section className="producer-detail__section">
      <h3 className="producer-detail__section-title">Dados Gerais</h3>
      <dl className="producer-detail__dl">
        <DlItem label="Nome" value={producer.name} full />
        <DlItem label="Documento" value={formatDocument(producer.document, producer.type)} mono />
        <DlItem label="Nome fantasia" value={producer.tradeName || '—'} />
        {producer.type === 'PF' && (
          <>
            <DlItem label="Data de nascimento" value={formatDate(producer.birthDate)} />
            <DlItem label="CPF do cônjuge" value={formatCpf(producer.spouseCpf)} mono />
          </>
        )}
        <DlItem label="Logradouro" value={producer.street || '—'} full />
        <DlItem label="Número" value={producer.addressNumber || '—'} />
        <DlItem label="Complemento" value={producer.complement || '—'} />
        <DlItem label="Bairro" value={producer.neighborhood || '—'} />
        <DlItem label="Distrito/Povoado" value={producer.district || '—'} />
        <DlItem label="Referência" value={producer.locationReference || '—'} full />
        <DlItem label="Município" value={producer.city || '—'} />
        <DlItem label="UF" value={producer.state || '—'} />
        <DlItem label="CEP" value={formatCep(producer.zipCode)} mono />
        <DlItem label="Registro INCRA" value={producer.incraRegistration || '—'} mono />
        <DlItem label="Representante legal" value={producer.legalRepresentative || '—'} />
        <DlItem label="CPF do representante" value={formatCpf(producer.legalRepCpf)} mono />
        <DlItem
          label="Regime tributário"
          value={
            producer.taxRegime ? TAX_REGIME_LABELS[producer.taxRegime] || producer.taxRegime : '—'
          }
        />
        {producer.type === 'PJ' && (
          <>
            <DlItem label="CNAE principal" value={producer.mainCnae || '—'} mono />
            <DlItem label="Atividade rural" value={producer.ruralActivityType || '—'} />
          </>
        )}
      </dl>
    </section>
  );
}

function ParticipantsSection({ participants }: { participants: SocietyParticipant[] }) {
  if (participants.length === 0) {
    return (
      <section className="producer-detail__section">
        <h3 className="producer-detail__section-title">Participantes</h3>
        <div className="producer-detail__empty">
          <Users size={32} aria-hidden="true" />
          <p className="producer-detail__empty-text">Nenhum participante cadastrado</p>
        </div>
      </section>
    );
  }

  return (
    <section className="producer-detail__section">
      <h3 className="producer-detail__section-title">Participantes</h3>
      <div className="producer-detail__cards-list">
        {participants.map((p) => (
          <div key={p.id} className="producer-detail__card">
            <h4 className="producer-detail__card-title">
              {p.name}
              {p.isMainResponsible && (
                <span
                  className="producer-detail__badge producer-detail__badge--active"
                  style={{ marginLeft: 8 }}
                >
                  Responsável
                </span>
              )}
            </h4>
            <div className="producer-detail__card-row">
              <span className="producer-detail__card-label">CPF</span>
              <span className="producer-detail__card-value producer-detail__card-value--mono">
                {formatCpf(p.cpf)}
              </span>
            </div>
            {p.participationPct != null && (
              <div className="producer-detail__card-row">
                <span className="producer-detail__card-label">Participação</span>
                <span className="producer-detail__card-value">{p.participationPct}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function IeSection({
  registrations,
  onAdd,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  registrations: ProducerStateRegistration[];
  onAdd: () => void;
  onEdit: (ie: ProducerStateRegistration) => void;
  onDelete: (ie: ProducerStateRegistration) => void;
  onSetDefault: (ie: ProducerStateRegistration) => void;
}) {
  return (
    <section className="producer-detail__section">
      <div className="producer-detail__section-header">
        <h3 className="producer-detail__section-title" style={{ marginBottom: 0 }}>
          Inscrições Estaduais
        </h3>
        <PermissionGate permission="producers:update">
          <button
            type="button"
            className="producer-detail__btn producer-detail__btn--add"
            onClick={onAdd}
          >
            <Plus size={16} aria-hidden="true" />
            Adicionar
          </button>
        </PermissionGate>
      </div>
      {registrations.length === 0 ? (
        <div className="producer-detail__empty">
          <FileText size={32} aria-hidden="true" />
          <p className="producer-detail__empty-text">Nenhuma inscrição estadual cadastrada</p>
        </div>
      ) : (
        <div className="producer-detail__cards-list">
          {registrations.map((ie) => (
            <div key={ie.id} className="producer-detail__card">
              <div className="producer-detail__card-header">
                <h4 className="producer-detail__card-title">
                  IE {ie.number} — {ie.state}
                  {ie.isDefaultForFarm && (
                    <span
                      className="producer-detail__badge producer-detail__badge--active"
                      style={{ marginLeft: 8 }}
                    >
                      Padrão
                    </span>
                  )}
                </h4>
                <PermissionGate permission="producers:update">
                  <div className="producer-detail__card-actions">
                    {!ie.isDefaultForFarm && (
                      <button
                        type="button"
                        className="producer-detail__card-action"
                        aria-label={`Definir IE ${ie.number} como padrão`}
                        onClick={() => onSetDefault(ie)}
                      >
                        <Star size={16} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="producer-detail__card-action"
                      aria-label={`Editar IE ${ie.number}`}
                      onClick={() => onEdit(ie)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="producer-detail__card-action producer-detail__card-action--danger"
                      aria-label={`Excluir IE ${ie.number}`}
                      onClick={() => onDelete(ie)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </PermissionGate>
              </div>
              <div className="producer-detail__card-row">
                <span className="producer-detail__card-label">Situação</span>
                <span className="producer-detail__card-value">
                  {ie.situation ? IE_SITUATION_LABELS[ie.situation] || ie.situation : '—'}
                </span>
              </div>
              {ie.category && (
                <div className="producer-detail__card-row">
                  <span className="producer-detail__card-label">Categoria</span>
                  <span className="producer-detail__card-value">{ie.category}</span>
                </div>
              )}
              {ie.inscriptionDate && (
                <div className="producer-detail__card-row">
                  <span className="producer-detail__card-label">Data inscrição</span>
                  <span className="producer-detail__card-value">
                    {formatDate(ie.inscriptionDate)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FarmLinksSection({
  links,
  onAdd,
  onEdit,
  onDelete,
}: {
  links: ProducerFarmLink[];
  onAdd: () => void;
  onEdit: (link: ProducerFarmLink) => void;
  onDelete: (link: ProducerFarmLink) => void;
}) {
  return (
    <section className="producer-detail__section">
      <div className="producer-detail__section-header">
        <h3 className="producer-detail__section-title" style={{ marginBottom: 0 }}>
          Vínculos com Fazendas
        </h3>
        <PermissionGate permission="producers:update">
          <button
            type="button"
            className="producer-detail__btn producer-detail__btn--add"
            onClick={onAdd}
          >
            <Plus size={16} aria-hidden="true" />
            Vincular fazenda
          </button>
        </PermissionGate>
      </div>
      {links.length === 0 ? (
        <div className="producer-detail__empty">
          <MapPin size={32} aria-hidden="true" />
          <p className="producer-detail__empty-text">Nenhum vínculo com fazenda cadastrado</p>
        </div>
      ) : (
        <div className="producer-detail__cards-list">
          {links.map((link) => (
            <div key={link.id} className="producer-detail__card">
              <div className="producer-detail__card-header">
                <h4 className="producer-detail__card-title">
                  {link.farm.name}
                  {link.farm.state && ` — ${link.farm.state}`}
                </h4>
                <PermissionGate permission="producers:update">
                  <div className="producer-detail__card-actions">
                    <button
                      type="button"
                      className="producer-detail__card-action"
                      aria-label={`Editar vínculo com ${link.farm.name}`}
                      onClick={() => onEdit(link)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="producer-detail__card-action producer-detail__card-action--danger"
                      aria-label={`Excluir vínculo com ${link.farm.name}`}
                      onClick={() => onDelete(link)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </PermissionGate>
              </div>
              <div className="producer-detail__card-row">
                <span className="producer-detail__card-label">Tipo de vínculo</span>
                <span className="producer-detail__card-value">
                  {BOND_TYPE_LABELS[link.bondType] || link.bondType}
                </span>
              </div>
              {link.participationPct != null && (
                <div className="producer-detail__card-row">
                  <span className="producer-detail__card-label">Participação</span>
                  <span className="producer-detail__card-value">{link.participationPct}%</span>
                </div>
              )}
              <div className="producer-detail__card-row">
                <span className="producer-detail__card-label">Vigência</span>
                <span className="producer-detail__card-value">
                  {formatDate(link.startDate)}
                  {link.endDate ? ` a ${formatDate(link.endDate)}` : ' — vigente'}
                </span>
              </div>
              {link.isItrDeclarant && (
                <div className="producer-detail__card-row">
                  <span className="producer-detail__card-label">ITR</span>
                  <span className="producer-detail__card-value producer-detail__card-value--highlight">
                    Declarante
                  </span>
                </div>
              )}
              {link.registrationLinks && link.registrationLinks.length > 0 && (
                <div className="producer-detail__card-row">
                  <span className="producer-detail__card-label">Matrículas</span>
                  <span className="producer-detail__card-value">
                    {link.registrationLinks.map((rl) => rl.farmRegistration.number).join(', ')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SkeletonBody() {
  return (
    <div className="producer-detail__body" data-testid="producer-detail-skeleton">
      <div
        className="producer-detail__skeleton"
        style={{ width: '40%', height: 20, marginBottom: 16 }}
      />
      <div
        className="producer-detail__skeleton"
        style={{ width: '100%', height: 120, marginBottom: 24 }}
      />
      <div
        className="producer-detail__skeleton"
        style={{ width: '50%', height: 20, marginBottom: 16 }}
      />
      <div className="producer-detail__skeleton" style={{ width: '100%', height: 80 }} />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

function ProducerDetailModal({
  producerId,
  onClose,
  onStatusChange,
  onEdit,
  onDelete,
}: ProducerDetailModalProps) {
  const { producer, isLoading, error, refetch } = useProducerDetail(producerId);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [farmLinkModal, setFarmLinkModal] = useState<{
    isOpen: boolean;
    link?: ProducerFarmLink;
  }>({ isOpen: false });
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [confirmDeleteLink, setConfirmDeleteLink] = useState<ProducerFarmLink | null>(null);
  const [ieModal, setIeModal] = useState<{
    isOpen: boolean;
    ie?: ProducerStateRegistration;
  }>({ isOpen: false });
  const [confirmDeleteIe, setConfirmDeleteIe] = useState<ProducerStateRegistration | null>(null);
  const [deletingIeId, setDeletingIeId] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!producerId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [producerId, handleClose]);

  const handleToggleStatus = useCallback(async () => {
    if (!producer) return;
    const newStatus = producer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setIsTogglingStatus(true);
    try {
      await api.patch(`/org/producers/${producer.id}/status`, { status: newStatus });
      await refetch();
      onStatusChange();
    } catch {
      // Error will show on next refetch
    } finally {
      setIsTogglingStatus(false);
    }
  }, [producer, refetch, onStatusChange]);

  const handleDeleteProducer = useCallback(async () => {
    if (!producer) return;
    setIsDeleting(true);
    try {
      await api.delete(`/org/producers/${producer.id}`);
      setShowDeleteConfirm(false);
      onClose();
      onDelete?.();
    } catch {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [producer, onClose, onDelete]);

  const handleFarmLinkSuccess = useCallback(() => {
    setFarmLinkModal({ isOpen: false });
    void refetch();
    onStatusChange();
  }, [refetch, onStatusChange]);

  const handleDeleteLink = useCallback(
    async (link: ProducerFarmLink) => {
      if (!producer) return;
      setDeletingLinkId(link.id);
      try {
        await api.delete(`/org/producers/${producer.id}/farms/${link.id}`);
        setConfirmDeleteLink(null);
        await refetch();
        onStatusChange();
      } catch {
        // Error will show on next refetch
      } finally {
        setDeletingLinkId(null);
      }
    },
    [producer, refetch, onStatusChange],
  );

  const handleIeSuccess = useCallback(() => {
    setIeModal({ isOpen: false });
    void refetch();
    onStatusChange();
  }, [refetch, onStatusChange]);

  const handleDeleteIe = useCallback(
    async (ie: ProducerStateRegistration) => {
      if (!producer) return;
      setDeletingIeId(ie.id);
      try {
        await api.delete(`/org/producers/${producer.id}/ies/${ie.id}`);
        setConfirmDeleteIe(null);
        await refetch();
        onStatusChange();
      } catch {
        // Error will show on next refetch
      } finally {
        setDeletingIeId(null);
      }
    },
    [producer, refetch, onStatusChange],
  );

  const handleSetDefaultIe = useCallback(
    async (ie: ProducerStateRegistration) => {
      if (!producer) return;
      try {
        await api.patch(`/org/producers/${producer.id}/ies/${ie.id}/default`, {});
        await refetch();
        onStatusChange();
      } catch {
        // Error will show on next refetch
      }
    },
    [producer, refetch, onStatusChange],
  );

  if (!producerId) return null;

  return (
    <div
      className="producer-detail__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="producer-detail-title"
    >
      <div className="producer-detail">
        <header className="producer-detail__header">
          <div className="producer-detail__header-info">
            <h2 id="producer-detail-title" className="producer-detail__title">
              {isLoading ? 'Carregando...' : (producer?.name ?? 'Produtor')}
            </h2>
            {producer && (
              <>
                <span className="producer-detail__badge producer-detail__badge--type">
                  {TYPE_LABELS[producer.type]}
                </span>
                <span
                  className={`producer-detail__badge producer-detail__badge--${producer.status.toLowerCase()}`}
                >
                  {producer.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            className="producer-detail__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {isLoading ? (
          <SkeletonBody />
        ) : error ? (
          <div className="producer-detail__body">
            <div className="producer-detail__error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {error}
            </div>
          </div>
        ) : producer ? (
          <div className="producer-detail__body">
            <GeneralSection producer={producer} />
            {producer.type === 'SOCIEDADE_EM_COMUM' && (
              <ParticipantsSection participants={producer.participants} />
            )}
            <IeSection
              registrations={producer.stateRegistrations}
              onAdd={() => setIeModal({ isOpen: true })}
              onEdit={(ie) => setIeModal({ isOpen: true, ie })}
              onDelete={(ie) => setConfirmDeleteIe(ie)}
              onSetDefault={(ie) => void handleSetDefaultIe(ie)}
            />
            <FarmLinksSection
              links={producer.farmLinks}
              onAdd={() => setFarmLinkModal({ isOpen: true })}
              onEdit={(link) => setFarmLinkModal({ isOpen: true, link })}
              onDelete={(link) => setConfirmDeleteLink(link)}
            />
          </div>
        ) : null}

        <footer className="producer-detail__footer">
          <PermissionGate permission="producers:update">
            {producer && onEdit && (
              <button
                type="button"
                className="producer-detail__btn producer-detail__btn--edit"
                onClick={() => onEdit(producer.id, producer.type)}
              >
                <Pencil size={16} aria-hidden="true" />
                Editar
              </button>
            )}
          </PermissionGate>
          <PermissionGate permission="producers:delete">
            {producer && (
              <button
                type="button"
                className="producer-detail__btn producer-detail__btn--deactivate"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Excluir
              </button>
            )}
          </PermissionGate>
          <PermissionGate permission="producers:update">
            {producer && (
              <button
                type="button"
                className={`producer-detail__btn producer-detail__btn--${producer.status === 'ACTIVE' ? 'deactivate' : 'activate'}`}
                onClick={() => void handleToggleStatus()}
                disabled={isTogglingStatus}
              >
                {isTogglingStatus ? <Loader2 size={16} aria-hidden="true" /> : null}
                {producer.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
              </button>
            )}
          </PermissionGate>
          <button
            type="button"
            className="producer-detail__btn producer-detail__btn--secondary"
            onClick={handleClose}
          >
            Fechar
          </button>
        </footer>
      </div>

      {producer && (
        <FarmLinkFormModal
          isOpen={farmLinkModal.isOpen}
          onClose={() => setFarmLinkModal({ isOpen: false })}
          onSuccess={handleFarmLinkSuccess}
          producerId={producer.id}
          existingLink={farmLinkModal.link}
        />
      )}

      {producer && (
        <IeFormModal
          isOpen={ieModal.isOpen}
          onClose={() => setIeModal({ isOpen: false })}
          onSuccess={handleIeSuccess}
          producerId={producer.id}
          existingIe={ieModal.ie}
        />
      )}

      {confirmDeleteIe && (
        <div
          className="producer-detail__overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDeleteIe(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-ie-title"
        >
          <div className="producer-detail producer-detail--confirm">
            <header className="producer-detail__header">
              <h2 id="confirm-delete-ie-title" className="producer-detail__title">
                Excluir inscrição estadual
              </h2>
              <button
                type="button"
                className="producer-detail__close"
                aria-label="Fechar"
                onClick={() => setConfirmDeleteIe(null)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="producer-detail__body">
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-neutral-700)',
                }}
              >
                Deseja excluir a inscrição estadual <strong>{confirmDeleteIe.number}</strong> (
                {confirmDeleteIe.state})?
              </p>
            </div>
            <footer className="producer-detail__footer">
              <button
                type="button"
                className="producer-detail__btn producer-detail__btn--secondary"
                onClick={() => setConfirmDeleteIe(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="producer-detail__btn producer-detail__btn--deactivate"
                onClick={() => void handleDeleteIe(confirmDeleteIe)}
                disabled={deletingIeId === confirmDeleteIe.id}
              >
                {deletingIeId === confirmDeleteIe.id ? (
                  <Loader2 size={16} aria-hidden="true" />
                ) : null}
                Excluir
              </button>
            </footer>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Excluir produtor"
        message={`Deseja excluir o produtor "${producer?.name ?? ''}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir produtor"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleDeleteProducer()}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {confirmDeleteLink && (
        <div
          className="producer-detail__overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDeleteLink(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-link-title"
        >
          <div className="producer-detail producer-detail--confirm">
            <header className="producer-detail__header">
              <h2 id="confirm-delete-link-title" className="producer-detail__title">
                Excluir vínculo
              </h2>
              <button
                type="button"
                className="producer-detail__close"
                aria-label="Fechar"
                onClick={() => setConfirmDeleteLink(null)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="producer-detail__body">
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-neutral-700)',
                }}
              >
                Deseja remover o vínculo com <strong>{confirmDeleteLink.farm.name}</strong>?
              </p>
            </div>
            <footer className="producer-detail__footer">
              <button
                type="button"
                className="producer-detail__btn producer-detail__btn--secondary"
                onClick={() => setConfirmDeleteLink(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="producer-detail__btn producer-detail__btn--deactivate"
                onClick={() => void handleDeleteLink(confirmDeleteLink)}
                disabled={deletingLinkId === confirmDeleteLink.id}
              >
                {deletingLinkId === confirmDeleteLink.id ? (
                  <Loader2 size={16} aria-hidden="true" />
                ) : null}
                Excluir
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProducerDetailModal;
