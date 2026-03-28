import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  IncomeStatement,
  RaisConsistency,
  GenerateIncomeStatementsInput,
} from '@/types/income-statement';

interface SendInput {
  yearBase: number;
  employeeIds?: string[];
}

interface SendResult {
  sent: number;
  skipped: number;
  errors: string[];
}

export function useIncomeStatements() {
  const { user } = useAuth();
  const [statements, setStatements] = useState<IncomeStatement[]>([]);
  const [raisConsistency, setRaisConsistency] = useState<RaisConsistency | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const fetchStatements = useCallback(
    async (yearBase?: number) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (yearBase) qs.set('yearBase', String(yearBase));
        const query = qs.toString();
        const path = `/org/${orgId}/income-statements${query ? `?${query}` : ''}`;
        const result = await api.get<
          { data: IncomeStatement[]; total: number } | IncomeStatement[]
        >(path);
        const items = Array.isArray(result) ? result : (result as { data: IncomeStatement[] }).data;
        setStatements(items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao carregar informes de rendimentos';
        setError(message);
        setStatements([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const generateStatements = useCallback(
    async (input: GenerateIncomeStatementsInput): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/income-statements/generate`, input);
        setSuccessMessage('Informes gerados com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao gerar informes';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const downloadStatement = useCallback(
    async (id: string, employeeName: string, yearBase: number): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(`/org/${orgId}/income-statements/${id}/download`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = employeeName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        a.download = `informe-rendimentos-${safeName}-${yearBase}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao baixar informe';
        setError(message);
      }
    },
    [orgId],
  );

  const sendStatements = useCallback(
    async (input: SendInput): Promise<SendResult | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<SendResult>(`/org/${orgId}/income-statements/send`, input);
        setSuccessMessage(
          `Informes enviados: ${result.sent} enviados, ${result.skipped} sem email`,
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao enviar informes';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const fetchRaisConsistency = useCallback(
    async (yearBase: number): Promise<void> => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await api.get<RaisConsistency>(
          `/org/${orgId}/income-statements/rais-consistency?yearBase=${yearBase}`,
        );
        setRaisConsistency(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao verificar consistencia RAIS';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  return {
    statements,
    raisConsistency,
    loading,
    error,
    successMessage,
    fetchStatements,
    generateStatements,
    downloadStatement,
    sendStatements,
    fetchRaisConsistency,
  };
}
