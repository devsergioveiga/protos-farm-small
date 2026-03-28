// ─── checkPeriodOpen Middleware Tests ────────────────────────────────────────
// Tests for period-locking middleware: blocks writes on CLOSED/BLOCKED periods.

jest.mock('../database/prisma', () => ({
  prisma: {
    accountingPeriod: {
      findFirst: jest.fn(),
    },
  },
}));

import type { Request, Response, NextFunction } from 'express';
import { checkPeriodOpen } from './check-period-open';
import { prisma } from '../database/prisma';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockPrisma = prisma as any;

function makeReq(overrides: Partial<any> = {}): Request {
  return {
    params: { orgId: 'org-1' },
    body: {},
    ...overrides,
  } as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status } as unknown as Response;
  return { res, status, json };
}

describe('checkPeriodOpen middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next() when period status is OPEN', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
      month: 3,
      year: 2026,
      status: 'OPEN',
    });

    const req = makeReq({ body: { entryDate: '2026-03-15' } });
    const { res } = makeRes();
    const next = jest.fn() as NextFunction;

    await checkPeriodOpen()(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 422 with code PERIOD_NOT_OPEN when period status is CLOSED', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
      month: 2,
      year: 2026,
      status: 'CLOSED',
    });

    const req = makeReq({ body: { entryDate: '2026-02-20' } });
    const { res, status, json } = makeRes();
    const next = jest.fn() as NextFunction;

    await checkPeriodOpen()(req, res, next);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PERIOD_NOT_OPEN' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 422 with code PERIOD_NOT_OPEN when period status is BLOCKED', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
      month: 1,
      year: 2026,
      status: 'BLOCKED',
    });

    const req = makeReq({ body: { date: '2026-01-10' } });
    const { res, status, json } = makeRes();
    const next = jest.fn() as NextFunction;

    await checkPeriodOpen()(req, res, next);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PERIOD_NOT_OPEN' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when no entryDate or date in body (no check needed)', async () => {
    const req = makeReq({ body: {} });
    const { res } = makeRes();
    const next = jest.fn() as NextFunction;

    await checkPeriodOpen()(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockPrisma.accountingPeriod.findFirst).not.toHaveBeenCalled();
  });

  it('returns 422 PERIOD_NOT_FOUND when no period found for given month/year', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(null);

    const req = makeReq({ body: { entryDate: '2026-03-15' } });
    const { res, status, json } = makeRes();
    const next = jest.fn() as NextFunction;

    await checkPeriodOpen()(req, res, next);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PERIOD_NOT_FOUND' }));
    expect(next).not.toHaveBeenCalled();
  });
});
