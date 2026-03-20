import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import type { CreateAssetInput } from './assets.types';
import { createAsset } from './assets.service';

// ─── Asset type normalization map ────────────────────────────────────────

const ASSET_TYPE_MAP: Record<string, string> = {
  maquina: 'MAQUINA',
  máquina: 'MAQUINA',
  veiculo: 'VEICULO',
  veículo: 'VEICULO',
  implemento: 'IMPLEMENTO',
  benfeitoria: 'BENFEITORIA',
  terra: 'TERRA',
  equipamento: 'EQUIPAMENTO',
  // English fallbacks
  machine: 'MAQUINA',
  vehicle: 'VEICULO',
  implement: 'IMPLEMENTO',
  improvement: 'BENFEITORIA',
  land: 'TERRA',
  equipment: 'EQUIPAMENTO',
};

const CLASSIFICATION_MAP: Record<string, string> = {
  depreciavel: 'DEPRECIABLE_CPC27',
  depreciável: 'DEPRECIABLE_CPC27',
  depreciable: 'DEPRECIABLE_CPC27',
  depreciavel_cpc27: 'DEPRECIABLE_CPC27',
  cpc27_depreciavel: 'DEPRECIABLE_CPC27',
  cpc_27_depreciavel: 'DEPRECIABLE_CPC27',
  nao_depreciavel: 'NON_DEPRECIABLE_CPC27',
  não_depreciavel: 'NON_DEPRECIABLE_CPC27',
  non_depreciable: 'NON_DEPRECIABLE_CPC27',
  nao_depreciavel_cpc27: 'NON_DEPRECIABLE_CPC27',
  cpc27_nao_depreciavel: 'NON_DEPRECIABLE_CPC27',
  valor_justo: 'FAIR_VALUE_CPC29',
  fair_value: 'FAIR_VALUE_CPC29',
  cpc29: 'FAIR_VALUE_CPC29',
  planta_portadora: 'BEARER_PLANT_CPC27',
  bearer_plant: 'BEARER_PLANT_CPC27',
  // Direct enum values
  depreciable_cpc27: 'DEPRECIABLE_CPC27',
  non_depreciable_cpc27: 'NON_DEPRECIABLE_CPC27',
  fair_value_cpc29: 'FAIR_VALUE_CPC29',
  bearer_plant_cpc27: 'BEARER_PLANT_CPC27',
};

// ─── Types ──────────────────────────────────────────────────────────────

export interface AssetPreviewRow {
  rowNumber: number;
  data: Partial<CreateAssetInput>;
  valid: boolean;
  errors: string[];
}

export interface PreviewResult {
  valid: AssetPreviewRow[];
  invalid: AssetPreviewRow[];
  totalValid: number;
  totalInvalid: number;
}

export interface ConfirmResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; error: string }[];
}

// ─── Normalizers ─────────────────────────────────────────────────────────

function normalizeKey(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s-]+/g, '_');
}

function resolveAssetType(raw: string): string | null {
  const key = normalizeKey(raw);
  return ASSET_TYPE_MAP[key] ?? null;
}

function resolveClassification(raw: string, assetType: string): string | null {
  // TERRA is always NON_DEPRECIABLE_CPC27
  if (assetType === 'TERRA') return 'NON_DEPRECIABLE_CPC27';

  const key = normalizeKey(raw);
  return CLASSIFICATION_MAP[key] ?? null;
}

// ─── Preview ─────────────────────────────────────────────────────────────

export async function previewAssetImport(
  ctx: RlsContext,
  rows: Record<string, string>[],
  columnMapping: Record<string, string>,
): Promise<PreviewResult> {
  // Build reverse mapping: systemField -> headerName
  const reverseMap: Record<string, string> = {};
  for (const [header, field] of Object.entries(columnMapping)) {
    reverseMap[field] = header;
  }

  // Fetch farms for name resolution
  const farms = await prisma.farm.findMany({
    where: { organizationId: ctx.organizationId },
    select: { id: true, name: true },
  });

  const farmsByNameLower = new Map<string, string>();
  for (const farm of farms) {
    farmsByNameLower.set(farm.name.toLowerCase().trim(), farm.id);
  }

  // Fetch cost centers (scoped to org farms)
  const farmIds = farms.map((f) => f.id);
  const costCenters = await prisma.costCenter.findMany({
    where: { farmId: { in: farmIds } },
    select: { id: true, name: true },
  });

  const ccByNameLower = new Map<string, string>();
  for (const cc of costCenters) {
    ccByNameLower.set(cc.name.toLowerCase().trim(), cc.id);
  }

  const validRows: AssetPreviewRow[] = [];
  const invalidRows: AssetPreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? {};
    const errors: string[] = [];
    const data: Partial<CreateAssetInput> = {};
    const rowNumber = i + 2; // 1-based + header row offset

    // Extract value by system field via reverse mapping
    function getField(field: string): string {
      const header = reverseMap[field];
      if (!header) return '';
      return (row[header] ?? '').trim();
    }

    // name (required)
    const name = getField('name');
    if (!name) {
      errors.push('Nome e obrigatorio');
    } else {
      data.name = name;
    }

    // assetType (required)
    const rawType = getField('assetType');
    if (!rawType) {
      errors.push('Tipo e obrigatorio');
    } else {
      const resolvedType = resolveAssetType(rawType);
      if (!resolvedType) {
        errors.push(
          `Tipo invalido: "${rawType}". Use: MAQUINA, VEICULO, IMPLEMENTO, BENFEITORIA, TERRA`,
        );
      } else {
        data.assetType = resolvedType as CreateAssetInput['assetType'];
      }
    }

    // classification (required, except TERRA which auto-sets)
    const rawClass = getField('classification');
    const effectiveType = data.assetType ?? '';
    if (effectiveType === 'TERRA') {
      data.classification = 'NON_DEPRECIABLE_CPC27' as CreateAssetInput['classification'];
    } else if (!rawClass) {
      errors.push('Classificacao CPC e obrigatoria');
    } else {
      const resolvedClass = resolveClassification(rawClass, effectiveType);
      if (!resolvedClass) {
        errors.push(
          `Classificacao invalida: "${rawClass}". Use: DEPRECIABLE_CPC27, NON_DEPRECIABLE_CPC27, FAIR_VALUE_CPC29, BEARER_PLANT_CPC27`,
        );
      } else {
        data.classification = resolvedClass as CreateAssetInput['classification'];
      }
    }

    // farmId (required)
    const farmRaw = getField('farmId');
    if (!farmRaw) {
      errors.push('Fazenda e obrigatoria');
    } else {
      // Try to resolve by name first, then by ID
      const farmId =
        farmsByNameLower.get(farmRaw.toLowerCase()) ??
        farms.find((f) => f.id === farmRaw)?.id ??
        null;
      if (!farmId) {
        errors.push(`Fazenda nao encontrada: "${farmRaw}"`);
      } else {
        data.farmId = farmId;
      }
    }

    // Optional: acquisitionDate
    const acqDateRaw = getField('acquisitionDate');
    if (acqDateRaw) {
      const date = new Date(acqDateRaw);
      if (isNaN(date.getTime())) {
        errors.push(`Data de aquisicao invalida: "${acqDateRaw}". Use formato YYYY-MM-DD`);
      } else {
        data.acquisitionDate = acqDateRaw;
      }
    }

    // Optional: acquisitionValue
    const acqValueRaw = getField('acquisitionValue');
    if (acqValueRaw) {
      const num = parseFloat(acqValueRaw.replace(',', '.'));
      if (isNaN(num) || num < 0) {
        errors.push(`Valor de aquisicao invalido: "${acqValueRaw}". Use numero positivo`);
      } else {
        data.acquisitionValue = String(num);
      }
    }

    // Optional: serialNumber
    const serial = getField('serialNumber');
    if (serial) data.serialNumber = serial;

    // Optional: manufacturer
    const mfr = getField('manufacturer');
    if (mfr) data.manufacturer = mfr;

    // Optional: model
    const model = getField('model');
    if (model) data.model = model;

    // Optional: yearOfManufacture
    const yearRaw = getField('yearOfManufacture');
    if (yearRaw) {
      const year = parseInt(yearRaw, 10);
      if (isNaN(year) || year < 1800 || year > new Date().getFullYear() + 1) {
        errors.push(`Ano de fabricacao invalido: "${yearRaw}"`);
      } else {
        data.yearOfManufacture = year;
      }
    }

    // Optional: costCenterId (resolve by name)
    const ccRaw = getField('costCenterId');
    if (ccRaw) {
      const ccId =
        ccByNameLower.get(ccRaw.toLowerCase()) ??
        costCenters.find((c) => c.id === ccRaw)?.id ??
        null;
      if (ccId) {
        data.costCenterId = ccId;
      }
      // cc not found is non-critical — skip without error
    }

    // Optional: assetTag (custom tag override)
    const tag = getField('assetTag');
    if (tag) {
      // Custom tag provided — will be used if no conflict (handled in confirm)
      // Store in description for now, actual tag gen happens in confirm
      // Just validate format if needed
    }

    // Optional: description
    const desc = getField('description');
    if (desc) data.description = desc;

    // Optional: notes
    const notes = getField('notes');
    if (notes) data.notes = notes;

    // Optional: invoiceNumber
    const invoice = getField('invoiceNumber');
    if (invoice) data.invoiceNumber = invoice;

    // Optional type-specific fields
    if (effectiveType === 'VEICULO' || effectiveType === 'MAQUINA') {
      const fuelType = getField('fuelType');
      if (fuelType) data.fuelType = fuelType;
    }

    if (effectiveType === 'MAQUINA') {
      const hpRaw = getField('engineHp');
      if (hpRaw) {
        const hp = parseFloat(hpRaw.replace(',', '.'));
        if (!isNaN(hp)) data.engineHp = String(hp);
      }
    }

    if (effectiveType === 'VEICULO') {
      const plate = getField('licensePlate');
      if (plate) data.licensePlate = plate;
      const renavam = getField('renavamCode');
      if (renavam) data.renavamCode = renavam;
    }

    if (effectiveType === 'BENFEITORIA') {
      const material = getField('constructionMaterial');
      if (material) data.constructionMaterial = material;
      const areaM2Raw = getField('areaM2');
      if (areaM2Raw) {
        const area = parseFloat(areaM2Raw.replace(',', '.'));
        if (!isNaN(area)) data.areaM2 = String(area);
      }
      const capacity = getField('capacity');
      if (capacity) data.capacity = capacity;
    }

    if (effectiveType === 'TERRA') {
      const regNum = getField('registrationNumber');
      if (regNum) data.registrationNumber = regNum;
      const areaHaRaw = getField('areaHa');
      if (areaHaRaw) {
        const area = parseFloat(areaHaRaw.replace(',', '.'));
        if (!isNaN(area)) data.areaHa = String(area);
      }
      const car = getField('carCode');
      if (car) data.carCode = car;
    }

    const previewRow: AssetPreviewRow = {
      rowNumber,
      data,
      valid: errors.length === 0,
      errors,
    };

    if (errors.length === 0) {
      validRows.push(previewRow);
    } else {
      invalidRows.push(previewRow);
    }
  }

  return {
    valid: validRows,
    invalid: invalidRows,
    totalValid: validRows.length,
    totalInvalid: invalidRows.length,
  };
}

// ─── Confirm ─────────────────────────────────────────────────────────────

export async function confirmAssetImport(
  ctx: RlsContext & { userId: string },
  validRows: AssetPreviewRow[],
): Promise<ConfirmResult> {
  let imported = 0;
  let failed = 0;
  const errors: { row: number; error: string }[] = [];

  for (const row of validRows) {
    if (!row.data.name || !row.data.assetType || !row.data.classification || !row.data.farmId) {
      failed++;
      errors.push({ row: row.rowNumber, error: 'Dados obrigatorios ausentes' });
      continue;
    }

    try {
      await createAsset(ctx, {
        name: row.data.name,
        assetType: row.data.assetType,
        classification: row.data.classification,
        farmId: row.data.farmId,
        description: row.data.description,
        acquisitionDate: row.data.acquisitionDate,
        acquisitionValue: row.data.acquisitionValue,
        supplierId: row.data.supplierId,
        invoiceNumber: row.data.invoiceNumber,
        costCenterId: row.data.costCenterId,
        serialNumber: row.data.serialNumber,
        manufacturer: row.data.manufacturer,
        model: row.data.model,
        yearOfManufacture: row.data.yearOfManufacture,
        engineHp: row.data.engineHp,
        fuelType: row.data.fuelType,
        renavamCode: row.data.renavamCode,
        licensePlate: row.data.licensePlate,
        constructionMaterial: row.data.constructionMaterial,
        areaM2: row.data.areaM2,
        capacity: row.data.capacity,
        registrationNumber: row.data.registrationNumber,
        areaHa: row.data.areaHa,
        carCode: row.data.carCode,
        notes: row.data.notes,
      });
      imported++;
    } catch (err) {
      failed++;
      errors.push({
        row: row.rowNumber,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }

  return {
    imported,
    skipped: 0,
    failed,
    errors,
  };
}

// ─── CSV Template ─────────────────────────────────────────────────────────

export function generateAssetCsvTemplate(): string {
  const headers = [
    'nome',
    'tipo',
    'classificacao_cpc',
    'fazenda',
    'data_aquisicao',
    'valor_aquisicao',
    'numero_serie',
    'fabricante',
    'modelo',
    'ano',
    'centro_custo',
    'descricao',
    'observacoes',
  ].join(',');

  const examples = [
    [
      'Trator John Deere 6195R',
      'MAQUINA',
      'DEPRECIABLE_CPC27',
      'Fazenda Sao Joao',
      '2024-03-15',
      '250000.00',
      'JD-2024-001',
      'John Deere',
      '6195R',
      '2024',
      'Mecanizacao',
      'Trator de grande porte',
      '',
    ].join(','),
    [
      'Caminhao VW Delivery',
      'VEICULO',
      'DEPRECIABLE_CPC27',
      'Fazenda Sao Joao',
      '2023-07-01',
      '180000.00',
      'VW-2023-001',
      'Volkswagen',
      'Delivery 9.170',
      '2023',
      'Logistica',
      '',
      '',
    ].join(','),
    [
      'Silo de Graos',
      'BENFEITORIA',
      'DEPRECIABLE_CPC27',
      'Fazenda Sao Joao',
      '2022-01-10',
      '350000.00',
      '',
      '',
      '',
      '2022',
      'Infraestrutura',
      'Silo metalico 500 toneladas',
      '',
    ].join(','),
  ];

  return [headers, ...examples].join('\n');
}
