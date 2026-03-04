import { useState, useEffect } from 'react';
import { api } from '@/services/api';

export interface FarmRegistrationOption {
  id: string;
  number: string;
  cartorioName: string;
}

export function useFarmRegistrations(farmId?: string) {
  const [registrations, setRegistrations] = useState<FarmRegistrationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!farmId) {
      setRegistrations([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    api
      .get<{ registrations?: FarmRegistrationOption[] }>(`/org/farms/${farmId}`)
      .then((data) => {
        if (cancelled) return;
        const regs = data.registrations ?? [];
        setRegistrations(
          regs.map((r) => ({ id: r.id, number: r.number, cartorioName: r.cartorioName })),
        );
      })
      .catch(() => {
        if (!cancelled) setRegistrations([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [farmId]);

  return { registrations, isLoading };
}
