import { useState, useCallback } from 'react';
import { Plus, X, Wrench, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { EmployeeFunctionAssignment, EmployeeFunctionType } from '@/types/employee';
import { EMPLOYEE_FUNCTION_OPTIONS, EMPLOYEE_FUNCTION_LABELS } from '@/types/employee';
import './FunctionsTab.css';

interface Props {
  employeeId: string;
  orgId: string;
  functions: EmployeeFunctionAssignment[];
  onRefresh: () => void;
}

export default function FunctionsTab({ employeeId, orgId, functions, onRefresh }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignedFunctions = new Set(functions.map((f) => f.function));
  const availableFunctions = EMPLOYEE_FUNCTION_OPTIONS.filter(
    (opt) => !assignedFunctions.has(opt.value),
  );

  const handleAssign = useCallback(
    async (fn: EmployeeFunctionType) => {
      setSaving(true);
      setError(null);
      try {
        await api.post(`/org/${orgId}/employees/${employeeId}/functions`, {
          function: fn,
        });
        setIsAdding(false);
        onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atribuir função');
      } finally {
        setSaving(false);
      }
    },
    [employeeId, orgId, onRefresh],
  );

  const handleRemove = useCallback(
    async (fn: EmployeeFunctionType) => {
      setRemoving(fn);
      setError(null);
      try {
        await api.delete(`/org/${orgId}/employees/${employeeId}/functions/${fn}`);
        onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao remover função');
      } finally {
        setRemoving(null);
      }
    },
    [employeeId, orgId, onRefresh],
  );

  return (
    <section className="functions-tab" aria-label="Funções do colaborador">
      <header className="functions-tab__header">
        <div>
          <h2 className="functions-tab__title">Funções</h2>
          <p className="functions-tab__description">
            Funções e habilidades atribuídas a este colaborador.
          </p>
        </div>
        {availableFunctions.length > 0 && (
          <button
            type="button"
            className="functions-tab__btn-add"
            onClick={() => setIsAdding(!isAdding)}
            disabled={saving}
          >
            <Plus size={16} aria-hidden="true" />
            Adicionar função
          </button>
        )}
      </header>

      {error && (
        <div className="functions-tab__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {isAdding && (
        <div className="functions-tab__add-panel">
          <p className="functions-tab__add-label">Selecione uma função:</p>
          <div className="functions-tab__add-options">
            {availableFunctions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="functions-tab__add-option"
                onClick={() => void handleAssign(opt.value)}
                disabled={saving}
              >
                <Plus size={14} aria-hidden="true" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {functions.length === 0 ? (
        <div className="functions-tab__empty">
          <Wrench size={48} aria-hidden="true" color="var(--color-neutral-300)" />
          <p className="functions-tab__empty-title">Nenhuma função atribuída</p>
          <p className="functions-tab__empty-description">
            Atribua funções como Inseminador, Tratorista ou Veterinário a este colaborador.
          </p>
        </div>
      ) : (
        <ul className="functions-tab__list">
          {functions.map((fn) => (
            <li key={fn.id} className="functions-tab__chip">
              <span className="functions-tab__chip-label">
                {EMPLOYEE_FUNCTION_LABELS[fn.function] ?? fn.function}
              </span>
              <span className="functions-tab__chip-date">
                desde {new Date(fn.assignedAt).toLocaleDateString('pt-BR')}
              </span>
              <button
                type="button"
                className="functions-tab__chip-remove"
                onClick={() => void handleRemove(fn.function)}
                disabled={removing === fn.function}
                aria-label={`Remover função ${EMPLOYEE_FUNCTION_LABELS[fn.function]}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
