import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MonitoringPointError,
  type CreateMonitoringPointInput,
  type UpdateMonitoringPointInput,
  type ListMonitoringPointsQuery,
  type MonitoringPointItem,
  type GenerateGridInput,
} from './monitoring-points.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toItem(row: Record<string, unknown>): MonitoringPointItem {
  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    code: row.code as string,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateMonitoringPointInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new MonitoringPointError('Talhão é obrigatório', 400);
  }
  if (!input.code?.trim()) {
    throw new MonitoringPointError('Código do ponto é obrigatório', 400);
  }
  if (input.latitude == null || input.longitude == null) {
    throw new MonitoringPointError('Coordenadas (latitude/longitude) são obrigatórias', 400);
  }
  if (input.latitude < -90 || input.latitude > 90) {
    throw new MonitoringPointError('Latitude deve estar entre -90 e 90', 400);
  }
  if (input.longitude < -180 || input.longitude > 180) {
    throw new MonitoringPointError('Longitude deve estar entre -180 e 180', 400);
  }
}

function validateUpdateInput(input: UpdateMonitoringPointInput): void {
  if (input.code !== undefined && !input.code?.trim()) {
    throw new MonitoringPointError('Código do ponto não pode ser vazio', 400);
  }
  if (input.latitude !== undefined && (input.latitude < -90 || input.latitude > 90)) {
    throw new MonitoringPointError('Latitude deve estar entre -90 e 90', 400);
  }
  if (input.longitude !== undefined && (input.longitude < -180 || input.longitude > 180)) {
    throw new MonitoringPointError('Longitude deve estar entre -180 e 180', 400);
  }
}

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createMonitoringPoint(
  ctx: RlsContext,
  farmId: string,
  input: CreateMonitoringPointInput,
): Promise<MonitoringPointItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Verify field plot belongs to farm
    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
    });
    if (!plot) {
      throw new MonitoringPointError('Talhão não encontrado nesta fazenda', 404);
    }

    // Check unique code within plot
    const existing = await tx.monitoringPoint.findFirst({
      where: { fieldPlotId: input.fieldPlotId, code: input.code.trim(), deletedAt: null },
    });
    if (existing) {
      throw new MonitoringPointError('Já existe um ponto com esse código neste talhão', 409);
    }

    const row = await tx.monitoringPoint.create({
      data: {
        farmId,
        fieldPlotId: input.fieldPlotId,
        code: input.code.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        notes: input.notes?.trim() || null,
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listMonitoringPoints(
  ctx: RlsContext,
  farmId: string,
  fieldPlotId: string,
  query: ListMonitoringPointsQuery,
): Promise<{
  data: MonitoringPointItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      farmId,
      fieldPlotId,
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      tx.monitoringPoint.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
      tx.monitoringPoint.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toItem(r as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getMonitoringPoint(
  ctx: RlsContext,
  farmId: string,
  pointId: string,
): Promise<MonitoringPointItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.monitoringPoint.findFirst({
      where: { id: pointId, farmId, deletedAt: null },
    });
    if (!row) {
      throw new MonitoringPointError('Ponto de monitoramento não encontrado', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateMonitoringPoint(
  ctx: RlsContext,
  farmId: string,
  pointId: string,
  input: UpdateMonitoringPointInput,
): Promise<MonitoringPointItem> {
  validateUpdateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.monitoringPoint.findFirst({
      where: { id: pointId, farmId, deletedAt: null },
    });
    if (!existing) {
      throw new MonitoringPointError('Ponto de monitoramento não encontrado', 404);
    }

    // Check code uniqueness if changing
    if (input.code !== undefined && input.code.trim() !== existing.code) {
      const duplicate = await tx.monitoringPoint.findFirst({
        where: {
          fieldPlotId: existing.fieldPlotId,
          code: input.code.trim(),
          deletedAt: null,
          id: { not: pointId },
        },
      });
      if (duplicate) {
        throw new MonitoringPointError('Já existe um ponto com esse código neste talhão', 409);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.code !== undefined) data.code = input.code.trim();
    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const row = await tx.monitoringPoint.update({
      where: { id: pointId },
      data,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteMonitoringPoint(
  ctx: RlsContext,
  farmId: string,
  pointId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.monitoringPoint.findFirst({
      where: { id: pointId, farmId, deletedAt: null },
    });
    if (!existing) {
      throw new MonitoringPointError('Ponto de monitoramento não encontrado', 404);
    }

    await tx.monitoringPoint.update({
      where: { id: pointId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── GENERATE GRID ──────────────────────────────────────────────────

export async function generateGrid(
  ctx: RlsContext,
  farmId: string,
  input: GenerateGridInput,
): Promise<MonitoringPointItem[]> {
  if (!input.fieldPlotId?.trim()) {
    throw new MonitoringPointError('Talhão é obrigatório', 400);
  }
  if (!input.spacingMeters || input.spacingMeters < 5 || input.spacingMeters > 500) {
    throw new MonitoringPointError('Espaçamento deve estar entre 5 e 500 metros', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Verify field plot belongs to farm and get its centroid/boundary
    const plotRows = await tx.$queryRaw<
      Array<{
        id: string;
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
        centroidLat: number;
        centroidLng: number;
      }>
    >`
      SELECT
        id,
        ST_YMin(boundary::geometry) as "minLat",
        ST_YMax(boundary::geometry) as "maxLat",
        ST_XMin(boundary::geometry) as "minLng",
        ST_XMax(boundary::geometry) as "maxLng",
        ST_Y(ST_Centroid(boundary::geometry)) as "centroidLat",
        ST_X(ST_Centroid(boundary::geometry)) as "centroidLng"
      FROM field_plots
      WHERE id = ${input.fieldPlotId}
        AND "farmId" = ${farmId}
        AND "deletedAt" IS NULL
    `;

    if (!plotRows.length) {
      throw new MonitoringPointError('Talhão não encontrado nesta fazenda', 404);
    }

    const plot = plotRows[0];
    const spacingDeg = input.spacingMeters / 111320; // approximate meters to degrees

    // Generate grid points within bounding box
    const points: Array<{ code: string; lat: number; lng: number }> = [];
    let idx = 1;

    for (let lat = Number(plot.minLat); lat <= Number(plot.maxLat); lat += spacingDeg) {
      for (let lng = Number(plot.minLng); lng <= Number(plot.maxLng); lng += spacingDeg) {
        points.push({ code: `P${String(idx).padStart(2, '0')}`, lat, lng });
        idx++;
      }
    }

    // Filter: only points inside the polygon
    if (points.length === 0) {
      return [];
    }

    const insideChecks = await Promise.all(
      points.map(async (p) => {
        const result = await tx.$queryRaw<Array<{ inside: boolean }>>`
          SELECT ST_Contains(
            boundary::geometry,
            ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)
          ) as inside
          FROM field_plots
          WHERE id = ${input.fieldPlotId}
        `;
        return { ...p, inside: result[0]?.inside ?? false };
      }),
    );

    const insidePoints = insideChecks.filter((p) => p.inside);

    if (insidePoints.length === 0) {
      throw new MonitoringPointError(
        'Nenhum ponto gerado dentro do polígono do talhão. Tente um espaçamento menor.',
        400,
      );
    }

    if (insidePoints.length > 200) {
      throw new MonitoringPointError(
        `Grid geraria ${insidePoints.length} pontos (máx 200). Aumente o espaçamento.`,
        400,
      );
    }

    // Soft-delete existing points for this plot
    await tx.monitoringPoint.updateMany({
      where: { fieldPlotId: input.fieldPlotId, farmId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Create new grid points
    const created: MonitoringPointItem[] = [];
    for (const p of insidePoints) {
      const row = await tx.monitoringPoint.create({
        data: {
          farmId,
          fieldPlotId: input.fieldPlotId,
          code: p.code,
          latitude: p.lat,
          longitude: p.lng,
        },
      });
      created.push(toItem(row as unknown as Record<string, unknown>));
    }

    return created;
  });
}
