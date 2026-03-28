import { useState } from 'react';
import { UserPlus, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Employee } from '@/types/employee';

interface PersonalDataTabProps {
  employee: Employee;
  onAddDependent?: () => void;
  onAddFarm?: () => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="employee-detail__field">
      <dt className="employee-detail__field-label">{label}</dt>
      <dd className="employee-detail__field-value">{value ?? '—'}</dd>
    </div>
  );
}

function MonoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="employee-detail__field">
      <dt className="employee-detail__field-label">{label}</dt>
      <dd className="employee-detail__field-value employee-detail__field-value--mono">
        {value ?? '—'}
      </dd>
    </div>
  );
}

export default function PersonalDataTab({
  employee,
  onAddDependent,
  onAddFarm,
}: PersonalDataTabProps) {
  const [dependentsOpen, setDependentsOpen] = useState(true);
  const [farmsOpen, setFarmsOpen] = useState(true);

  const dependents = employee.dependents ?? [];
  const farms = employee.farms ?? [];

  return (
    <div className="employee-detail__tab-content">
      {/* Personal Documents */}
      <section className="employee-detail__section">
        <h3 className="employee-detail__section-title">Documentos</h3>
        <dl className="employee-detail__grid">
          <MonoField label="CPF" value={employee.cpf} />
          <MonoField label="RG" value={employee.rg} />
          {employee.rgIssuer && <Field label="Órgão emissor" value={employee.rgIssuer} />}
          {employee.rgUf && <Field label="UF RG" value={employee.rgUf} />}
          <MonoField label="PIS/PASEP" value={employee.pisPassep} />
          <Field label="CTPS" value={employee.ctpsNumber} />
          <Field label="Série CTPS" value={employee.ctpsSeries} />
        </dl>
      </section>

      {/* Personal Info */}
      <section className="employee-detail__section">
        <h3 className="employee-detail__section-title">Dados Pessoais</h3>
        <dl className="employee-detail__grid">
          <Field label="Data de nascimento" value={formatDate(employee.birthDate)} />
          <Field label="Nationalidade" value={employee.nationality} />
          <Field label="Estado civil" value={employee.maritalStatus} />
          <Field label="Escolaridade" value={employee.educationLevel} />
          <Field label="Tipo sanguíneo" value={employee.bloodType} />
          <Field label="Nome da mãe" value={employee.motherName} />
          <Field label="Nome do pai" value={employee.fatherName} />
          <Field
            label="Deficiência"
            value={employee.hasDisability ? (employee.disabilityType ?? 'Sim') : 'Não'}
          />
        </dl>
      </section>

      {/* Contact */}
      <section className="employee-detail__section">
        <h3 className="employee-detail__section-title">Contato</h3>
        <dl className="employee-detail__grid">
          <Field label="Telefone" value={employee.phone} />
          <Field label="E-mail" value={employee.email} />
        </dl>
      </section>

      {/* Address */}
      <section className="employee-detail__section">
        <h3 className="employee-detail__section-title">Endereço</h3>
        <dl className="employee-detail__grid">
          <Field label="CEP" value={employee.zipCode} />
          <Field label="Logradouro" value={employee.street} />
          <Field label="Número" value={employee.number} />
          <Field label="Complemento" value={employee.complement} />
          <Field label="Bairro" value={employee.neighborhood} />
          <Field label="Cidade" value={employee.city} />
          <Field label="Estado" value={employee.state} />
        </dl>
      </section>

      {/* Bank Data */}
      <section className="employee-detail__section">
        <h3 className="employee-detail__section-title">Dados Bancários</h3>
        <dl className="employee-detail__grid">
          <Field label="Banco" value={employee.bankCode} />
          <Field label="Agência" value={employee.bankAgency} />
          <MonoField label="Conta" value={employee.bankAccount} />
          <Field
            label="Tipo de conta"
            value={
              employee.bankAccountType === 'CORRENTE'
                ? 'Conta Corrente'
                : employee.bankAccountType === 'POUPANCA'
                  ? 'Poupança'
                  : undefined
            }
          />
        </dl>
      </section>

      {/* Dependents */}
      <section className="employee-detail__section">
        <div className="employee-detail__section-header">
          <h3 className="employee-detail__section-title">
            Dependentes <span className="employee-detail__count">({dependents.length})</span>
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="employee-detail__btn-secondary"
              onClick={onAddDependent}
              aria-label="Adicionar dependente"
            >
              <UserPlus size={16} aria-hidden="true" />
              Adicionar dependente
            </button>
            <button
              type="button"
              className="employee-detail__btn-icon"
              onClick={() => setDependentsOpen((v) => !v)}
              aria-expanded={dependentsOpen}
              aria-label={dependentsOpen ? 'Recolher dependentes' : 'Expandir dependentes'}
            >
              {dependentsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {dependentsOpen && (
          <>
            {dependents.length === 0 ? (
              <p className="employee-detail__empty-inline">Nenhum dependente cadastrado.</p>
            ) : (
              <ul className="employee-detail__dependents-list">
                {dependents.map((dep) => (
                  <li key={dep.id} className="employee-detail__dependent-item">
                    <div className="employee-detail__dependent-name">{dep.name}</div>
                    <div className="employee-detail__dependent-meta">
                      <span>{dep.relationship}</span>
                      {dep.cpf && <span className="employee-detail__mono">{dep.cpf}</span>}
                      <span>{formatDate(dep.birthDate)}</span>
                      {dep.irrf && <span className="employee-detail__badge">IRRF</span>}
                      {dep.salaryFamily && (
                        <span className="employee-detail__badge">Sal. Família</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Farm Associations */}
      <section className="employee-detail__section">
        <div className="employee-detail__section-header">
          <h3 className="employee-detail__section-title">
            Fazendas <span className="employee-detail__count">({farms.length})</span>
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="employee-detail__btn-secondary"
              onClick={onAddFarm}
              aria-label="Associar fazenda"
            >
              <Building2 size={16} aria-hidden="true" />
              Associar fazenda
            </button>
            <button
              type="button"
              className="employee-detail__btn-icon"
              onClick={() => setFarmsOpen((v) => !v)}
              aria-expanded={farmsOpen}
              aria-label={farmsOpen ? 'Recolher fazendas' : 'Expandir fazendas'}
            >
              {farmsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {farmsOpen && (
          <>
            {farms.length === 0 ? (
              <p className="employee-detail__empty-inline">Nenhuma fazenda associada.</p>
            ) : (
              <ul className="employee-detail__dependents-list">
                {farms.map((farm) => (
                  <li key={farm.id} className="employee-detail__dependent-item">
                    <div className="employee-detail__dependent-name">
                      {farm.farm?.name ?? farm.farmId}
                    </div>
                    <div className="employee-detail__dependent-meta">
                      {farm.position && <span>{farm.position.name}</span>}
                      <span>Desde {formatDate(farm.startDate)}</span>
                      {farm.endDate && <span>Até {formatDate(farm.endDate)}</span>}
                      <span
                        className={`employee-detail__badge ${farm.status === 'ATIVO' ? 'employee-detail__badge--green' : ''}`}
                      >
                        {farm.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
