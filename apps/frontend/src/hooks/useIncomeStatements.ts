import { useState, useCallback } from 'react';

export interface IncomeStatement {
  id: string;
  employeeId: string;
  employeeName: string;
  cpf: string;
  year: number;
  totalIncome: string;
  totalDeductions: string;
  netIncome: string;
  irrf: string;
  status: string;
  fileKey: string | null;
  createdAt: string;
}

export interface RaisConsistencyReport {
  consistent: boolean;
  issues: Array<{ employeeId: string; employeeName: string; description: string }>;
}

interface UseIncomeStatementsResult {
  statements: IncomeStatement[];
  loading: boolean;
  error: string | null;
  generating: boolean;
  consistencyReport: RaisConsistencyReport | null;
  fetchStatements: (year?: number) => Promise<void>;
  generateStatements: (year: number) => Promise<void>;
  downloadStatement: (id: string) => Promise<void>;
  sendStatement: (id: string) => Promise<void>;
  checkConsistency: (year: number) => Promise<void>;
}

export function useIncomeStatements(): UseIncomeStatementsResult {
  const [statements, setStatements] = useState<IncomeStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [consistencyReport, setConsistencyReport] = useState<RaisConsistencyReport | null>(null);

  const fetchStatements = useCallback(async (year?: number) => {
    setLoading(true);
    setError(null);
    try {
      const query = year ? `?year=${year}` : '';
      const res = await fetch(`/api/income-statements${query}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar informes de rendimentos');
      const data = await res.json() as { data: IncomeStatement[] };
      setStatements(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateStatements = useCallback(async (year: number) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/income-statements/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ year }),
      });
      if (!res.ok) throw new Error('Erro ao gerar informes de rendimentos');
      await fetchStatements(year);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setGenerating(false);
    }
  }, [fetchStatements]);

  const downloadStatement = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/income-statements/${id}/pdf`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao baixar informe');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe-rendimentos-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, []);

  const sendStatement = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/income-statements/${id}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao enviar informe por email');
      await fetchStatements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, [fetchStatements]);

  const checkConsistency = useCallback(async (year: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/income-statements/rais-consistency?year=${year}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao verificar consistência RAIS');
      const data = await res.json() as RaisConsistencyReport;
      setConsistencyReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, []);

  return { statements, loading, error, generating, consistencyReport, fetchStatements, generateStatements, downloadStatement, sendStatement, checkConsistency };
}
