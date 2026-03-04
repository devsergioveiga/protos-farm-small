import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface FarmRegistrationOption {
  id: string;
  number: string;
  cartorioName: string;
}

export function useFarmRegistrations(farmId?: string) {
  const [registrations, setRegistrations] = useState<FarmRegistrationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRegistrations = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const data = await api.get<{ registrations?: FarmRegistrationOption[] }>(`/org/farms/${id}`);
      const regs = data.registrations ?? [];
      setRegistrations(
        regs.map((r) => ({ id: r.id, number: r.number, cartorioName: r.cartorioName })),
      );
    } catch {
      setRegistrations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!farmId) return;
    fetchRegistrations(farmId);
  }, [farmId, fetchRegistrations]);

  const effectiveRegistrations = farmId ? registrations : [];

  return { registrations: effectiveRegistrations, isLoading };
}
