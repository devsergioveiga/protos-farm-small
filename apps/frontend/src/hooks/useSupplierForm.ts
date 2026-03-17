import { useState } from 'react';
import { api } from '../services/api';
import type { CreateSupplierInput, Supplier } from '../types/supplier';

interface UseSupplierFormResult {
  createSupplier: (input: CreateSupplierInput) => Promise<void>;
  updateSupplier: (id: string, input: Partial<CreateSupplierInput>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  duplicateId: string | null;
}

export function useSupplierForm(onSuccess: () => void): UseSupplierFormResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  async function createSupplier(input: CreateSupplierInput): Promise<void> {
    setIsSubmitting(true);
    setError(null);
    setDuplicateId(null);
    try {
      await api.post<Supplier>('/org/suppliers', input);
      onSuccess();
    } catch (err) {
      const apiErr = err as Error & { status?: number; details?: string[] };
      if (apiErr.status === 409) {
        // Try to extract existing supplier id from error details
        const idMatch = apiErr.details?.find((d) => d.startsWith('id:'));
        setDuplicateId(idMatch ? idMatch.replace('id:', '') : null);
        setError('Este CNPJ/CPF ja esta cadastrado.');
      } else {
        setError(apiErr.message || 'Nao foi possivel salvar. Verifique sua conexao.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateSupplier(id: string, input: Partial<CreateSupplierInput>): Promise<void> {
    setIsSubmitting(true);
    setError(null);
    setDuplicateId(null);
    try {
      await api.patch<Supplier>(`/org/suppliers/${id}`, input);
      onSuccess();
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      setError(apiErr.message || 'Nao foi possivel salvar. Verifique sua conexao.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteSupplier(id: string): Promise<void> {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.delete(`/org/suppliers/${id}`);
      onSuccess();
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      setError(apiErr.message || 'Nao foi possivel excluir o fornecedor.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return { createSupplier, updateSupplier, deleteSupplier, isSubmitting, error, duplicateId };
}
