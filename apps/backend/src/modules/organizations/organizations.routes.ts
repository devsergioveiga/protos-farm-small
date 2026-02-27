import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import {
  createOrganization,
  listOrganizations,
  getOrganizationById,
  updateOrganizationStatus,
  updateOrganizationPlan,
  OrgError,
} from './organizations.service';

export const organizationsRouter = Router();

const adminOnly = [authenticate, authorize('SUPER_ADMIN')];

// POST /admin/organizations
organizationsRouter.post('/admin/organizations', ...adminOnly, async (req, res) => {
  try {
    const { name, type, document, plan, maxUsers, maxFarms } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nome é obrigatório' });
      return;
    }

    if (!type || !['PF', 'PJ'].includes(type)) {
      res.status(400).json({ error: 'Tipo deve ser PF ou PJ' });
      return;
    }

    if (!document) {
      res.status(400).json({ error: 'Documento é obrigatório' });
      return;
    }

    const org = await createOrganization({ name, type, document, plan, maxUsers, maxFarms });
    res.status(201).json(org);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /admin/organizations
organizationsRouter.get('/admin/organizations', ...adminOnly, async (req, res) => {
  try {
    const page = req.query.page ? Number(req.query.page as string) : undefined;
    const limit = req.query.limit ? Number(req.query.limit as string) : undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const result = await listOrganizations({ page, limit, status, search });
    res.json(result);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /admin/organizations/:id
organizationsRouter.get('/admin/organizations/:id', ...adminOnly, async (req, res) => {
  try {
    const org = await getOrganizationById(req.params.id as string);
    res.json(org);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /admin/organizations/:id/status
organizationsRouter.patch('/admin/organizations/:id/status', ...adminOnly, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status é obrigatório' });
      return;
    }

    if (!['ACTIVE', 'SUSPENDED', 'CANCELLED'].includes(status)) {
      res.status(400).json({ error: 'Status deve ser ACTIVE, SUSPENDED ou CANCELLED' });
      return;
    }

    const org = await updateOrganizationStatus(req.params.id as string, status);
    res.json(org);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /admin/organizations/:id/plan
organizationsRouter.patch('/admin/organizations/:id/plan', ...adminOnly, async (req, res) => {
  try {
    const { plan, maxUsers, maxFarms } = req.body;

    if (!plan) {
      res.status(400).json({ error: 'Plano é obrigatório' });
      return;
    }

    const org = await updateOrganizationPlan(req.params.id as string, { plan, maxUsers, maxFarms });
    res.json(org);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
