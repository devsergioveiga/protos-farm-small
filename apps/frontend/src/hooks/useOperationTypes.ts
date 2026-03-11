import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { OperationTypeTreeNode, OperationTypeItem } from '@/types/operation-type';

export function useOperationTypeTree(options: { includeInactive?: boolean; crop?: string } = {}) {
  const [tree, setTree] = useState<OperationTypeTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      if (options.includeInactive) searchParams.set('includeInactive', 'true');
      if (options.crop) searchParams.set('crop', options.crop);
      const qs = searchParams.toString();
      const data = await api.get<OperationTypeTreeNode[]>(
        `/org/operation-types/tree${qs ? `?${qs}` : ''}`,
      );
      setTree(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tipos de operação');
    } finally {
      setIsLoading(false);
    }
  }, [options.includeInactive, options.crop]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { tree, isLoading, error, refetch: fetch };
}

export function useOperationTypeChildren(parentId: string | null) {
  const [items, setItems] = useState<OperationTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const param = parentId === null ? 'parentId=null' : `parentId=${parentId}`;
      const data = await api.get<OperationTypeItem[]>(`/org/operation-types?${param}`);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tipos de operação');
    } finally {
      setIsLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { items, isLoading, error, refetch: fetch };
}
