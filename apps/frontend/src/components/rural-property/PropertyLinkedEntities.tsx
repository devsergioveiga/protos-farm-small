import { useState, useEffect, useCallback } from 'react';
import { FileText, TreePine, Link2, Unlink, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import './PropertyLinkedEntities.css';

interface LinkedRegistration {
  id: string;
  number: string;
  cartorioName: string;
  comarca: string;
  state: string;
  areaHa: number;
}

interface LinkedCar {
  id: string;
  carCode: string;
  status: string;
  areaHa: number | null;
  city: string | null;
  state: string | null;
}

interface UnlinkedRegistration {
  id: string;
  number: string;
  cartorioName: string;
  areaHa: number;
}

interface UnlinkedCar {
  id: string;
  carCode: string;
  status: string;
  areaHa: number | null;
}

interface PropertyLinkedEntitiesProps {
  farmId: string;
  propertyId: string;
  show?: 'registrations' | 'cars' | 'all';
}

const STATUS_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  PENDENTE: 'Pendente',
  CANCELADO: 'Cancelado',
  SUSPENSO: 'Suspenso',
};

export function PropertyLinkedEntities({
  farmId,
  propertyId,
  show = 'all',
}: PropertyLinkedEntitiesProps) {
  const [linkedRegs, setLinkedRegs] = useState<LinkedRegistration[]>([]);
  const [linkedCars, setLinkedCars] = useState<LinkedCar[]>([]);
  const [unlinkedRegs, setUnlinkedRegs] = useState<UnlinkedRegistration[]>([]);
  const [unlinkedCars, setUnlinkedCars] = useState<UnlinkedCar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch farm detail to get all registrations and CARs
      const farm = await api.get<{
        registrations: (LinkedRegistration & { ruralPropertyId: string | null })[];
      }>(`/org/farms/${farmId}`);

      const cars = await api.get<(LinkedCar & { ruralPropertyId: string | null })[]>(
        `/org/farms/${farmId}/car`,
      );

      // Split linked vs unlinked
      setLinkedRegs(farm.registrations.filter((r) => r.ruralPropertyId === propertyId));
      setUnlinkedRegs(
        farm.registrations
          .filter((r) => !r.ruralPropertyId)
          .map((r) => ({
            id: r.id,
            number: r.number,
            cartorioName: r.cartorioName,
            areaHa: r.areaHa,
          })),
      );

      setLinkedCars(cars.filter((c) => c.ruralPropertyId === propertyId));
      setUnlinkedCars(
        cars
          .filter((c) => !c.ruralPropertyId)
          .map((c) => ({ id: c.id, carCode: c.carCode, status: c.status, areaHa: c.areaHa })),
      );
    } catch {
      setError('Erro ao carregar dados vinculados');
    } finally {
      setIsLoading(false);
    }
  }, [farmId, propertyId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const linkRegistration = async (regId: string) => {
    try {
      await api.patch(`/org/farms/${farmId}/registrations/${regId}`, {
        ruralPropertyId: propertyId,
      });
      showSuccess('Matrícula vinculada');
      await fetchData();
    } catch {
      setError('Erro ao vincular matrícula');
    }
  };

  const unlinkRegistration = async (regId: string) => {
    try {
      await api.patch(`/org/farms/${farmId}/registrations/${regId}`, { ruralPropertyId: null });
      showSuccess('Matrícula desvinculada');
      await fetchData();
    } catch {
      setError('Erro ao desvincular matrícula');
    }
  };

  const linkCar = async (carId: string) => {
    try {
      await api.patch(`/org/farms/${farmId}/car/${carId}`, { ruralPropertyId: propertyId });
      showSuccess('CAR vinculado');
      await fetchData();
    } catch {
      setError('Erro ao vincular CAR');
    }
  };

  const unlinkCar = async (carId: string) => {
    try {
      await api.patch(`/org/farms/${farmId}/car/${carId}`, { ruralPropertyId: null });
      showSuccess('CAR desvinculado');
      await fetchData();
    } catch {
      setError('Erro ao desvincular CAR');
    }
  };

  if (isLoading) {
    return (
      <div className="ple__loading">
        <div className="ple__skeleton" />
        <div className="ple__skeleton" />
      </div>
    );
  }

  return (
    <div className="ple">
      {error && (
        <div className="ple__error" role="alert">
          <AlertCircle size={14} aria-hidden="true" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="ple__success" role="status">
          {successMsg}
        </div>
      )}

      {/* Matrículas */}
      {(show === 'all' || show === 'registrations') && (
        <section className="ple__section">
          <h4 className="ple__section-title">
            <FileText size={16} aria-hidden="true" /> Matrículas vinculadas
          </h4>

          {linkedRegs.length === 0 ? (
            <p className="ple__empty">Nenhuma matrícula vinculada a este imóvel.</p>
          ) : (
            <ul className="ple__list">
              {linkedRegs.map((reg) => (
                <li key={reg.id} className="ple__item">
                  <div className="ple__item-info">
                    <span className="ple__item-title">{reg.number}</span>
                    <span className="ple__item-detail">
                      {reg.cartorioName} — {reg.comarca}/{reg.state} —{' '}
                      {reg.areaHa.toLocaleString('pt-BR')} ha
                    </span>
                  </div>
                  <button
                    className="ple__action-btn ple__action-btn--danger"
                    onClick={() => unlinkRegistration(reg.id)}
                    aria-label={`Desvincular matrícula ${reg.number}`}
                    type="button"
                  >
                    <Unlink size={14} aria-hidden="true" /> Desvincular
                  </button>
                </li>
              ))}
            </ul>
          )}

          {unlinkedRegs.length > 0 && (
            <div className="ple__available">
              <span className="ple__available-label">Matrículas disponíveis para vincular:</span>
              <ul className="ple__list">
                {unlinkedRegs.map((reg) => (
                  <li key={reg.id} className="ple__item ple__item--available">
                    <div className="ple__item-info">
                      <span className="ple__item-title">{reg.number}</span>
                      <span className="ple__item-detail">
                        {reg.cartorioName} — {reg.areaHa.toLocaleString('pt-BR')} ha
                      </span>
                    </div>
                    <button
                      className="ple__action-btn ple__action-btn--link"
                      onClick={() => linkRegistration(reg.id)}
                      aria-label={`Vincular matrícula ${reg.number}`}
                      type="button"
                    >
                      <Link2 size={14} aria-hidden="true" /> Vincular
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* CAR */}
      {(show === 'all' || show === 'cars') && (
        <section className="ple__section">
          <h4 className="ple__section-title">
            <TreePine size={16} aria-hidden="true" /> CAR vinculados
          </h4>

          {linkedCars.length === 0 ? (
            <p className="ple__empty">Nenhum CAR vinculado a este imóvel.</p>
          ) : (
            <ul className="ple__list">
              {linkedCars.map((car) => (
                <li key={car.id} className="ple__item">
                  <div className="ple__item-info">
                    <span className="ple__item-title ple__item-title--mono">{car.carCode}</span>
                    <span className="ple__item-detail">
                      {STATUS_LABELS[car.status] || car.status}
                      {car.city && ` — ${car.city}`}
                      {car.state && `/${car.state}`}
                      {car.areaHa != null && ` — ${car.areaHa.toLocaleString('pt-BR')} ha`}
                    </span>
                  </div>
                  <button
                    className="ple__action-btn ple__action-btn--danger"
                    onClick={() => unlinkCar(car.id)}
                    aria-label={`Desvincular CAR ${car.carCode}`}
                    type="button"
                  >
                    <Unlink size={14} aria-hidden="true" /> Desvincular
                  </button>
                </li>
              ))}
            </ul>
          )}

          {unlinkedCars.length > 0 && (
            <div className="ple__available">
              <span className="ple__available-label">CARs disponíveis para vincular:</span>
              <ul className="ple__list">
                {unlinkedCars.map((car) => (
                  <li key={car.id} className="ple__item ple__item--available">
                    <div className="ple__item-info">
                      <span className="ple__item-title ple__item-title--mono">{car.carCode}</span>
                      <span className="ple__item-detail">
                        {STATUS_LABELS[car.status] || car.status}
                        {car.areaHa != null && ` — ${car.areaHa.toLocaleString('pt-BR')} ha`}
                      </span>
                    </div>
                    <button
                      className="ple__action-btn ple__action-btn--link"
                      onClick={() => linkCar(car.id)}
                      aria-label={`Vincular CAR ${car.carCode}`}
                      type="button"
                    >
                      <Link2 size={14} aria-hidden="true" /> Vincular
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
