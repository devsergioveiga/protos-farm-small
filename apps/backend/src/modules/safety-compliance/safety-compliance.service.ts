import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  SafetyComplianceError,
  classifyExpiryAlert,
  type ComplianceSummary,
  type EmployeeComplianceOutput,
  type EpiPendingItem,
  type TrainingPendingItem,
  type ComplianceDashboardQuery,
  type ComplianceAlertLevel,
} from './safety-compliance.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function overallStatus(
  epi: ComplianceAlertLevel,
  training: ComplianceAlertLevel,
  aso: ComplianceAlertLevel,
): ComplianceAlertLevel {
  const levels: ComplianceAlertLevel[] = [epi, training, aso];
  if (levels.includes('EXPIRED')) return 'EXPIRED';
  if (levels.includes('RED')) return 'RED';
  if (levels.includes('YELLOW')) return 'YELLOW';
  return 'OK';
}

function expiryLevelToNumber(level: ComplianceAlertLevel): number {
  const map: Record<ComplianceAlertLevel, number> = { OK: 0, YELLOW: 1, RED: 2, EXPIRED: 3 };
  return map[level];
}

function isNonCompliant(level: ComplianceAlertLevel): boolean {
  return level !== 'OK';
}

function isExpiringSoon(level: ComplianceAlertLevel): boolean {
  return level === 'YELLOW' || level === 'RED';
}

// ─── Compliance Engine — 5-query batch pattern ───────────────────────────────

interface ActiveEmployee {
  id: string;
  name: string;
  positionId: string | null;
  positionName: string | null;
}

interface ComplianceData {
  employees: ActiveEmployee[];
  epiRequirements: TxClient[];
  epiDeliveries: TxClient[];
  trainingRequirements: TxClient[];
  trainingRecords: TxClient[];
  medicalExams: TxClient[];
}

async function fetchComplianceData(
  tx: TxClient,
  organizationId: string,
  farmId?: string,
): Promise<ComplianceData> {
  // Query 1: Active employees (with optional farm filter)
  const employeeWhere: TxClient = {
    organizationId,
    status: 'ACTIVE',
    ...(farmId && {
      employeeFarms: {
        some: { farmId, endDate: null },
      },
    }),
  };

  const employees = await tx.employee.findMany({
    where: employeeWhere,
    select: {
      id: true,
      name: true,
      contracts: {
        where: { isActive: true },
        take: 1,
        select: {
          position: { select: { id: true, name: true } },
        },
      },
    },
  });

  const mappedEmployees: ActiveEmployee[] = employees.map((e: TxClient) => ({
    id: e.id,
    name: e.name,
    positionId: e.contracts[0]?.position?.id ?? null,
    positionName: e.contracts[0]?.position?.name ?? null,
  }));

  const employeeIds = mappedEmployees.map((e) => e.id);
  const positionIds = [...new Set(mappedEmployees.map((e) => e.positionId).filter(Boolean))];

  if (employeeIds.length === 0) {
    return {
      employees: [],
      epiRequirements: [],
      epiDeliveries: [],
      trainingRequirements: [],
      trainingRecords: [],
      medicalExams: [],
    };
  }

  // Query 2: EPI requirements for those positions
  const epiRequirements = await tx.positionEpiRequirement.findMany({
    where: { positionId: { in: positionIds } },
    select: {
      positionId: true,
      epiProductId: true,
      quantity: true,
      epiProduct: {
        select: {
          id: true,
          caExpiry: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  // Query 3: EPI deliveries for those employees
  const epiDeliveries = await tx.epiDelivery.findMany({
    where: {
      organizationId,
      employeeId: { in: employeeIds },
    },
    select: {
      employeeId: true,
      epiProductId: true,
      date: true,
      quantity: true,
      epiProduct: {
        select: {
          caExpiry: true,
          product: { select: { name: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  // Query 4: Training requirements (position-specific + global)
  const positionTrainingReqs = await tx.positionTrainingRequirement.findMany({
    where: { positionId: { in: positionIds } },
    select: {
      positionId: true,
      trainingTypeId: true,
      trainingType: {
        select: {
          id: true,
          name: true,
          nrReference: true,
          defaultValidityMonths: true,
          isGlobal: true,
        },
      },
    },
  });

  // Global training types (required for ALL positions)
  const globalTrainingTypes = await tx.trainingType.findMany({
    where: { isGlobal: true },
    select: { id: true, name: true, nrReference: true, defaultValidityMonths: true },
  });

  const allTrainingRequirements = [
    ...positionTrainingReqs,
    ...globalTrainingTypes.map((t: TxClient) => ({
      positionId: null, // global — applies to all
      trainingTypeId: t.id,
      trainingType: t,
    })),
  ];

  // Query 5: Training records for those employees
  const trainingRecords = await tx.employeeTrainingRecord.findMany({
    where: { employeeId: { in: employeeIds } },
    select: {
      employeeId: true,
      expiresAt: true,
      trainingRecord: {
        select: {
          trainingTypeId: true,
          trainingType: { select: { name: true, nrReference: true } },
        },
      },
    },
    orderBy: { expiresAt: 'desc' },
  });

  // Query 6: Latest medical exam per employee
  const medicalExams = await tx.medicalExam.findMany({
    where: {
      organizationId,
      employeeId: { in: employeeIds },
    },
    select: {
      employeeId: true,
      result: true,
      nextExamDate: true,
      date: true,
    },
    orderBy: { date: 'desc' },
  });

  return {
    employees: mappedEmployees,
    epiRequirements,
    epiDeliveries,
    trainingRequirements: allTrainingRequirements,
    trainingRecords,
    medicalExams,
  };
}

function computeEmployeeCompliance(
  employee: ActiveEmployee,
  data: ComplianceData,
  today: Date = new Date(),
): EmployeeComplianceOutput {
  // ── EPI Compliance ──
  const myEpiReqs = data.epiRequirements.filter(
    (r: TxClient) => r.positionId === employee.positionId,
  );
  const myEpiDeliveries = data.epiDeliveries.filter((d: TxClient) => d.employeeId === employee.id);

  const epiPending: EpiPendingItem[] = [];
  let epiCompliantCount = 0;

  for (const req of myEpiReqs) {
    const deliveries = myEpiDeliveries.filter((d: TxClient) => d.epiProductId === req.epiProductId);
    const delivered = deliveries.reduce((sum: number, d: TxClient) => sum + d.quantity, 0);
    const caExpiry = req.epiProduct?.caExpiry ? new Date(req.epiProduct.caExpiry) : null;
    const caValid = !caExpiry || caExpiry >= today;

    if (delivered >= req.quantity && caValid) {
      epiCompliantCount++;
    } else {
      epiPending.push({
        epiProductName: req.epiProduct?.product?.name ?? 'EPI desconhecido',
        epiType: req.epiProduct?.epiType ?? '',
        required: req.quantity,
        delivered,
      });
    }
  }

  const epiStatus: ComplianceAlertLevel = epiPending.length === 0 ? 'OK' : 'RED';

  // ── Training Compliance ──
  const myTrainingReqs = data.trainingRequirements.filter(
    (r: TxClient) =>
      r.positionId === null || // global
      r.positionId === employee.positionId,
  );

  // Deduplicate by trainingTypeId (global types may appear both as position req and global)
  const uniqueTrainingReqs = myTrainingReqs.reduce((acc: TxClient[], req: TxClient) => {
    const typeId = req.trainingTypeId ?? req.id;
    if (!acc.some((r: TxClient) => (r.trainingTypeId ?? r.id) === typeId)) {
      acc.push(req);
    }
    return acc;
  }, []);

  const myTrainingRecords = data.trainingRecords.filter(
    (r: TxClient) => r.employeeId === employee.id,
  );

  const trainingExpired: TrainingPendingItem[] = [];
  let trainingCompliantCount = 0;

  for (const req of uniqueTrainingReqs) {
    const typeId = req.trainingTypeId ?? req.id;
    const records = myTrainingRecords.filter(
      (r: TxClient) => r.trainingRecord?.trainingTypeId === typeId,
    );
    const latestRecord = records[0]; // already sorted by expiresAt desc
    const expiresAt = latestRecord?.expiresAt ? new Date(latestRecord.expiresAt) : null;
    const status = classifyExpiryAlert(expiresAt, today);

    if (status === 'OK') {
      trainingCompliantCount++;
    } else {
      trainingExpired.push({
        trainingTypeName: req.trainingType?.name ?? 'Treinamento desconhecido',
        nrReference: req.trainingType?.nrReference ?? null,
        expiresAt: expiresAt ? expiresAt.toISOString().split('T')[0] : null,
        status,
      });
    }
  }

  const trainingStatus: ComplianceAlertLevel =
    trainingExpired.length === 0
      ? 'OK'
      : trainingExpired.some((t) => t.status === 'EXPIRED')
        ? 'EXPIRED'
        : trainingExpired.some((t) => t.status === 'RED')
          ? 'RED'
          : 'YELLOW';

  // ── ASO Compliance ──
  const myExams = data.medicalExams.filter((e: TxClient) => e.employeeId === employee.id);
  const latestExam = myExams[0]; // sorted by date desc
  const nextExamDate = latestExam?.nextExamDate ? new Date(latestExam.nextExamDate) : null;
  const asoStatus = classifyExpiryAlert(nextExamDate, today);

  const overall = overallStatus(epiStatus, trainingStatus, asoStatus);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    positionName: employee.positionName,
    epiCompliance: {
      total: myEpiReqs.length,
      compliant: epiCompliantCount,
      pending: epiPending,
    },
    trainingCompliance: {
      total: uniqueTrainingReqs.length,
      compliant: trainingCompliantCount,
      expired: trainingExpired,
    },
    asoCompliance: {
      latestResult: latestExam?.result ?? null,
      nextExamDate: nextExamDate ? nextExamDate.toISOString().split('T')[0] : null,
      expiryStatus: asoStatus,
    },
    overallStatus: overall,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getComplianceSummary(
  ctx: RlsContext,
  farmId?: string,
): Promise<ComplianceSummary> {
  return withRlsContext(ctx, async (tx) => {
    const data = await fetchComplianceData(tx, ctx.organizationId, farmId);
    const today = new Date();

    if (data.employees.length === 0) {
      return {
        totalEmployees: 0,
        compliantCount: 0,
        compliantPercent: 0,
        pendingCount: 0,
        expiringIn30Days: 0,
      };
    }

    let compliantCount = 0;
    let expiringIn30Days = 0;

    for (const emp of data.employees) {
      const compliance = computeEmployeeCompliance(emp, data, today);
      if (compliance.overallStatus === 'OK') {
        compliantCount++;
      }

      // Check if any item is expiring within 30 days (YELLOW level)
      const hasExpiringSoon =
        isExpiringSoon(compliance.epiCompliance.pending.length > 0 ? 'RED' : 'OK') ||
        compliance.trainingCompliance.expired.some((t) => isExpiringSoon(t.status)) ||
        isExpiringSoon(compliance.asoCompliance.expiryStatus);

      if (hasExpiringSoon) {
        expiringIn30Days++;
      }
    }

    const totalEmployees = data.employees.length;
    const pendingCount = totalEmployees - compliantCount;
    const compliantPercent =
      totalEmployees > 0 ? Math.round((compliantCount / totalEmployees) * 100) : 0;

    return {
      totalEmployees,
      compliantCount,
      compliantPercent,
      pendingCount,
      expiringIn30Days,
    };
  });
}

export async function listNonCompliantEmployees(
  ctx: RlsContext,
  query: ComplianceDashboardQuery,
): Promise<{ data: EmployeeComplianceOutput[]; total: number; page: number; limit: number }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const data = await fetchComplianceData(tx, ctx.organizationId, query.farmId);
    const today = new Date();

    let results = data.employees.map((emp) => computeEmployeeCompliance(emp, data, today));

    // Filter by search (employee name LIKE)
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      results = results.filter((r) => r.employeeName.toLowerCase().includes(searchLower));
    }

    // Filter by pendingType
    if (query.pendingType) {
      results = results.filter((r) => {
        if (query.pendingType === 'EPI') return r.epiCompliance.pending.length > 0;
        if (query.pendingType === 'TRAINING') return r.trainingCompliance.expired.length > 0;
        if (query.pendingType === 'ASO') return r.asoCompliance.expiryStatus !== 'OK';
        return true;
      });
    } else {
      // Default: only non-compliant employees
      results = results.filter((r) => isNonCompliant(r.overallStatus));
    }

    // Sort by severity (EXPIRED > RED > YELLOW)
    results.sort(
      (a, b) => expiryLevelToNumber(b.overallStatus) - expiryLevelToNumber(a.overallStatus),
    );

    const total = results.length;
    const data2 = results.slice(skip, skip + limit);

    return { data: data2, total, page, limit };
  });
}

export async function getEmployeeCompliance(
  ctx: RlsContext,
  employeeId: string,
): Promise<EmployeeComplianceOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Get specific employee
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, organizationId: ctx.organizationId },
      select: {
        id: true,
        name: true,
        contracts: {
          where: { isActive: true },
          take: 1,
          select: {
            position: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!employee) {
      throw new SafetyComplianceError('Colaborador não encontrado', 404);
    }

    const mappedEmployee: ActiveEmployee = {
      id: employee.id,
      name: employee.name,
      positionId: employee.contracts[0]?.position?.id ?? null,
      positionName: employee.contracts[0]?.position?.name ?? null,
    };

    // Fetch data scoped to just this employee
    const data = await fetchComplianceData(tx, ctx.organizationId);
    // Filter to only this employee's data for efficiency
    const filteredData = {
      ...data,
      employees: [mappedEmployee],
    };

    return computeEmployeeCompliance(mappedEmployee, filteredData);
  });
}

// ─── CA4: CSV Report ─────────────────────────────────────────────────────────

export async function generateComplianceReportCsv(
  ctx: RlsContext,
  farmId?: string,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const data = await fetchComplianceData(tx, ctx.organizationId, farmId);
    const today = new Date();

    const rows: string[] = [];
    const header = ['Nome', 'Cargo', 'Tipo Pendência', 'Detalhe', 'Vencimento'].join(';');
    rows.push(header);

    for (const emp of data.employees) {
      const compliance = computeEmployeeCompliance(emp, data, today);

      // EPI pending
      for (const epi of compliance.epiCompliance.pending) {
        rows.push(
          [
            `"${emp.name}"`,
            `"${emp.positionName ?? ''}"`,
            'EPI',
            `"${epi.epiProductName} — ${epi.delivered}/${epi.required} unidades"`,
            '',
          ].join(';'),
        );
      }

      // Training expired/pending
      for (const training of compliance.trainingCompliance.expired) {
        rows.push(
          [
            `"${emp.name}"`,
            `"${emp.positionName ?? ''}"`,
            'TREINAMENTO',
            `"${training.trainingTypeName}${training.nrReference ? ' (' + training.nrReference + ')' : ''}"`,
            training.expiresAt ?? 'Não realizado',
          ].join(';'),
        );
      }

      // ASO pending
      if (compliance.asoCompliance.expiryStatus !== 'OK') {
        const asoDetail = compliance.asoCompliance.latestResult
          ? `Último resultado: ${compliance.asoCompliance.latestResult}`
          : 'Sem ASO registrado';
        rows.push(
          [
            `"${emp.name}"`,
            `"${emp.positionName ?? ''}"`,
            'ASO',
            `"${asoDetail}"`,
            compliance.asoCompliance.nextExamDate ?? 'Não programado',
          ].join(';'),
        );
      }
    }

    return rows.join('\n');
  });
}

// ─── CA5: PDF Report ─────────────────────────────────────────────────────────

export async function generateComplianceReportPdf(
  ctx: RlsContext,
  farmId?: string,
): Promise<Buffer> {
  return withRlsContext(ctx, async (tx) => {
    const data = await fetchComplianceData(tx, ctx.organizationId, farmId);
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-BR');

    // Get farm name if filtered
    let farmName = 'Todas as fazendas';
    if (farmId) {
      const farm = await tx.farm.findFirst({
        where: { id: farmId, organizationId: ctx.organizationId },
        select: { name: true },
      });
      if (farm) farmName = farm.name;
    }

    // Compute compliance for all employees
    const complianceList = data.employees.map((emp) => computeEmployeeCompliance(emp, data, today));

    const totalEmployees = complianceList.length;
    const compliantCount = complianceList.filter((c) => c.overallStatus === 'OK').length;
    const pendingCount = totalEmployees - compliantCount;

    const epiPending = complianceList.filter((c) => c.epiCompliance.pending.length > 0);
    const trainingPending = complianceList.filter((c) => c.trainingCompliance.expired.length > 0);
    const asoPending = complianceList.filter((c) => c.asoCompliance.expiryStatus !== 'OK');

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100;

      // ── Header ──
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('RELATÓRIO DE CONFORMIDADE NR-31', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(`Fazenda: ${farmName}`, { align: 'center' });
      doc.text(`Emitido em: ${dateStr}`, { align: 'center' });
      doc.moveDown(0.5);

      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.5);

      // ── Summary ──
      doc.fontSize(12).font('Helvetica-Bold').text('RESUMO DE CONFORMIDADE');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total de colaboradores: ${totalEmployees}`);
      doc.text(
        `Conformes: ${compliantCount} (${totalEmployees > 0 ? Math.round((compliantCount / totalEmployees) * 100) : 0}%)`,
      );
      doc.text(`Pendentes: ${pendingCount}`);
      doc.moveDown(0.5);

      // ── EPI Pendentes ──
      if (epiPending.length > 0) {
        doc
          .moveTo(50, doc.y)
          .lineTo(50 + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica-Bold').text('EPIs PENDENTES');
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica');

        for (const emp of epiPending) {
          doc
            .font('Helvetica-Bold')
            .text(`${emp.employeeName} (${emp.positionName ?? 'sem cargo'})`);
          doc.font('Helvetica');
          for (const epi of emp.epiCompliance.pending) {
            doc.text(
              `  • ${epi.epiProductName}: ${epi.delivered}/${epi.required} unidades entregues`,
            );
          }
          doc.moveDown(0.3);
        }
      }

      // ── Treinamentos Vencidos ──
      if (trainingPending.length > 0) {
        doc
          .moveTo(50, doc.y)
          .lineTo(50 + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica-Bold').text('TREINAMENTOS VENCIDOS / PENDENTES');
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica');

        for (const emp of trainingPending) {
          doc
            .font('Helvetica-Bold')
            .text(`${emp.employeeName} (${emp.positionName ?? 'sem cargo'})`);
          doc.font('Helvetica');
          for (const training of emp.trainingCompliance.expired) {
            const status = training.status === 'EXPIRED' ? 'VENCIDO' : 'VENCENDO';
            doc.text(
              `  • ${training.trainingTypeName}: ${status}${training.expiresAt ? ' em ' + new Date(training.expiresAt).toLocaleDateString('pt-BR') : ''}`,
            );
          }
          doc.moveDown(0.3);
        }
      }

      // ── ASOs Pendentes ──
      if (asoPending.length > 0) {
        doc
          .moveTo(50, doc.y)
          .lineTo(50 + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica-Bold').text('ASOs PENDENTES / VENCIDOS');
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica');

        for (const emp of asoPending) {
          const asoStatus = emp.asoCompliance.expiryStatus === 'EXPIRED' ? 'VENCIDO' : 'VENCENDO';
          doc
            .font('Helvetica-Bold')
            .text(`${emp.employeeName} (${emp.positionName ?? 'sem cargo'})`);
          doc.font('Helvetica');
          doc.text(
            `  • ASO ${asoStatus}${emp.asoCompliance.nextExamDate ? ' em ' + new Date(emp.asoCompliance.nextExamDate).toLocaleDateString('pt-BR') : ''}`,
          );
          doc.moveDown(0.3);
        }
      }

      // ── Footer ──
      doc.moveDown(1);
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica').text('Gerado automaticamente pelo sistema Protos Farm', {
        align: 'center',
      });

      doc.end();
    });
  });
}
