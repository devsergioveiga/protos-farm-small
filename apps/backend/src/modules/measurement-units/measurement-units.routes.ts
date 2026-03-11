import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { MeasurementUnitError } from './measurement-units.types';
import {
  type ImportConversionRow,
  createUnit,
  listUnits,
  getUnit,
  updateUnit,
  deleteUnit,
  createConversion,
  listConversions,
  updateConversion,
  deleteConversion,
  convert,
  importConversions,
} from './measurement-units.service';

export const measurementUnitsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MeasurementUnitError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MeasurementUnitError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ═══════════════════════════════════════════════════════════════════════
// UNITS
// ═══════════════════════════════════════════════════════════════════════

// ─── CREATE ─────────────────────────────────────────────────────────

measurementUnitsRouter.post(
  '/org/measurement-units',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createUnit(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_MEASUREMENT_UNIT',
        targetType: 'measurement_unit',
        targetId: result.id,
        metadata: { name: result.name, abbreviation: result.abbreviation },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

measurementUnitsRouter.get(
  '/org/measurement-units',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listUnits(ctx, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        category: (req.query.category as string) || undefined,
        search: (req.query.search as string) || undefined,
        includeInactive: req.query.includeInactive === 'true',
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

measurementUnitsRouter.get(
  '/org/measurement-units/:unitId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getUnit(ctx, req.params.unitId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

measurementUnitsRouter.patch(
  '/org/measurement-units/:unitId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateUnit(ctx, req.params.unitId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MEASUREMENT_UNIT',
        targetType: 'measurement_unit',
        targetId: result.id,
        metadata: { name: result.name, abbreviation: result.abbreviation },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

measurementUnitsRouter.delete(
  '/org/measurement-units/:unitId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteUnit(ctx, req.params.unitId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_MEASUREMENT_UNIT',
        targetType: 'measurement_unit',
        targetId: req.params.unitId as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// CONVERSIONS
// ═══════════════════════════════════════════════════════════════════════

// ─── CREATE ─────────────────────────────────────────────────────────

measurementUnitsRouter.post(
  '/org/unit-conversions',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createConversion(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_UNIT_CONVERSION',
        targetType: 'unit_conversion',
        targetId: result.id,
        metadata: {
          from: result.fromUnitAbbreviation,
          to: result.toUnitAbbreviation,
          factor: result.factor,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

measurementUnitsRouter.get(
  '/org/unit-conversions',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listConversions(ctx, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        unitId: (req.query.unitId as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

measurementUnitsRouter.patch(
  '/org/unit-conversions/:conversionId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateConversion(ctx, req.params.conversionId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_UNIT_CONVERSION',
        targetType: 'unit_conversion',
        targetId: result.id,
        metadata: { factor: result.factor },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

measurementUnitsRouter.delete(
  '/org/unit-conversions/:conversionId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteConversion(ctx, req.params.conversionId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_UNIT_CONVERSION',
        targetType: 'unit_conversion',
        targetId: req.params.conversionId as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CONVERT (utility endpoint) ─────────────────────────────────────

measurementUnitsRouter.get(
  '/org/unit-conversions/convert',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const fromUnitId = req.query.fromUnitId as string;
      const toUnitId = req.query.toUnitId as string;
      const value = Number(req.query.value);

      if (!fromUnitId || !toUnitId) {
        throw new MeasurementUnitError('fromUnitId e toUnitId são obrigatórios', 400);
      }
      if (isNaN(value)) {
        throw new MeasurementUnitError('value deve ser um número válido', 400);
      }

      const result = await convert(ctx, fromUnitId, toUnitId, value);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── IMPORT CSV ─────────────────────────────────────────────────────

measurementUnitsRouter.post(
  '/org/unit-conversions/import',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const rows = req.body.conversions as ImportConversionRow[];
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new MeasurementUnitError('Lista de conversões vazia ou inválida', 400);
      }
      if (rows.length > 500) {
        throw new MeasurementUnitError('Máximo de 500 conversões por importação', 400);
      }

      const result = await importConversions(ctx, rows);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'IMPORT_UNIT_CONVERSIONS',
        targetType: 'unit_conversion',
        targetId: undefined,
        metadata: { imported: result.imported, skipped: result.skipped },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
