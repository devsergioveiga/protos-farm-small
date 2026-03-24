import fs from 'fs';
import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import { isValidCPF, isValidPIS } from '../../shared/utils/document-validator';
import { EmployeeError } from './employees.types';
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  TransitionStatusInput,
  ListEmployeeParams,
  CreateDependentInput,
  AddFarmAssocInput,
  EmployeeDocumentInput,
} from './employees.types';

// ─── State Machine ───────────────────────────────────────────────────

type EmployeeStatus = 'ATIVO' | 'AFASTADO' | 'FERIAS' | 'DESLIGADO';

const VALID_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  ATIVO: ['AFASTADO', 'FERIAS', 'DESLIGADO'],
  AFASTADO: ['ATIVO'],
  FERIAS: ['ATIVO'],
  DESLIGADO: [], // terminal state
};

// ─── Create Employee ─────────────────────────────────────────────────

export async function createEmployee(
  ctx: RlsContext,
  input: CreateEmployeeInput,
): Promise<{ employee: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = [];

  // Validate CPF (hard block)
  if (!isValidCPF(input.cpf)) {
    throw new EmployeeError('CPF inválido', 400);
  }

  // Validate PIS (warning only)
  if (input.pisPassep && !isValidPIS(input.pisPassep)) {
    warnings.push('PIS/PASEP com formato inválido — salvo mesmo assim, corrija depois');
  }

  const employee = await withRlsContext(ctx, async (tx) => {
    // Check CPF uniqueness within org
    const existing = await tx.employee.findUnique({
      where: { organizationId_cpf: { organizationId: ctx.organizationId, cpf: input.cpf } },
      select: { id: true },
    });
    if (existing) {
      throw new EmployeeError('Já existe um colaborador com este CPF nesta organização', 409);
    }

    const emp = await tx.employee.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        cpf: input.cpf,
        rg: input.rg,
        rgIssuer: input.rgIssuer,
        rgUf: input.rgUf,
        pisPassep: input.pisPassep,
        ctpsNumber: input.ctpsNumber,
        ctpsSeries: input.ctpsSeries,
        ctpsUf: input.ctpsUf,
        birthDate: new Date(input.birthDate),
        motherName: input.motherName,
        fatherName: input.fatherName,
        educationLevel: input.educationLevel,
        maritalStatus: input.maritalStatus,
        nationality: input.nationality ?? 'Brasileiro',
        bloodType: input.bloodType,
        hasDisability: input.hasDisability ?? false,
        disabilityType: input.disabilityType,
        phone: input.phone,
        email: input.email,
        zipCode: input.zipCode,
        street: input.street,
        number: input.number,
        complement: input.complement,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state,
        bankCode: input.bankCode,
        bankAgency: input.bankAgency,
        bankAccount: input.bankAccount,
        bankAccountType: input.bankAccountType as
          | 'CORRENTE'
          | 'POUPANCA'
          | undefined,
        bankAccountDigit: input.bankAccountDigit,
        initialVacationBalance: input.initialVacationBalance,
        initialHourBankBalance: input.initialHourBankBalance,
        admissionDate: new Date(input.admissionDate),
        notes: input.notes,
        createdBy: ctx.userId ?? 'system',
      },
    });

    // Create initial salary history if salary provided
    if (input.salary !== undefined && input.salary > 0) {
      await tx.employeeSalaryHistory.create({
        data: {
          employeeId: emp.id,
          salary: input.salary,
          effectiveAt: new Date(input.admissionDate),
          movementType: 'SALARY_ADJUSTMENT',
          reason: 'Salário inicial na admissão',
        },
      });
    }

    // Create dependents inline
    if (input.dependents && input.dependents.length > 0) {
      for (const dep of input.dependents) {
        if ((dep.irrf || dep.salaryFamily) && !dep.cpf) {
          throw new EmployeeError(
            `Dependente "${dep.name}" requer CPF quando marcado para IRRF ou salário família`,
            400,
          );
        }
        await tx.employeeDependent.create({
          data: {
            employeeId: emp.id,
            name: dep.name,
            cpf: dep.cpf,
            birthDate: new Date(dep.birthDate),
            relationship: dep.relationship,
            irrf: dep.irrf ?? false,
            salaryFamily: dep.salaryFamily ?? false,
          },
        });
      }
    }

    // Create initial farm association
    if (input.farmId) {
      await tx.employeeFarm.create({
        data: {
          employeeId: emp.id,
          farmId: input.farmId,
          positionId: input.positionId,
          startDate: new Date(input.admissionDate),
        },
      });
    }

    return emp;
  });

  return { employee: employee as unknown as Record<string, unknown>, warnings };
}

// ─── List Employees ──────────────────────────────────────────────────

export async function listEmployees(
  ctx: RlsContext,
  params: ListEmployeeParams,
): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { cpf: { contains: params.search.replace(/\D/g, '') } },
      ];
    }

    if (params.farmId) {
      where.farms = { some: { farmId: params.farmId, endDate: null } };
    }

    if (params.positionId) {
      where.farms = { some: { positionId: params.positionId, endDate: null } };
    }

    const [data, total] = await Promise.all([
      tx.employee.findMany({
        where: where as Parameters<typeof tx.employee.findMany>[0]['where'],
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          cpf: true,
          status: true,
          photoUrl: true,
          admissionDate: true,
          farms: {
            where: { endDate: null },
            select: {
              id: true,
              farm: { select: { id: true, name: true } },
              position: { select: { id: true, name: true } },
            },
            take: 1,
          },
        },
      }),
      tx.employee.count({
        where: where as Parameters<typeof tx.employee.count>[0]['where'],
      }),
    ]);

    return { data, total, page, limit };
  });
}

// ─── Get Employee ────────────────────────────────────────────────────

export async function getEmployee(
  ctx: RlsContext,
  id: string,
): Promise<unknown> {
  return withRlsContext(ctx, async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        dependents: true,
        farms: {
          include: {
            farm: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
          orderBy: { startDate: 'desc' },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        contracts: {
          where: { isActive: true },
          include: {
            position: { select: { id: true, name: true } },
            workSchedule: { select: { id: true, name: true } },
          },
          take: 1,
        },
        statusHistory: {
          orderBy: { effectiveAt: 'desc' },
          take: 10,
        },
        salaryHistory: {
          orderBy: { effectiveAt: 'asc' },
        },
      },
    });

    if (!employee) {
      throw new EmployeeError('Colaborador não encontrado', 404);
    }

    return employee;
  });
}

// ─── Update Employee ─────────────────────────────────────────────────

export async function updateEmployee(
  ctx: RlsContext,
  id: string,
  input: UpdateEmployeeInput,
): Promise<unknown> {
  // Validate PIS if being updated
  const warnings: string[] = [];
  if (input.pisPassep && !isValidPIS(input.pisPassep)) {
    warnings.push('PIS/PASEP com formato inválido — salvo mesmo assim, corrija depois');
  }

  const employee = await withRlsContext(ctx, async (tx) => {
    const existing = await tx.employee.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new EmployeeError('Colaborador não encontrado', 404);
    }

    return tx.employee.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.rg !== undefined && { rg: input.rg }),
        ...(input.rgIssuer !== undefined && { rgIssuer: input.rgIssuer }),
        ...(input.rgUf !== undefined && { rgUf: input.rgUf }),
        ...(input.pisPassep !== undefined && { pisPassep: input.pisPassep }),
        ...(input.ctpsNumber !== undefined && { ctpsNumber: input.ctpsNumber }),
        ...(input.ctpsSeries !== undefined && { ctpsSeries: input.ctpsSeries }),
        ...(input.ctpsUf !== undefined && { ctpsUf: input.ctpsUf }),
        ...(input.birthDate !== undefined && { birthDate: new Date(input.birthDate) }),
        ...(input.motherName !== undefined && { motherName: input.motherName }),
        ...(input.fatherName !== undefined && { fatherName: input.fatherName }),
        ...(input.educationLevel !== undefined && { educationLevel: input.educationLevel }),
        ...(input.maritalStatus !== undefined && { maritalStatus: input.maritalStatus }),
        ...(input.nationality !== undefined && { nationality: input.nationality }),
        ...(input.bloodType !== undefined && { bloodType: input.bloodType }),
        ...(input.hasDisability !== undefined && { hasDisability: input.hasDisability }),
        ...(input.disabilityType !== undefined && { disabilityType: input.disabilityType }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.zipCode !== undefined && { zipCode: input.zipCode }),
        ...(input.street !== undefined && { street: input.street }),
        ...(input.number !== undefined && { number: input.number }),
        ...(input.complement !== undefined && { complement: input.complement }),
        ...(input.neighborhood !== undefined && { neighborhood: input.neighborhood }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.bankCode !== undefined && { bankCode: input.bankCode }),
        ...(input.bankAgency !== undefined && { bankAgency: input.bankAgency }),
        ...(input.bankAccount !== undefined && { bankAccount: input.bankAccount }),
        ...(input.bankAccountType !== undefined && {
          bankAccountType: input.bankAccountType as 'CORRENTE' | 'POUPANCA',
        }),
        ...(input.bankAccountDigit !== undefined && { bankAccountDigit: input.bankAccountDigit }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.admissionDate !== undefined && {
          admissionDate: new Date(input.admissionDate),
        }),
      },
    });
  });

  return { employee, warnings };
}

// ─── Transition Status ───────────────────────────────────────────────

export async function transitionEmployeeStatus(
  ctx: RlsContext,
  id: string,
  input: TransitionStatusInput,
): Promise<unknown> {
  return withRlsContext(ctx, async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true, status: true },
    });

    if (!employee) {
      throw new EmployeeError('Colaborador não encontrado', 404);
    }

    const currentStatus = employee.status as EmployeeStatus;
    const newStatus = input.newStatus as EmployeeStatus;
    const allowed = VALID_TRANSITIONS[currentStatus];

    if (!allowed.includes(newStatus)) {
      throw new EmployeeError(
        `Transição inválida: ${currentStatus} → ${newStatus}. Transições permitidas: ${allowed.join(', ') || 'nenhuma (estado terminal)'}`,
        400,
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'DESLIGADO') {
      updateData.terminationDate = new Date();
    }

    const [updated] = await Promise.all([
      tx.employee.update({
        where: { id },
        data: updateData as Parameters<typeof tx.employee.update>[0]['data'],
      }),
      tx.employeeStatusHistory.create({
        data: {
          employeeId: id,
          fromStatus: currentStatus,
          toStatus: newStatus,
          reason: input.reason,
          changedBy: ctx.userId ?? 'system',
        },
      }),
    ]);

    return updated;
  });
}

// ─── Dependents ──────────────────────────────────────────────────────

export async function addDependent(
  ctx: RlsContext,
  employeeId: string,
  input: CreateDependentInput,
): Promise<unknown> {
  // Validate: CPF required when irrf or salaryFamily
  if ((input.irrf || input.salaryFamily) && !input.cpf) {
    throw new EmployeeError(
      'CPF é obrigatório para dependentes marcados para IRRF ou salário família',
      400,
    );
  }

  return withRlsContext(ctx, async (tx) => {
    // Verify employee belongs to org
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new EmployeeError('Colaborador não encontrado', 404);
    }

    return tx.employeeDependent.create({
      data: {
        employeeId,
        name: input.name,
        cpf: input.cpf,
        birthDate: new Date(input.birthDate),
        relationship: input.relationship,
        irrf: input.irrf ?? false,
        salaryFamily: input.salaryFamily ?? false,
      },
    });
  });
}

export async function removeDependent(
  ctx: RlsContext,
  dependentId: string,
): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    // Verify the dependent belongs to an employee in this org
    const dependent = await tx.employeeDependent.findFirst({
      where: {
        id: dependentId,
        employee: { organizationId: ctx.organizationId },
      },
      select: { id: true },
    });
    if (!dependent) {
      throw new EmployeeError('Dependente não encontrado', 404);
    }

    await tx.employeeDependent.delete({ where: { id: dependentId } });
  });
}

// ─── Farm Associations ───────────────────────────────────────────────

export async function addFarmAssociation(
  ctx: RlsContext,
  employeeId: string,
  input: AddFarmAssocInput,
): Promise<unknown> {
  return withRlsContext(ctx, async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new EmployeeError('Colaborador não encontrado', 404);
    }

    return tx.employeeFarm.create({
      data: {
        employeeId,
        farmId: input.farmId,
        positionId: input.positionId,
        startDate: input.startDate ? new Date(input.startDate) : new Date(),
      },
    });
  });
}

export async function removeFarmAssociation(
  ctx: RlsContext,
  farmAssocId: string,
): Promise<unknown> {
  return withRlsContext(ctx, async (tx) => {
    const assoc = await tx.employeeFarm.findFirst({
      where: {
        id: farmAssocId,
        employee: { organizationId: ctx.organizationId },
      },
      select: { id: true },
    });
    if (!assoc) {
      throw new EmployeeError('Associação com fazenda não encontrada', 404);
    }

    return tx.employeeFarm.update({
      where: { id: farmAssocId },
      data: { endDate: new Date(), status: 'ENCERRADO' },
    });
  });
}

// ─── Documents ───────────────────────────────────────────────────────

export async function uploadDocument(
  ctx: RlsContext,
  employeeId: string,
  file: Express.Multer.File,
  input: EmployeeDocumentInput,
): Promise<unknown> {
  return withRlsContext(ctx, async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new EmployeeError('Colaborador não encontrado', 404);
    }

    return tx.employeeDocument.create({
      data: {
        employeeId,
        documentType: input.documentType,
        fileName: file.originalname,
        filePath: file.path,
        uploadedBy: ctx.userId ?? 'system',
      },
    });
  });
}

export async function deleteDocument(
  ctx: RlsContext,
  documentId: string,
): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const doc = await tx.employeeDocument.findFirst({
      where: {
        id: documentId,
        employee: { organizationId: ctx.organizationId },
      },
      select: { id: true, filePath: true },
    });
    if (!doc) {
      throw new EmployeeError('Documento não encontrado', 404);
    }

    await tx.employeeDocument.delete({ where: { id: documentId } });

    // Delete file from disk (best-effort)
    try {
      if (fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
      }
    } catch {
      // Don't fail if file can't be removed
    }
  });
}

// ─── Salary History ──────────────────────────────────────────────────

export async function getSalaryHistory(
  ctx: RlsContext,
  employeeId: string,
): Promise<unknown[]> {
  return withRlsContext(ctx, async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new EmployeeError('Colaborador não encontrado', 404);
    }

    return tx.employeeSalaryHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveAt: 'asc' },
    });
  });
}

// ─── Internal helper for salary movement (both EmployeeMovement + EmployeeSalaryHistory) ─

export async function createSalaryMovement(
  tx: TxClient,
  employeeId: string,
  salary: number,
  effectiveAt: Date,
  reason: string,
  createdBy: string,
  approvedBy?: string,
): Promise<void> {
  await Promise.all([
    tx.employeeMovement.create({
      data: {
        employeeId,
        movementType: 'SALARY_ADJUSTMENT',
        effectiveAt,
        toValue: String(salary),
        reason,
        approvedBy,
        createdBy,
      },
    }),
    tx.employeeSalaryHistory.create({
      data: {
        employeeId,
        salary,
        effectiveAt,
        movementType: 'SALARY_ADJUSTMENT',
        reason,
      },
    }),
  ]);
}
