import { CheckCircle, Circle } from 'lucide-react';
import './PasswordStrengthIndicator.css';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}

const rules: Rule[] = [
  { label: 'Mínimo 8 caracteres', test: (pw) => pw.length >= 8 },
  { label: 'Pelo menos 1 letra maiúscula', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Pelo menos 1 número', test: (pw) => /[0-9]/.test(pw) },
  { label: 'Pelo menos 1 caractere especial', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function isPasswordValid(password: string): boolean {
  return rules.every((rule) => rule.test(password));
}

function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const passed = rules.filter((rule) => rule.test(password)).length;

  const getStrengthClass = (): string => {
    if (passed === 0) return '';
    if (passed <= 2) return 'strength-weak';
    if (passed === 3) return 'strength-fair';
    return 'strength-strong';
  };

  const getStrengthLabel = (): string => {
    if (passed === 0) return '';
    if (passed <= 2) return 'Fraca';
    if (passed === 3) return 'Razoável';
    return 'Forte';
  };

  return (
    <div className="password-strength" aria-label="Indicador de força da senha">
      <div className="strength-bar-track">
        <div
          className={`strength-bar-fill ${getStrengthClass()}`}
          style={{ width: `${(passed / 4) * 100}%` }}
          role="progressbar"
          aria-valuenow={passed}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-label={`Força da senha: ${passed} de 4 critérios — ${getStrengthLabel()}`}
        />
      </div>
      {getStrengthLabel() && (
        <span className={`strength-label ${getStrengthClass()}`}>{getStrengthLabel()}</span>
      )}
      <ul className="strength-rules">
        {rules.map((rule) => {
          const met = rule.test(password);
          return (
            <li key={rule.label} className={met ? 'rule-met' : 'rule-unmet'}>
              {met ? (
                <CheckCircle size={16} aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PasswordStrengthIndicator;
