import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SpedValidationResult } from '@/types/sped-ecd';
import './ValidationPanel.css';

interface ValidationPanelProps {
  result: SpedValidationResult | null;
  loading: boolean;
}

function getLinkText(code: string): string {
  if (code === 'UNMAPPED_SPED') return 'Corrigir no Plano de Contas';
  if (code === 'OPEN_PERIODS') return 'Ir para Fechamento Mensal';
  return 'Ver detalhe';
}

export default function ValidationPanel({ result, loading }: ValidationPanelProps) {
  const errorCount = result?.items.filter((i) => i.severity === 'ERROR').length ?? 0;
  const warningCount = result?.items.filter((i) => i.severity === 'WARNING').length ?? 0;
  const hasIssues = errorCount + warningCount > 0;

  return (
    <section className="validation-panel" role="alert" aria-live="polite">
      <h2 className="validation-panel__heading">Pre-validacao SPED</h2>

      {loading && (
        <ul className="validation-panel__skeleton-list" aria-label="Carregando validacoes...">
          {[0, 1, 2].map((i) => (
            <li key={i} className="validation-panel__skeleton" aria-hidden="true" />
          ))}
        </ul>
      )}

      {!loading && result && !hasIssues && (
        <div className="validation-panel__row validation-panel__row--success">
          <CheckCircle
            size={20}
            className="validation-panel__icon validation-panel__icon--success"
            aria-hidden="true"
          />
          <span>Pronto para geracao. Nenhum problema encontrado.</span>
        </div>
      )}

      {!loading && result && hasIssues && (
        <>
          <p className="validation-panel__summary">
            {errorCount} erro(s) &bull; {warningCount} aviso(s) &mdash; corrija os erros para
            habilitar a geracao
          </p>
          <ul className="validation-panel__list">
            {result.items.map((item, idx) => (
              <li
                key={idx}
                className={`validation-panel__row ${
                  item.severity === 'ERROR'
                    ? 'validation-panel__row--error'
                    : 'validation-panel__row--warning'
                }`}
              >
                {item.severity === 'ERROR' ? (
                  <XCircle
                    size={16}
                    className="validation-panel__icon validation-panel__icon--error"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    size={16}
                    className="validation-panel__icon validation-panel__icon--warning"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`validation-panel__badge ${
                    item.severity === 'ERROR'
                      ? 'validation-panel__badge--error'
                      : 'validation-panel__badge--warning'
                  }`}
                >
                  {item.severity === 'ERROR' ? 'ERRO' : 'AVISO'}
                </span>
                <span className="validation-panel__message">{item.message}</span>
                {item.navigateTo && (
                  <Link to={item.navigateTo} className="validation-panel__link">
                    {getLinkText(item.code)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
