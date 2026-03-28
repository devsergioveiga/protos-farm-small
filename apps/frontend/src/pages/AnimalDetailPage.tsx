import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Camera, AlertCircle, ArrowLeft, Beef, LogOut, Pencil } from 'lucide-react';
import { useAnimalDetail } from '@/hooks/useAnimalDetail';
import { useFarmContext } from '@/stores/FarmContext';
import PermissionGate from '@/components/auth/PermissionGate';
import AnimalExitModal from '@/components/animal-exits/AnimalExitModal';
import CreateAnimalModal from '@/components/animals/CreateAnimalModal';
import WeighingTab from '@/components/animals/WeighingTab';
import SanitaryTab from '@/components/animals/SanitaryTab';
import ReproductiveTab from '@/components/animals/ReproductiveTab';
import MovementsTab from '@/components/animals/MovementsTab';
import { SEX_LABELS, CATEGORY_LABELS, ORIGIN_LABELS, GENEALOGY_CLASS_LABELS } from '@/types/animal';
import type { AnimalDetail, AnimalCategory, GenealogyClass } from '@/types/animal';
import './AnimalDetailPage.css';

type Tab = 'general' | 'sanitary' | 'reproductive' | 'weighing' | 'movements';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function AnimalDetailPage() {
  const { animalId } = useParams<{ animalId: string }>();
  const { selectedFarm } = useFarmContext();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [showExitModal, setShowExitModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { animal, isLoading, error, refetch } = useAnimalDetail(
    selectedFarm?.id ?? null,
    animalId ?? null,
  );

  if (!selectedFarm) {
    return (
      <main className="animal-detail">
        <div className="animal-detail__empty">
          <Beef size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="animal-detail__empty-title">Selecione uma fazenda</h2>
          <p className="animal-detail__empty-desc">
            Escolha uma fazenda no seletor acima para visualizar o animal.
          </p>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="animal-detail" aria-live="polite">
        <div className="animal-detail__skeleton-header">
          <div
            className="animal-detail__skeleton animal-detail__skeleton--circle"
            style={{ width: 80, height: 80 }}
          />
          <div style={{ flex: 1 }}>
            <div
              className="animal-detail__skeleton"
              style={{ width: '240px', height: 28, marginBottom: 8 }}
            />
            <div className="animal-detail__skeleton" style={{ width: '160px', height: 20 }} />
          </div>
        </div>
        <div
          className="animal-detail__skeleton"
          style={{ width: '100%', height: 48, marginBottom: 24 }}
        />
        <div className="animal-detail__skeleton-sections">
          <div className="animal-detail__skeleton" style={{ height: 200 }} />
          <div className="animal-detail__skeleton" style={{ height: 200 }} />
          <div className="animal-detail__skeleton" style={{ height: 160 }} />
          <div className="animal-detail__skeleton" style={{ height: 160 }} />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="animal-detail">
        <div className="animal-detail__error" role="alert" aria-live="polite">
          <div className="animal-detail__error-message">
            <AlertCircle aria-hidden="true" size={20} />
            {error}
          </div>
          <button type="button" className="animal-detail__retry-btn" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  if (!animal) {
    return (
      <main className="animal-detail">
        <div className="animal-detail__empty">
          <Beef size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="animal-detail__empty-title">Animal não encontrado</h2>
          <p className="animal-detail__empty-desc">
            O animal solicitado não existe ou foi removido.
          </p>
          <Link
            to="/animals"
            className="animal-detail__retry-btn"
            style={{ textDecoration: 'none' }}
          >
            Voltar para animais
          </Link>
        </div>
      </main>
    );
  }

  const tabs: Array<{ id: Tab; label: string; disabled: boolean }> = [
    { id: 'general', label: 'Dados Gerais', disabled: false },
    { id: 'sanitary', label: 'Sanitário', disabled: false },
    { id: 'reproductive', label: 'Reprodutivo', disabled: false },
    { id: 'weighing', label: 'Pesagens', disabled: false },
    { id: 'movements', label: 'Movimentações', disabled: false },
  ];

  return (
    <main className="animal-detail">
      <nav className="animal-detail__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Início</Link>
        <span className="animal-detail__breadcrumb-sep" aria-hidden="true">
          &gt;
        </span>
        <Link to="/animals">Animais</Link>
        <span className="animal-detail__breadcrumb-sep" aria-hidden="true">
          &gt;
        </span>
        <span aria-current="page">{animal.earTag}</span>
      </nav>

      <Link to="/animals" className="animal-detail__back-link">
        <ArrowLeft aria-hidden="true" size={20} />
        Voltar
      </Link>

      <header className="animal-detail__header">
        {animal.photoUrl ? (
          <img
            src={animal.photoUrl}
            alt={`Foto de ${animal.earTag}`}
            className="animal-detail__photo"
          />
        ) : (
          <div className="animal-detail__photo-placeholder" aria-hidden="true">
            <Camera size={32} color="var(--color-neutral-400)" />
          </div>
        )}
        <div className="animal-detail__header-info">
          <h1 className="animal-detail__title">
            {animal.earTag}
            {animal.name ? ` — ${animal.name}` : ''}
          </h1>
          <div className="animal-detail__badges">
            <span
              className={`animal-detail__badge animal-detail__badge--sex-${animal.sex.toLowerCase()}`}
            >
              {SEX_LABELS[animal.sex]}
            </span>
            <span className="animal-detail__badge animal-detail__badge--category">
              {CATEGORY_LABELS[animal.category as AnimalCategory]}
            </span>
            <span className="animal-detail__badge animal-detail__badge--origin">
              {ORIGIN_LABELS[animal.origin]}
            </span>
          </div>
        </div>
        <div className="animal-detail__header-actions">
          <PermissionGate permission="animals:update">
            <button
              type="button"
              className="animal-detail__edit-btn"
              onClick={() => setShowEditModal(true)}
            >
              <Pencil aria-hidden="true" size={18} />
              Editar
            </button>
          </PermissionGate>
          <PermissionGate permission="animals:delete">
            <button
              type="button"
              className="animal-detail__exit-btn"
              onClick={() => setShowExitModal(true)}
            >
              <LogOut aria-hidden="true" size={18} />
              Registrar saída
            </button>
          </PermissionGate>
        </div>
      </header>

      <div className="animal-detail__tabs" role="tablist" aria-label="Seções do animal">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`animal-detail__tab${activeTab === tab.id ? ' animal-detail__tab--active' : ''}`}
            disabled={tab.disabled}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.disabled && <span className="animal-detail__tab-hint">(Em breve)</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'general' ? (
          <GeneralTab animal={animal} />
        ) : activeTab === 'weighing' ? (
          <WeighingTab farmId={selectedFarm.id} animalId={animal.id} animalEarTag={animal.earTag} />
        ) : activeTab === 'sanitary' ? (
          <SanitaryTab farmId={selectedFarm.id} animalId={animal.id} animalEarTag={animal.earTag} />
        ) : activeTab === 'reproductive' ? (
          <ReproductiveTab
            farmId={selectedFarm.id}
            animalId={animal.id}
            animalEarTag={animal.earTag}
          />
        ) : activeTab === 'movements' ? (
          <MovementsTab farmId={selectedFarm.id} animalId={animal.id} />
        ) : null}
      </div>

      <CreateAnimalModal
        isOpen={showEditModal}
        farmId={selectedFarm.id}
        animal={animal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          setShowEditModal(false);
          void refetch();
        }}
      />

      <AnimalExitModal
        isOpen={showExitModal}
        farmId={selectedFarm.id}
        animalId={animal.id}
        onClose={() => setShowExitModal(false)}
        onSuccess={() => {
          setShowExitModal(false);
          void refetch();
        }}
      />
    </main>
  );
}

function GeneralTab({ animal }: { animal: AnimalDetail }) {
  return (
    <div className="animal-detail__sections">
      {/* Identificação */}
      <section className="animal-detail__section" aria-labelledby="section-identification">
        <h2 className="animal-detail__section-title" id="section-identification">
          Identificação
        </h2>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">Brinco</span>
          <span className="animal-detail__field-value animal-detail__field-value--mono">
            {animal.earTag}
          </span>
        </div>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">RFID</span>
          <span className="animal-detail__field-value animal-detail__field-value--mono">
            {animal.rfidTag ?? '—'}
          </span>
        </div>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">Nome</span>
          <span className="animal-detail__field-value">{animal.name ?? '—'}</span>
        </div>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">Lote atual</span>
          <span className="animal-detail__field-value">{animal.lotName ?? '—'}</span>
        </div>
      </section>

      {/* Características */}
      <section className="animal-detail__section" aria-labelledby="section-characteristics">
        <h2 className="animal-detail__section-title" id="section-characteristics">
          Características
        </h2>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">Sexo</span>
          <span className="animal-detail__field-value">{SEX_LABELS[animal.sex]}</span>
        </div>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">Categoria</span>
          <span className="animal-detail__field-value">
            {CATEGORY_LABELS[animal.category as AnimalCategory]}
            {animal.categorySuggested && animal.categorySuggested !== animal.category && (
              <span className="animal-detail__category-suggested">
                {' '}
                (sugerida: {CATEGORY_LABELS[animal.categorySuggested as AnimalCategory]})
              </span>
            )}
          </span>
        </div>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">Origem</span>
          <span className="animal-detail__field-value">{ORIGIN_LABELS[animal.origin]}</span>
        </div>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">Nascimento</span>
          <span className="animal-detail__field-value">
            {formatDate(animal.birthDate)}
            {animal.birthDateEstimated && animal.birthDate && (
              <span className="animal-detail__field-value--hint">(estimada)</span>
            )}
          </span>
        </div>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">Peso entrada</span>
          <span className="animal-detail__field-value">
            {animal.entryWeightKg != null ? `${animal.entryWeightKg} kg` : '—'}
          </span>
        </div>
        <div className="animal-detail__field">
          <span className="animal-detail__field-label">Escore corporal</span>
          <span className="animal-detail__field-value">
            {animal.bodyConditionScore != null ? `${animal.bodyConditionScore}/5` : '—'}
          </span>
        </div>
      </section>

      {/* Composição Racial */}
      <section className="animal-detail__section" aria-labelledby="section-breed">
        <h2 className="animal-detail__section-title" id="section-breed">
          Composição Racial
        </h2>
        {animal.breedSummary && (
          <p className="animal-detail__field-value" style={{ marginBottom: 12 }}>
            {animal.breedSummary}
          </p>
        )}
        {animal.compositions.length > 0 ? (
          <>
            <table className="animal-detail__mini-table">
              <thead>
                <tr>
                  <th scope="col">Raça</th>
                  <th scope="col">Percentual</th>
                  <th scope="col">Fração</th>
                </tr>
              </thead>
              <tbody>
                {animal.compositions.map((comp) => (
                  <tr key={comp.id}>
                    <td>{comp.breed.name}</td>
                    <td>{comp.percentage}%</td>
                    <td>{comp.fraction ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {animal.isCompositionEstimated && (
              <p className="animal-detail__breed-estimated">Composição estimada</p>
            )}
          </>
        ) : (
          <p className="animal-detail__empty-text">Sem informações de composição racial</p>
        )}
      </section>

      {/* Genealogia */}
      <section className="animal-detail__section" aria-labelledby="section-genealogy">
        <h2 className="animal-detail__section-title" id="section-genealogy">
          Genealogia
        </h2>
        {!animal.sire && !animal.dam && animal.offspring.length === 0 ? (
          <p className="animal-detail__empty-text">Sem informações de genealogia</p>
        ) : (
          <>
            <div className="animal-detail__field">
              <span className="animal-detail__field-label">Pai</span>
              <span className="animal-detail__field-value">
                {animal.sire ? (
                  <Link to={`/animals/${animal.sire.id}`} className="animal-detail__parent-link">
                    <span className="animal-detail__field-value--mono">{animal.sire.earTag}</span>
                    {animal.sire.name && ` — ${animal.sire.name}`}
                  </Link>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="animal-detail__field">
              <span className="animal-detail__field-label">Mãe</span>
              <span className="animal-detail__field-value">
                {animal.dam ? (
                  <Link to={`/animals/${animal.dam.id}`} className="animal-detail__parent-link">
                    <span className="animal-detail__field-value--mono">{animal.dam.earTag}</span>
                    {animal.dam.name && ` — ${animal.dam.name}`}
                  </Link>
                ) : (
                  '—'
                )}
              </span>
            </div>
            {animal.offspring.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <span
                  className="animal-detail__field-label"
                  style={{ display: 'block', marginBottom: 8 }}
                >
                  Filhos ({animal.offspring.length})
                </span>
                <ul className="animal-detail__offspring-list">
                  {animal.offspring.map((child) => (
                    <li key={child.id} className="animal-detail__offspring-item">
                      <Link to={`/animals/${child.id}`} className="animal-detail__offspring-link">
                        <span className="animal-detail__field-value--mono">{child.earTag}</span>
                        {child.name && ` — ${child.name}`}
                      </Link>
                      <span
                        className={`animal-detail__badge animal-detail__badge--sex-${child.sex.toLowerCase()}`}
                      >
                        {SEX_LABELS[child.sex]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* Registros Genealógicos */}
      <section
        className="animal-detail__section animal-detail__section--full"
        aria-labelledby="section-records"
      >
        <h2 className="animal-detail__section-title" id="section-records">
          Registros Genealógicos
        </h2>
        {animal.genealogicalRecords.length > 0 ? (
          <table className="animal-detail__mini-table">
            <thead>
              <tr>
                <th scope="col">Classe</th>
                <th scope="col">Nº Registro</th>
                <th scope="col">Associação</th>
                <th scope="col">Data</th>
                <th scope="col">Grau Girolando</th>
              </tr>
            </thead>
            <tbody>
              {animal.genealogicalRecords.map((rec) => (
                <tr key={rec.id}>
                  <td>
                    {GENEALOGY_CLASS_LABELS[rec.genealogyClass as GenealogyClass] ??
                      rec.genealogyClass}
                  </td>
                  <td className="animal-detail__field-value--mono">
                    {rec.registrationNumber ?? '—'}
                  </td>
                  <td>{rec.associationName ?? '—'}</td>
                  <td>{formatDate(rec.registrationDate ?? null)}</td>
                  <td>{rec.girolando_grade ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="animal-detail__empty-text">Nenhum registro genealógico</p>
        )}
      </section>

      {/* Observações */}
      <section
        className="animal-detail__section animal-detail__section--full"
        aria-labelledby="section-notes"
      >
        <h2 className="animal-detail__section-title" id="section-notes">
          Observações
        </h2>
        {animal.notes ? (
          <p className="animal-detail__notes">{animal.notes}</p>
        ) : (
          <p className="animal-detail__empty-text">Sem observações</p>
        )}
      </section>
    </div>
  );
}

export default AnimalDetailPage;
