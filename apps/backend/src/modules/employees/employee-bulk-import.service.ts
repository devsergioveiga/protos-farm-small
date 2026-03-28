import ExcelJS from 'exceljs';
import { prisma } from '../../database/prisma';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { isValidCPF, isValidPIS, cleanDocument } from '../../shared/utils/document-validator';
import { parseEmployeeFile } from './employee-file-parser';
import type { CreateEmployeeInput } from './employees.types';

export { isValidCPF, isValidPIS };

// ─── Types ──────────────────────────────────────────────────────────

export type RowStatus = 'valid' | 'error' | 'warning';

export interface PreviewRow {
  rowNumber: number;
  status: RowStatus;
  messages: string[];
  data: Partial<EmployeeImportData>;
}

export interface EmployeeImportData {
  name: string;
  cpf: string;
  rg?: string;
  pisPassep?: string;
  birthDate?: string;
  admissionDate?: string;
  positionName?: string;
  salary?: number;
  phone?: string;
  email?: string;
  bankCode?: string;
  bankAgency?: string;
  bankAccount?: string;
  bankAccountType?: 'CORRENTE' | 'POUPANCA';
  initialVacationBalance?: number;
  initialHourBankBalance?: number;
}

export interface UploadResult {
  columnHeaders: string[];
  sampleRows: Record<string, string | number | null>[];
  totalRows: number;
}

export interface PreviewResult {
  validRows: PreviewRow[];
  errorRows: PreviewRow[];
  warningRows: PreviewRow[];
  totalRows: number;
}

export interface ConfirmResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
}

// ─── Upload & Parse ──────────────────────────────────────────────────

export async function uploadAndParse(
  _ctx: RlsContext,
  file: Express.Multer.File,
): Promise<UploadResult> {
  const parsed = await parseEmployeeFile(file.buffer, file.originalname);

  const sampleRows = parsed.rows.slice(0, 5).map((r) => r.raw);

  return {
    columnHeaders: parsed.columnHeaders,
    sampleRows,
    totalRows: parsed.rows.length,
  };
}

// ─── Preview ─────────────────────────────────────────────────────────

function normalizeKey(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s-]+/g, '_');
}

function parseBankAccountType(raw: string): 'CORRENTE' | 'POUPANCA' | undefined {
  const key = normalizeKey(raw);
  if (key === 'corrente' || key === 'cc' || key === 'conta_corrente') return 'CORRENTE';
  if (key === 'poupanca' || key === 'poupança' || key === 'cp' || key === 'conta_poupanca')
    return 'POUPANCA';
  return undefined;
}

export async function previewBulkImport(
  ctx: RlsContext,
  data: {
    rows: Record<string, string>[];
    columnMapping: Record<string, string>;
  },
): Promise<PreviewResult> {
  const { rows, columnMapping } = data;

  // Build reverse mapping: systemField -> columnHeader
  const reverseMap: Record<string, string> = {};
  for (const [header, field] of Object.entries(columnMapping)) {
    reverseMap[field] = header;
  }

  function getField(row: Record<string, string>, field: string): string {
    const header = reverseMap[field];
    if (!header) return '';
    return (row[header] ?? '').trim();
  }

  // Fetch existing CPFs in org for duplicate check
  const existingCpfs = await prisma.employee.findMany({
    where: { organizationId: ctx.organizationId },
    select: { cpf: true },
  });
  const existingCpfSet = new Set(existingCpfs.map((e) => cleanDocument(e.cpf)));

  // Track CPFs seen in this batch
  const batchCpfSet = new Set<string>();

  const validRows: PreviewRow[] = [];
  const errorRows: PreviewRow[] = [];
  const warningRows: PreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? {};
    const rowNumber = i + 2; // 1-based + header row
    const errors: string[] = [];
    const warnings: string[] = [];
    const importData: Partial<EmployeeImportData> = {};

    // Required: name
    const name = getField(row, 'name');
    if (!name) {
      errors.push('Nome é obrigatório');
    } else {
      importData.name = name;
    }

    // Required: CPF
    const cpfRaw = getField(row, 'cpf');
    if (!cpfRaw) {
      errors.push('CPF é obrigatório');
    } else {
      if (!isValidCPF(cpfRaw)) {
        errors.push('CPF inválido');
      } else {
        const cleanedCpf = cleanDocument(cpfRaw);
        if (existingCpfSet.has(cleanedCpf)) {
          errors.push('CPF já cadastrado');
        } else if (batchCpfSet.has(cleanedCpf)) {
          errors.push('CPF duplicado no arquivo');
        } else {
          batchCpfSet.add(cleanedCpf);
          importData.cpf = cleanedCpf;
        }
      }
    }

    // Optional: RG
    const rg = getField(row, 'rg');
    if (rg) importData.rg = rg;

    // Optional: PIS/PASEP (warning only)
    const pis = getField(row, 'pis_pasep');
    if (pis) {
      if (!isValidPIS(pis)) {
        warnings.push('PIS/PASEP parece inválido');
      } else {
        importData.pisPassep = pis;
      }
    }

    // Required: birthDate
    const birthDateRaw = getField(row, 'data_nascimento');
    if (!birthDateRaw) {
      errors.push('Data de nascimento é obrigatória');
    } else {
      const date = new Date(birthDateRaw);
      if (isNaN(date.getTime())) {
        errors.push(`Data de nascimento inválida: "${birthDateRaw}". Use YYYY-MM-DD`);
      } else {
        importData.birthDate = date.toISOString().split('T')[0];
      }
    }

    // Required: admissionDate
    const admissionRaw = getField(row, 'data_admissao');
    if (!admissionRaw) {
      errors.push('Data de admissão é obrigatória');
    } else {
      const date = new Date(admissionRaw);
      if (isNaN(date.getTime())) {
        errors.push(`Data de admissão inválida: "${admissionRaw}". Use YYYY-MM-DD`);
      } else {
        importData.admissionDate = date.toISOString().split('T')[0];
      }
    }

    // Optional: position name
    const cargo = getField(row, 'cargo');
    if (cargo) importData.positionName = cargo;

    // Optional: salary
    const salarioRaw = getField(row, 'salario');
    if (salarioRaw) {
      const num = parseFloat(salarioRaw.replace(',', '.'));
      if (!isNaN(num) && num >= 0) {
        importData.salary = num;
      }
    }

    // Optional: phone
    const phone = getField(row, 'telefone');
    if (phone) importData.phone = phone;

    // Optional: email
    const email = getField(row, 'email');
    if (email) importData.email = email;

    // Optional: bank fields
    const banco = getField(row, 'banco');
    if (banco) importData.bankCode = banco;
    const agencia = getField(row, 'agencia');
    if (agencia) importData.bankAgency = agencia;
    const conta = getField(row, 'conta');
    if (conta) importData.bankAccount = conta;
    const tipoConta = getField(row, 'tipo_conta');
    if (tipoConta) {
      importData.bankAccountType = parseBankAccountType(tipoConta);
    }

    // Optional: saldo_ferias
    const saldoFerias = getField(row, 'saldo_ferias');
    if (saldoFerias) {
      const num = parseFloat(saldoFerias.replace(',', '.'));
      if (!isNaN(num)) importData.initialVacationBalance = num;
    }

    // Optional: banco_horas
    const bancoHoras = getField(row, 'banco_horas');
    if (bancoHoras) {
      const num = parseFloat(bancoHoras.replace(',', '.'));
      if (!isNaN(num)) importData.initialHourBankBalance = num;
    }

    // Determine row status
    let status: RowStatus;
    let allMessages: string[];

    if (errors.length > 0) {
      status = 'error';
      allMessages = [...errors, ...warnings];
      errorRows.push({ rowNumber, status, messages: allMessages, data: importData });
    } else if (warnings.length > 0) {
      status = 'warning';
      allMessages = warnings;
      warningRows.push({ rowNumber, status, messages: allMessages, data: importData });
    } else {
      status = 'valid';
      allMessages = [];
      validRows.push({ rowNumber, status, messages: allMessages, data: importData });
    }
  }

  return {
    validRows,
    errorRows,
    warningRows,
    totalRows: rows.length,
  };
}

// ─── Confirm ─────────────────────────────────────────────────────────

export async function confirmBulkImport(
  ctx: RlsContext,
  data: {
    rows: Array<Partial<EmployeeImportData> & { rowNumber: number }>;
  },
): Promise<ConfirmResult> {
  const { rows } = data;
  let created = 0;
  const errors: Array<{ row: number; message: string }> = [];

  // Process in batches within transaction
  await withRlsContext(ctx, async (tx) => {
    for (const row of rows) {
      const { rowNumber, ...importData } = row;

      if (!importData.name || !importData.cpf || !importData.birthDate || !importData.admissionDate) {
        errors.push({ row: rowNumber, message: 'Dados obrigatórios ausentes' });
        continue;
      }

      try {
        const employeeInput: CreateEmployeeInput = {
          name: importData.name,
          cpf: importData.cpf,
          rg: importData.rg,
          pisPassep: importData.pisPassep,
          birthDate: importData.birthDate,
          admissionDate: importData.admissionDate,
          phone: importData.phone,
          email: importData.email,
          bankCode: importData.bankCode,
          bankAgency: importData.bankAgency,
          bankAccount: importData.bankAccount,
          bankAccountType: importData.bankAccountType,
          initialVacationBalance: importData.initialVacationBalance,
          initialHourBankBalance: importData.initialHourBankBalance,
          salary: importData.salary,
        };

        const emp = await tx.employee.create({
          data: {
            organizationId: ctx.organizationId,
            name: employeeInput.name,
            cpf: employeeInput.cpf,
            rg: employeeInput.rg,
            pisPassep: employeeInput.pisPassep,
            birthDate: new Date(employeeInput.birthDate),
            admissionDate: new Date(employeeInput.admissionDate),
            phone: employeeInput.phone,
            email: employeeInput.email,
            bankCode: employeeInput.bankCode,
            bankAgency: employeeInput.bankAgency,
            bankAccount: employeeInput.bankAccount,
            bankAccountType: employeeInput.bankAccountType as 'CORRENTE' | 'POUPANCA' | undefined,
            initialVacationBalance: employeeInput.initialVacationBalance,
            initialHourBankBalance: employeeInput.initialHourBankBalance,
            nationality: 'Brasileiro',
            hasDisability: false,
            createdBy: ctx.userId ?? 'system',
          },
        });

        // Create initial salary history
        if (employeeInput.salary !== undefined && employeeInput.salary > 0) {
          await tx.employeeSalaryHistory.create({
            data: {
              employeeId: emp.id,
              salary: employeeInput.salary,
              effectiveAt: new Date(employeeInput.admissionDate),
              movementType: 'SALARY_ADJUSTMENT',
              reason: 'Salário inicial — importação em massa',
            },
          });
        }

        created++;
      } catch (err) {
        errors.push({
          row: rowNumber,
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }
  });

  return { created, errors };
}

// ─── Template ─────────────────────────────────────────────────────────

export async function generateTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Colaboradores');

  const headers = [
    'nome',
    'cpf',
    'rg',
    'pis_pasep',
    'data_nascimento',
    'data_admissao',
    'cargo',
    'salario',
    'telefone',
    'email',
    'banco',
    'agencia',
    'conta',
    'tipo_conta',
    'saldo_ferias',
    'banco_horas',
  ];

  // Set header row with bold styling
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9EAD3' },
  };

  // Add sample row
  sheet.addRow([
    'João da Silva',
    '529.982.247-25',
    '1234567',
    '123.45678.90-0',
    '1990-05-15',
    '2024-03-01',
    'Operador Rural',
    '2200.00',
    '(11) 99999-9999',
    'joao@email.com',
    '001',
    '1234',
    '56789-0',
    'CORRENTE',
    '15',
    '8',
  ]);

  // Set column widths
  const colWidths = [30, 18, 12, 16, 16, 16, 25, 12, 16, 30, 8, 10, 12, 12, 14, 12];
  headers.forEach((_, idx) => {
    const col = sheet.getColumn(idx + 1);
    col.width = colWidths[idx] ?? 15;
  });

   
  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}
