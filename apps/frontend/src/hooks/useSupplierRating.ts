import { useState } from 'react';
import { api } from '../services/api';
import type { SupplierRating } from '../types/supplier';

interface RatingInput {
  deadline: number;
  quality: number;
  price: number;
  service: number;
  comment?: string;
}

interface UseSupplierRatingResult {
  submitRating: (supplierId: string, input: RatingInput) => Promise<void>;
  getRatingHistory: (supplierId: string) => Promise<void>;
  ratings: SupplierRating[];
  isSubmitting: boolean;
  isLoadingRatings: boolean;
  error: string | null;
}

export function useSupplierRating(onSuccess: () => void): UseSupplierRatingResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRatings, setIsLoadingRatings] = useState(false);
  const [ratings, setRatings] = useState<SupplierRating[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submitRating(supplierId: string, input: RatingInput): Promise<void> {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post<SupplierRating>(`/org/suppliers/${supplierId}/ratings`, input);
      onSuccess();
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      setError(apiErr.message || 'Nao foi possivel registrar a avaliacao. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function getRatingHistory(supplierId: string): Promise<void> {
    setIsLoadingRatings(true);
    setError(null);
    try {
      const data = await api.get<SupplierRating[]>(`/org/suppliers/${supplierId}/ratings`);
      setRatings(data);
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      setError(apiErr.message || 'Nao foi possivel carregar o historico.');
    } finally {
      setIsLoadingRatings(false);
    }
  }

  return { submitRating, getRatingHistory, ratings, isSubmitting, isLoadingRatings, error };
}
