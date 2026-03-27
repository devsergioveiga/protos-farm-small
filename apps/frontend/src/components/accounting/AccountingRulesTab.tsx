import { useState, useCallback } from 'react';
import { useAccountingRules, useAccountingRuleActions } from '@/hooks/useAccountingRules';
import { SOURCE_TYPE_LABELS } from '@/types/auto-posting';
import type { AccountingRule } from '@/types/auto-posting';
import AccountingRuleModal from './AccountingRuleModal';
import './AccountingRulesTab.css';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="art__td">
              <div className="art__skeleton-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, label, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`art__toggle${checked ? ' art__toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="art__toggle-thumb" />
    </button>
  );
}

// ─── Rule Row ─────────────────────────────────────────────────────────────────

interface RuleRowProps {
  rule: AccountingRule;
  onEdit: (rule: AccountingRule) => void;
  onToggle: (ruleId: string, isActive: boolean) => void;
  togglingId: string | null;
}

function RuleRow({ rule, onEdit, onToggle, togglingId }: RuleRowProps) {
  const firstDebit = rule.lines.find((l) => l.side === 'DEBIT');
  const firstCredit = rule.lines.find((l) => l.side === 'CREDIT');
  const isToggling = togglingId === rule.id;

  return (
    <tr className="art__row">
      <td className="art__td">{SOURCE_TYPE_LABELS[rule.sourceType]}</td>
      <td className="art__td art__td--mono">
        {firstDebit ? `${firstDebit.accountCode} — ${firstDebit.accountName}` : '—'}
      </td>
      <td className="art__td art__td--mono">
        {firstCredit ? `${firstCredit.accountCode} — ${firstCredit.accountName}` : '—'}
      </td>
      <td className="art__td art__td--center" title="Centro de Custo Obrigatório">
        {rule.requireCostCenter ? 'Sim' : '—'}
      </td>
      <td className="art__td">
        <div className="art__status-cell">
          <ToggleSwitch
            checked={rule.isActive}
            onChange={(val) => onToggle(rule.id, val)}
            label={rule.isActive ? 'Desativar regra' : 'Ativar regra'}
            disabled={isToggling}
          />
          <span className={`art__status-badge${rule.isActive ? ' art__status-badge--active' : ' art__status-badge--inactive'}`}>
            {rule.isActive ? 'ATIVA' : 'INATIVA'}
          </span>
        </div>
      </td>
      <td className="art__td art__td--actions">
        <button
          type="button"
          className="art__btn art__btn--text"
          onClick={() => onEdit(rule)}
        >
          Editar
        </button>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AccountingRulesTab() {
  const { rules, isLoading, error, refetch } = useAccountingRules();
  const { updateRule } = useAccountingRuleActions();
  const [editingRule, setEditingRule] = useState<AccountingRule | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const handleToggle = useCallback(
    async (ruleId: string, isActive: boolean) => {
      setTogglingId(ruleId);
      try {
        await updateRule(ruleId, { isActive });
        if (isActive) {
          showToast('Regra ativada. Próximas operações gerarão lançamentos automáticos.');
        } else {
          showToast('Regra desativada. Operações futuras não gerarão lançamentos automáticos.');
        }
        void refetch();
      } catch {
        showToast('Não foi possível alterar o status da regra. Tente novamente.');
      } finally {
        setTogglingId(null);
      }
    },
    [updateRule, refetch],
  );

  return (
    <section className="art" aria-label="Regras de lançamento automático">

      {error && (
        <div className="art__error-banner" role="alert">
          {error}
        </div>
      )}

      <div className="art__table-wrapper">
        <table className="art__table">
          <caption className="sr-only">Regras de lançamento automático por tipo de operação</caption>
          <thead>
            <tr>
              <th scope="col" className="art__th">TIPO DE OPERAÇÃO</th>
              <th scope="col" className="art__th">CONTA DÉBITO</th>
              <th scope="col" className="art__th">CONTA CRÉDITO</th>
              <th scope="col" className="art__th art__th--center" title="Centro de Custo Obrigatório">CC</th>
              <th scope="col" className="art__th">STATUS</th>
              <th scope="col" className="art__th art__th--actions">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton />}
            {!isLoading &&
              rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onEdit={setEditingRule}
                  onToggle={handleToggle}
                  togglingId={togglingId}
                />
              ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editingRule && (
        <AccountingRuleModal
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSaved={() => {
            setEditingRule(null);
            void refetch();
            showToast('Regra atualizada com sucesso.');
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="art__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </section>
  );
}
