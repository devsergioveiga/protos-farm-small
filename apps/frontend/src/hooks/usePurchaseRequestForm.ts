import { useState } from 'react';
import { api } from '../services/api';
import type { PurchaseRequest, CreatePurchaseRequestInput } from '../types/purchase-request';

interface TransitionInput {
  action: string;
  comment?: string;
}

interface UsePurchaseRequestFormResult {
  create: (input: CreatePurchaseRequestInput) => Promise<PurchaseRequest>;
  update: (id: string, input: Partial<CreatePurchaseRequestInput>) => Promise<PurchaseRequest>;
  remove: (id: string) => Promise<void>;
  submit: (id: string) => Promise<void>;
  transition: (id: string, input: TransitionInput) => Promise<void>;
  uploadAttachment: (id: string, file: File) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function usePurchaseRequestForm(onSuccess: () => void): UsePurchaseRequestFormResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(input: CreatePurchaseRequestInput): Promise<PurchaseRequest> {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.post<PurchaseRequest>('/org/purchase-requests', input);
      onSuccess();
      return result;
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      const msg =
        apiErr.message ||
        'Nao foi possivel salvar a requisicao. Verifique sua conexao e tente novamente.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function update(
    id: string,
    input: Partial<CreatePurchaseRequestInput>,
  ): Promise<PurchaseRequest> {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.put<PurchaseRequest>(`/org/purchase-requests/${id}`, input);
      onSuccess();
      return result;
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      const msg =
        apiErr.message ||
        'Nao foi possivel salvar a requisicao. Verifique sua conexao e tente novamente.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      await api.delete(`/org/purchase-requests/${id}`);
      onSuccess();
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      const msg = apiErr.message || 'Nao foi possivel excluir a requisicao.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function submit(id: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      await api.post<unknown>(`/org/purchase-requests/${id}/transition`, { action: 'SUBMIT' });
      onSuccess();
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      const msg = apiErr.message || 'Nao foi possivel enviar para aprovacao. Tente novamente.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function transition(id: string, input: TransitionInput): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      await api.post<unknown>(`/org/purchase-requests/${id}/transition`, input);
      onSuccess();
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      const msg = apiErr.message || 'Nao foi possivel registrar a decisao. Tente novamente.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadAttachment(id: string, file: File): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post<unknown>(`/org/purchase-requests/${id}/attachments`, formData);
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      const msg = apiErr.message || 'Nao foi possivel enviar o anexo.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return { create, update, remove, submit, transition, uploadAttachment, isLoading, error };
}
