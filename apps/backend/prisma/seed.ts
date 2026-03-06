import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const pgUser = process.env.POSTGRES_USER ?? 'protos';
const pgPassword = process.env.POSTGRES_PASSWORD ?? 'protos';
const pgHost = process.env.POSTGRES_HOST ?? 'localhost';
const pgPort = process.env.POSTGRES_PORT ?? '5450';
const pgDb = process.env.POSTGRES_DB ?? 'protos_farm';
const connectionString = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}?schema=public`;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('Test@1234', 12);

// ─── Dados das Organizações ──────────────────────────────────────────

const organizations = [
  {
    id: 'a1b2c3d4-0001-4000-8000-000000000001',
    name: 'Agropecuária Bom Futuro Ltda',
    type: 'PJ' as const,
    document: '12.345.678/0001-90',
    plan: 'premium',
    status: 'ACTIVE' as const,
    maxUsers: 20,
    maxFarms: 10,
  },
  {
    id: 'a1b2c3d4-0002-4000-8000-000000000002',
    name: 'João Carlos Mendes',
    type: 'PF' as const,
    document: '123.456.789-09',
    plan: 'basic',
    status: 'ACTIVE' as const,
    maxUsers: 10,
    maxFarms: 5,
    allowMultipleSessions: false,
  },
];

// ─── Dados dos Usuários ──────────────────────────────────────────────

const users = [
  // SUPER_ADMIN — Admin de plataforma (sem organização)
  {
    id: 'b1b2c3d4-0001-4000-8000-000000000001',
    email: 'admin@protosfarm.com.br',
    name: 'Admin Protos Farm',
    role: 'SUPER_ADMIN' as const,
    phone: '+55 65 99901-0001',
    organizationId: null,
  },
  {
    id: 'b1b2c3d4-0002-4000-8000-000000000002',
    email: 'maria.admin@bomfuturo.agro.br',
    name: 'Maria Fernanda Costa',
    role: 'ADMIN' as const,
    phone: '+55 65 99901-0002',
    organizationId: organizations[0].id,
  },
  {
    id: 'b1b2c3d4-0003-4000-8000-000000000003',
    email: 'pedro.gerente@bomfuturo.agro.br',
    name: 'Pedro Henrique Almeida',
    role: 'MANAGER' as const,
    phone: '+55 65 99901-0003',
    organizationId: organizations[0].id,
  },
  {
    id: 'b1b2c3d4-0004-4000-8000-000000000004',
    email: 'ana.agronoma@bomfuturo.agro.br',
    name: 'Ana Beatriz Oliveira',
    role: 'AGRONOMIST' as const,
    phone: '+55 65 99901-0004',
    organizationId: organizations[0].id,
  },
  {
    id: 'b1b2c3d4-0005-4000-8000-000000000005',
    email: 'roberto.financeiro@bomfuturo.agro.br',
    name: 'Roberto Nascimento',
    role: 'FINANCIAL' as const,
    phone: '+55 65 99901-0005',
    organizationId: organizations[0].id,
  },
  {
    id: 'b1b2c3d4-0006-4000-8000-000000000006',
    email: 'jose.operador@bomfuturo.agro.br',
    name: 'José Aparecido Santos',
    role: 'OPERATOR' as const,
    phone: '+55 65 99901-0006',
    organizationId: organizations[0].id,
  },
  {
    id: 'b1b2c3d4-0007-4000-8000-000000000007',
    email: 'antonio.peao@bomfuturo.agro.br',
    name: 'Antônio Ribeiro',
    role: 'COWBOY' as const,
    phone: '+55 65 99901-0007',
    organizationId: organizations[0].id,
  },
  // Org 2 — João Carlos Mendes (PF)
  {
    id: 'b1b2c3d4-0008-4000-8000-000000000008',
    email: 'joao.mendes@gmail.com',
    name: 'João Carlos Mendes',
    role: 'ADMIN' as const,
    phone: '+55 11 99801-0008',
    organizationId: organizations[1].id,
  },
];

// ─── Dados das Fazendas ──────────────────────────────────────────────

const farms = [
  // Org 1 — 3 fazendas
  {
    id: 'c1b2c3d4-0001-4000-8000-000000000001',
    name: 'Fazenda Santa Helena',
    nickname: 'Santa Helena',
    address: 'Rod. BR-163, Km 245',
    city: 'Sorriso',
    state: 'MT',
    zipCode: '78890-000',
    totalAreaHa: 5200.0,
    cib: 'MT-5107-8901-2345',
    incraCode: '907.005.012.345-0',
    carCode: 'MT-5107248-F8A9B1C2D3E4F5A6B7C8D9E0F1A2B3C4',
    status: 'ACTIVE' as const,
    organizationId: organizations[0].id,
    lng: -55.7144,
    lat: -12.5489,
  },
  {
    id: 'c1b2c3d4-0002-4000-8000-000000000002',
    name: 'Fazenda Três Irmãos',
    nickname: 'Três Irmãos',
    address: 'Estrada Municipal GO-174, Km 38',
    city: 'Rio Verde',
    state: 'GO',
    zipCode: '75901-000',
    totalAreaHa: 1800.5,
    cib: 'GO-5218-4567-8901',
    incraCode: '907.010.034.567-8',
    carCode: 'GO-5218805-A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6',
    status: 'ACTIVE' as const,
    organizationId: organizations[0].id,
    lng: -50.928,
    lat: -17.7923,
  },
  {
    id: 'c1b2c3d4-0003-4000-8000-000000000003',
    name: 'Fazenda Lagoa Dourada',
    nickname: 'Lagoa Dourada',
    address: 'Rod. MG-050, Km 112',
    city: 'Uberaba',
    state: 'MG',
    zipCode: '38050-000',
    totalAreaHa: 520.75,
    cib: 'MG-3170-2345-6789',
    incraCode: '907.015.056.789-2',
    carCode: 'MG-3170206-B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7',
    status: 'ACTIVE' as const,
    organizationId: organizations[0].id,
    lng: -47.9292,
    lat: -19.7472,
  },
  // Org 2 — 1 fazenda
  {
    id: 'c1b2c3d4-0004-4000-8000-000000000004',
    name: 'Sítio Recanto do Sol',
    nickname: 'Recanto',
    address: 'Estrada Municipal SP-225, Km 15',
    city: 'Jaú',
    state: 'SP',
    zipCode: '17201-000',
    totalAreaHa: 185.3,
    cib: 'SP-3525-6789-0123',
    incraCode: '907.020.078.901-4',
    carCode: 'SP-3525300-C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8',
    status: 'ACTIVE' as const,
    organizationId: organizations[1].id,
    lng: -48.558,
    lat: -22.2964,
  },
];

// ─── Matrículas das Fazendas ─────────────────────────────────────────

const farmRegistrations = [
  // Santa Helena — 2 matrículas
  {
    id: 'd1b2c3d4-0001-4000-8000-000000000001',
    farmId: farms[0].id,
    number: '15.234',
    cnsCode: '123456',
    cartorioName: '1º Cartório de Registro de Imóveis de Sorriso',
    comarca: 'Sorriso',
    state: 'MT',
    livro: '2-B',
    registrationDate: new Date('2015-03-12'),
    areaHa: 3200.0,
  },
  {
    id: 'd1b2c3d4-0002-4000-8000-000000000002',
    farmId: farms[0].id,
    number: '15.235',
    cartorioName: '1º Cartório de Registro de Imóveis de Sorriso',
    comarca: 'Sorriso',
    state: 'MT',
    livro: '2-B',
    registrationDate: new Date('2018-07-20'),
    areaHa: 2000.0,
  },
  // Três Irmãos — 1 matrícula
  {
    id: 'd1b2c3d4-0003-4000-8000-000000000003',
    farmId: farms[1].id,
    number: '8.901',
    cartorioName: '2º Cartório de Registro de Imóveis de Rio Verde',
    comarca: 'Rio Verde',
    state: 'GO',
    registrationDate: new Date('2020-11-05'),
    areaHa: 1800.5,
  },
  // Lagoa Dourada — 1 matrícula
  {
    id: 'd1b2c3d4-0004-4000-8000-000000000004',
    farmId: farms[2].id,
    number: '22.456',
    cnsCode: '789012',
    cartorioName: 'Cartório de Registro de Imóveis de Uberaba',
    comarca: 'Uberaba',
    state: 'MG',
    livro: '3-A',
    registrationDate: new Date('2012-01-18'),
    areaHa: 520.75,
  },
  // Recanto do Sol — 1 matrícula
  {
    id: 'd1b2c3d4-0005-4000-8000-000000000005',
    farmId: farms[3].id,
    number: '5.678',
    cartorioName: '1º Cartório de Registro de Imóveis de Jaú',
    comarca: 'Jaú',
    state: 'SP',
    registrationDate: new Date('2019-09-30'),
    areaHa: 185.3,
  },
];

// ─── Vínculos Usuário-Fazenda ────────────────────────────────────────

const userFarmAccess = [
  // ADMIN acessa todas as fazendas da org (SUPER_ADMIN não precisa de farm access)
  { userId: users[1].id, farmId: farms[0].id }, // Maria (ADMIN) → Santa Helena
  { userId: users[1].id, farmId: farms[1].id }, // Maria (ADMIN) → Três Irmãos
  { userId: users[1].id, farmId: farms[2].id }, // Maria (ADMIN) → Lagoa Dourada
  // MANAGER acessa todas
  { userId: users[2].id, farmId: farms[0].id }, // Pedro (MANAGER) → Santa Helena
  { userId: users[2].id, farmId: farms[1].id }, // Pedro (MANAGER) → Três Irmãos
  { userId: users[2].id, farmId: farms[2].id }, // Pedro (MANAGER) → Lagoa Dourada
  // AGRONOMIST acessa todas (precisa visitar todas)
  { userId: users[3].id, farmId: farms[0].id }, // Ana (AGRONOMIST) → Santa Helena
  { userId: users[3].id, farmId: farms[1].id }, // Ana (AGRONOMIST) → Três Irmãos
  { userId: users[3].id, farmId: farms[2].id }, // Ana (AGRONOMIST) → Lagoa Dourada
  // FINANCIAL acessa todas (gestão financeira global)
  { userId: users[4].id, farmId: farms[0].id }, // Roberto (FINANCIAL) → Santa Helena
  { userId: users[4].id, farmId: farms[1].id }, // Roberto (FINANCIAL) → Três Irmãos
  { userId: users[4].id, farmId: farms[2].id }, // Roberto (FINANCIAL) → Lagoa Dourada
  // OPERATOR e COWBOY acessam apenas suas fazendas
  { userId: users[5].id, farmId: farms[0].id }, // José (OPERATOR) → Santa Helena
  { userId: users[6].id, farmId: farms[0].id }, // Antônio (COWBOY) → Santa Helena
  // Org 2 — João acessa sua fazenda
  { userId: users[7].id, farmId: farms[3].id }, // João (ADMIN) → Recanto do Sol
];

// ─── Seed ────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // Bypass RLS para o seed poder inserir dados em todas as organizações
  await prisma.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'true', false)`);

  // Organizações
  for (const org of organizations) {
    await prisma.organization.upsert({
      where: { document: org.document },
      update: {
        name: org.name,
        type: org.type,
        plan: org.plan,
        status: org.status,
        maxUsers: org.maxUsers,
        maxFarms: org.maxFarms,
      },
      create: org,
    });
    console.log(`  ✓ Organização: ${org.name}`);
  }

  // Usuários
  for (const user of users) {
    const userData = { ...user, passwordHash: DEFAULT_PASSWORD_HASH };
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        phone: user.phone,
        organizationId: user.organizationId,
        passwordHash: DEFAULT_PASSWORD_HASH,
      },
      create: userData,
    });
    console.log(`  ✓ Usuário: ${user.name} (${user.role})`);
  }

  // Fazendas (sem location — campo Unsupported não é manipulável pelo Prisma Client)
  for (const farm of farms) {
    const farmData = {
      id: farm.id,
      name: farm.name,
      nickname: farm.nickname,
      address: farm.address,
      city: farm.city,
      state: farm.state,
      zipCode: farm.zipCode,
      totalAreaHa: farm.totalAreaHa,
      cib: farm.cib,
      incraCode: farm.incraCode,
      carCode: farm.carCode,
      status: farm.status,
      organizationId: farm.organizationId,
    };
    await prisma.farm.upsert({
      where: { id: farm.id },
      update: farmData,
      create: farmData,
    });
    console.log(`  ✓ Fazenda: ${farm.name} (${farm.state}, ${farm.totalAreaHa} ha)`);
  }

  // PostGIS — inserir coordenadas via raw SQL
  console.log('\n  Atualizando coordenadas PostGIS...');
  for (const farm of farms) {
    await prisma.$executeRawUnsafe(
      `UPDATE farms SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
      farm.lng,
      farm.lat,
      farm.id,
    );
    console.log(`  ✓ Coordenadas: ${farm.name} (${farm.lat}, ${farm.lng})`);
  }

  // Matrículas das Fazendas
  console.log('\n  Criando matrículas...');
  for (const reg of farmRegistrations) {
    await prisma.farmRegistration.upsert({
      where: { id: reg.id },
      update: {
        number: reg.number,
        cartorioName: reg.cartorioName,
        comarca: reg.comarca,
        state: reg.state,
        areaHa: reg.areaHa,
      },
      create: reg,
    });
    console.log(`  ✓ Matrícula: ${reg.number} (${reg.state})`);
  }

  // Vínculos Usuário-Fazenda
  console.log('');
  for (const access of userFarmAccess) {
    await prisma.userFarmAccess.upsert({
      where: {
        userId_farmId: {
          userId: access.userId,
          farmId: access.farmId,
        },
      },
      update: {},
      create: access,
    });
  }
  console.log(`  ✓ ${userFarmAccess.length} vínculos usuário-fazenda criados`);

  // ─── Produtores ──────────────────────────────────────────────────────
  console.log('\n  Criando produtores...');

  const producers = [
    // Org 1 — Carlos Eduardo Silva (PF, produtor proprietário)
    {
      id: 'e1b2c3d4-0001-4000-8000-000000000001',
      organizationId: organizations[0].id,
      type: 'PF' as const,
      name: 'Carlos Eduardo Silva',
      document: '529.982.247-25',
      birthDate: new Date('1975-06-15'),
      address: 'Rua das Palmeiras, 120',
      city: 'Sorriso',
      state: 'MT',
      zipCode: '78890-000',
      taxRegime: 'REAL' as const,
      ruralActivityType: 'Agricultura e Pecuária',
      status: 'ACTIVE' as const,
    },
    // Org 1 — Agropecuária Bom Futuro (PJ)
    {
      id: 'e1b2c3d4-0002-4000-8000-000000000002',
      organizationId: organizations[0].id,
      type: 'PJ' as const,
      name: 'Agropecuária Bom Futuro Ltda',
      tradeName: 'Bom Futuro',
      document: '12.345.678/0001-90',
      legalRepresentative: 'Carlos Eduardo Silva',
      legalRepCpf: '529.982.247-25',
      address: 'Rod. BR-163, Km 245',
      city: 'Sorriso',
      state: 'MT',
      zipCode: '78890-000',
      taxRegime: 'PRESUMIDO' as const,
      mainCnae: '0111-3/01',
      ruralActivityType: 'Cultivo de soja',
      status: 'ACTIVE' as const,
    },
    // Org 1 — Sociedade Irmãos Silva (SC)
    {
      id: 'e1b2c3d4-0003-4000-8000-000000000003',
      organizationId: organizations[0].id,
      type: 'SOCIEDADE_EM_COMUM' as const,
      name: 'Sociedade Irmãos Silva',
      address: 'Rod. MT-242, Km 30',
      city: 'Lucas do Rio Verde',
      state: 'MT',
      zipCode: '78455-000',
      taxRegime: 'SIMPLES' as const,
      ruralActivityType: 'Pecuária de corte',
      status: 'ACTIVE' as const,
    },
    // Org 2 — João Carlos Mendes (PF)
    {
      id: 'e1b2c3d4-0004-4000-8000-000000000004',
      organizationId: organizations[1].id,
      type: 'PF' as const,
      name: 'João Carlos Mendes',
      document: '123.456.789-09',
      birthDate: new Date('1982-03-22'),
      address: 'Estrada Municipal SP-225, Km 15',
      city: 'Jaú',
      state: 'SP',
      zipCode: '17201-000',
      taxRegime: 'ISENTO' as const,
      ruralActivityType: 'Citricultura',
      status: 'ACTIVE' as const,
    },
  ];

  for (const producer of producers) {
    await prisma.producer.upsert({
      where: { id: producer.id },
      update: { name: producer.name, status: producer.status },
      create: producer,
    });
    console.log(`  ✓ Produtor: ${producer.name} (${producer.type})`);
  }

  // ─── Participantes da Sociedade ────────────────────────────────────
  console.log('\n  Criando participantes da sociedade...');

  const participants = [
    {
      id: 'f1b2c3d4-0001-4000-8000-000000000001',
      producerId: producers[2].id, // Sociedade Irmãos Silva
      name: 'José Roberto Silva',
      cpf: '987.654.321-00',
      participationPct: 40,
      isMainResponsible: true,
    },
    {
      id: 'f1b2c3d4-0002-4000-8000-000000000002',
      producerId: producers[2].id,
      name: 'Marcos Antônio Silva',
      cpf: '456.789.123-00',
      participationPct: 35,
      isMainResponsible: false,
    },
    {
      id: 'f1b2c3d4-0003-4000-8000-000000000003',
      producerId: producers[2].id,
      name: 'Ana Paula Silva',
      cpf: '321.654.987-00',
      participationPct: 25,
      isMainResponsible: false,
    },
  ];

  for (const p of participants) {
    await prisma.societyParticipant.upsert({
      where: { id: p.id },
      update: { name: p.name, participationPct: p.participationPct },
      create: p,
    });
    console.log(`  ✓ Participante: ${p.name} (${p.participationPct}%)`);
  }

  // ─── Inscrições Estaduais (IEs) ───────────────────────────────────
  console.log('\n  Criando inscrições estaduais...');

  const stateRegistrations = [
    {
      id: 'g1b2c3d4-0001-4000-8000-000000000001',
      producerId: producers[0].id, // Carlos Eduardo
      farmId: farms[0].id, // Santa Helena
      number: '131234567',
      state: 'MT',
      situation: 'ACTIVE' as const,
      isDefaultForFarm: true,
      milkProgramOptIn: false,
    },
    {
      id: 'g1b2c3d4-0002-4000-8000-000000000002',
      producerId: producers[1].id, // Agropecuária Bom Futuro
      farmId: farms[1].id, // Três Irmãos
      number: '521234567890',
      state: 'GO',
      cnaeActivity: '0111-3/01 - Cultivo de arroz',
      situation: 'ACTIVE' as const,
      isDefaultForFarm: true,
      milkProgramOptIn: false,
    },
    {
      id: 'g1b2c3d4-0003-4000-8000-000000000003',
      producerId: producers[1].id, // Agropecuária Bom Futuro
      farmId: farms[2].id, // Lagoa Dourada
      number: '062345678901',
      state: 'MG',
      situation: 'ACTIVE' as const,
      isDefaultForFarm: true,
      milkProgramOptIn: true,
    },
    {
      id: 'g1b2c3d4-0004-4000-8000-000000000004',
      producerId: producers[2].id, // Sociedade Irmãos Silva
      number: '131234999',
      state: 'MT',
      situation: 'ACTIVE' as const,
      isDefaultForFarm: false,
      milkProgramOptIn: false,
    },
    {
      id: 'g1b2c3d4-0005-4000-8000-000000000005',
      producerId: producers[3].id, // João Carlos Mendes
      farmId: farms[3].id, // Recanto do Sol
      number: '35123456789',
      state: 'SP',
      situation: 'ACTIVE' as const,
      isDefaultForFarm: true,
      milkProgramOptIn: false,
    },
  ];

  for (const ie of stateRegistrations) {
    await prisma.producerStateRegistration.upsert({
      where: { id: ie.id },
      update: { number: ie.number, situation: ie.situation },
      create: ie,
    });
    console.log(`  ✓ IE: ${ie.number} (${ie.state})`);
  }

  // ─── Vínculos Produtor-Fazenda ─────────────────────────────────────
  console.log('\n  Criando vínculos produtor-fazenda...');

  const producerFarmLinks = [
    {
      id: 'h1b2c3d4-0001-4000-8000-000000000001',
      producerId: producers[0].id, // Carlos Eduardo → Santa Helena
      farmId: farms[0].id,
      bondType: 'PROPRIETARIO' as const,
      participationPct: 100,
      startDate: new Date('2020-01-01'),
      isItrDeclarant: true,
    },
    {
      id: 'h1b2c3d4-0002-4000-8000-000000000002',
      producerId: producers[1].id, // Agropecuária Bom Futuro → Três Irmãos
      farmId: farms[1].id,
      bondType: 'PROPRIETARIO' as const,
      participationPct: 100,
      startDate: new Date('2019-06-01'),
      isItrDeclarant: true,
    },
    {
      id: 'h1b2c3d4-0003-4000-8000-000000000003',
      producerId: producers[1].id, // Agropecuária Bom Futuro → Lagoa Dourada (arrendamento)
      farmId: farms[2].id,
      bondType: 'ARRENDATARIO' as const,
      participationPct: 80,
      startDate: new Date('2022-01-01'),
      endDate: new Date('2027-06-30'),
      isItrDeclarant: false,
    },
    {
      id: 'h1b2c3d4-0004-4000-8000-000000000004',
      producerId: producers[2].id, // Sociedade Irmãos Silva → Santa Helena
      farmId: farms[0].id,
      bondType: 'CONDOMINO' as const,
      participationPct: 30,
      startDate: new Date('2021-03-15'),
      isItrDeclarant: false,
    },
    {
      id: 'h1b2c3d4-0005-4000-8000-000000000005',
      producerId: producers[2].id, // Sociedade Irmãos Silva → Três Irmãos
      farmId: farms[1].id,
      bondType: 'MEEIRO' as const,
      participationPct: 50,
      startDate: new Date('2023-01-01'),
      isItrDeclarant: false,
    },
    {
      id: 'h1b2c3d4-0006-4000-8000-000000000006',
      producerId: producers[3].id, // João Carlos Mendes → Recanto do Sol
      farmId: farms[3].id,
      bondType: 'PROPRIETARIO' as const,
      participationPct: 100,
      startDate: new Date('2019-09-30'),
      isItrDeclarant: true,
    },
  ];

  for (const link of producerFarmLinks) {
    await prisma.producerFarmLink.upsert({
      where: { id: link.id },
      update: {
        bondType: link.bondType,
        startDate: link.startDate,
        endDate: (link as { endDate?: Date }).endDate ?? null,
        isItrDeclarant: link.isItrDeclarant,
      },
      create: link,
    });
  }
  console.log(`  ✓ ${producerFarmLinks.length} vínculos produtor-fazenda criados`);

  // ─── Vínculos Produtor-Fazenda → Matrículas ───────────────────────
  console.log('\n  Criando vínculos com matrículas...');

  const producerRegistrationLinks = [
    // Carlos Eduardo → Santa Helena → 2 matrículas
    { farmLinkId: producerFarmLinks[0].id, farmRegistrationId: farmRegistrations[0].id },
    { farmLinkId: producerFarmLinks[0].id, farmRegistrationId: farmRegistrations[1].id },
    // Agropecuária Bom Futuro → Três Irmãos → 1 matrícula
    { farmLinkId: producerFarmLinks[1].id, farmRegistrationId: farmRegistrations[2].id },
    // Sociedade Irmãos Silva → Santa Helena → matrícula 2
    { farmLinkId: producerFarmLinks[3].id, farmRegistrationId: farmRegistrations[1].id },
    // João Carlos Mendes → Recanto do Sol → 1 matrícula
    { farmLinkId: producerFarmLinks[5].id, farmRegistrationId: farmRegistrations[4].id },
  ];

  // Delete existing registration links to avoid duplicates on re-seed
  await prisma.producerRegistrationLink.deleteMany();
  for (const prl of producerRegistrationLinks) {
    await prisma.producerRegistrationLink.create({ data: prl });
  }
  console.log(`  ✓ ${producerRegistrationLinks.length} vínculos produtor-matrícula criados`);

  // ─── Boundaries (Perímetros) ──────────────────────────────────────
  console.log('\n  Inserindo perímetros de fazendas...');

  // Santa Helena: retângulo ~5200 ha em Sorriso/MT
  await prisma.$executeRawUnsafe(
    `
    UPDATE farms
    SET boundary = ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-55.78,-12.47],[-55.55,-12.47],[-55.55,-12.69],[-55.78,-12.69],[-55.78,-12.47]]]}'),
        "boundaryAreaHa" = ROUND((ST_Area(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-55.78,-12.47],[-55.55,-12.47],[-55.55,-12.69],[-55.78,-12.69],[-55.78,-12.47]]]}')::geography) / 10000)::numeric, 4)
    WHERE id = $1
  `,
    farms[0].id,
  );
  console.log('  ✓ Perímetro: Fazenda Santa Helena');

  // Recanto do Sol: retângulo ~185 ha em Jaú/SP
  await prisma.$executeRawUnsafe(
    `
    UPDATE farms
    SET boundary = ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-48.57,-22.29],[-48.555,-22.29],[-48.555,-22.30],[-48.57,-22.30],[-48.57,-22.29]]]}'),
        "boundaryAreaHa" = ROUND((ST_Area(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-48.57,-22.29],[-48.555,-22.29],[-48.555,-22.30],[-48.57,-22.30],[-48.57,-22.29]]]}')::geography) / 10000)::numeric, 4)
    WHERE id = $1
  `,
    farms[3].id,
  );
  console.log('  ✓ Perímetro: Sítio Recanto do Sol');

  // Matrícula 15.234 (Santa Helena): sub-polígono
  await prisma.$executeRawUnsafe(
    `
    UPDATE farm_registrations
    SET boundary = ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-55.78,-12.47],[-55.62,-12.47],[-55.62,-12.69],[-55.78,-12.69],[-55.78,-12.47]]]}'),
        "boundaryAreaHa" = ROUND((ST_Area(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-55.78,-12.47],[-55.62,-12.47],[-55.62,-12.69],[-55.78,-12.69],[-55.78,-12.47]]]}')::geography) / 10000)::numeric, 4)
    WHERE id = $1
  `,
    farmRegistrations[0].id,
  );
  console.log('  ✓ Perímetro: Matrícula 15.234 (Santa Helena)');

  // ─── Talhões (Field Plots) ────────────────────────────────────────
  console.log('\n  Criando talhões...');

  // Santa Helena boundary: [[-55.78,-12.47],[-55.55,-12.47],[-55.55,-12.69],[-55.78,-12.69]]
  // Create 3 plots inside this area
  const fieldPlots = [
    {
      id: 'fp-0001-4000-8000-000000000001',
      farmId: farms[0].id,
      registrationId: farmRegistrations[0].id, // Matrícula 15.234
      name: 'Talhão A1 — Soja',
      code: 'SH-A1',
      soilType: 'LATOSSOLO_VERMELHO',
      currentCrop: 'Soja',
      previousCrop: 'Milho',
      notes: 'Plantio direto, rotação soja/milho',
      // NW quadrant
      boundary:
        '{"type":"Polygon","coordinates":[[[-55.78,-12.47],[-55.67,-12.47],[-55.67,-12.58],[-55.78,-12.58],[-55.78,-12.47]]]}',
    },
    {
      id: 'fp-0001-4000-8000-000000000002',
      farmId: farms[0].id,
      registrationId: farmRegistrations[0].id,
      name: 'Talhão A2 — Milho',
      code: 'SH-A2',
      soilType: 'LATOSSOLO_VERMELHO',
      currentCrop: 'Milho',
      previousCrop: 'Soja',
      notes: 'Safrinha de milho',
      // NE quadrant
      boundary:
        '{"type":"Polygon","coordinates":[[[-55.67,-12.47],[-55.56,-12.47],[-55.56,-12.58],[-55.67,-12.58],[-55.67,-12.47]]]}',
    },
    {
      id: 'fp-0001-4000-8000-000000000003',
      farmId: farms[0].id,
      registrationId: farmRegistrations[1].id, // Matrícula 15.235
      name: 'Talhão B1 — Café',
      code: 'SH-B1',
      soilType: 'ARGISSOLO',
      currentCrop: 'Café',
      previousCrop: null,
      notes: 'Café arábica, área de encosta',
      // SW quadrant
      boundary:
        '{"type":"Polygon","coordinates":[[[-55.78,-12.58],[-55.67,-12.58],[-55.67,-12.69],[-55.78,-12.69],[-55.78,-12.58]]]}',
    },
  ];

  // Delete existing field plots to avoid duplicates on re-seed
  await prisma.$executeRawUnsafe(`DELETE FROM field_plots`);

  for (const plot of fieldPlots) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO field_plots (id, "farmId", "registrationId", name, code, "soilType", "currentCrop", "previousCrop", notes, boundary, "boundaryAreaHa", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::"SoilType", $7, $8, $9,
               ST_GeomFromGeoJSON($10),
               ROUND((ST_Area(ST_GeomFromGeoJSON($10)::geography) / 10000)::numeric, 4),
               'ACTIVE', now(), now())`,
      plot.id,
      plot.farmId,
      plot.registrationId,
      plot.name,
      plot.code,
      plot.soilType,
      plot.currentCrop,
      plot.previousCrop,
      plot.notes,
      plot.boundary,
    );
    console.log(`  ✓ Talhão: ${plot.name} (${plot.code})`);
  }

  // Field Plot Boundary Versions (historial de edição)
  console.log('');
  console.log('Inserindo histórico de edição de talhões...');

  await prisma.$executeRawUnsafe(`DELETE FROM field_plot_boundary_versions`);

  // Versão anterior do Talhão A1 (antes de edição no editor de mapa)
  await prisma.$executeRawUnsafe(
    `INSERT INTO field_plot_boundary_versions (id, "plotId", "farmId", boundary, "boundaryAreaHa", "editedBy", "editedAt", "editSource", version)
     VALUES ($1, $2, $3,
             ST_GeomFromGeoJSON($4),
             ROUND((ST_Area(ST_GeomFromGeoJSON($4)::geography) / 10000)::numeric, 4),
             $5, '2026-02-20T10:00:00Z', 'file_upload', 1)`,
    'fpbv-0001-4000-8000-000000000001',
    fieldPlots[0].id,
    farms[0].id,
    '{"type":"Polygon","coordinates":[[[-55.78,-12.48],[-55.68,-12.48],[-55.68,-12.57],[-55.78,-12.57],[-55.78,-12.48]]]}',
    users[0].id,
  );
  console.log('  ✓ Versão 1 do Talhão A1 (upload original)');

  // Segunda versão (edição via mapa)
  await prisma.$executeRawUnsafe(
    `INSERT INTO field_plot_boundary_versions (id, "plotId", "farmId", boundary, "boundaryAreaHa", "editedBy", "editedAt", "editSource", version)
     VALUES ($1, $2, $3,
             ST_GeomFromGeoJSON($4),
             ROUND((ST_Area(ST_GeomFromGeoJSON($4)::geography) / 10000)::numeric, 4),
             $5, '2026-02-25T14:30:00Z', 'map_editor', 2)`,
    'fpbv-0001-4000-8000-000000000002',
    fieldPlots[0].id,
    farms[0].id,
    '{"type":"Polygon","coordinates":[[[-55.78,-12.47],[-55.67,-12.47],[-55.67,-12.57],[-55.78,-12.57],[-55.78,-12.47]]]}',
    users[0].id,
  );
  console.log('  ✓ Versão 2 do Talhão A1 (edição via mapa)');

  // ─── Safras (Plot Crop Seasons) ─────────────────────────────────────
  console.log('\n  Criando safras dos talhões...');

  await prisma.$executeRawUnsafe(`DELETE FROM plot_crop_seasons`);
  await prisma.$executeRawUnsafe(`DELETE FROM plot_soil_analyses`);

  const cropSeasons = [
    {
      id: 'pcs-0001-4000-8000-000000000001',
      plotId: fieldPlots[0].id, // Talhão A1 — Soja
      farmId: farms[0].id,
      seasonType: 'SAFRA',
      seasonYear: '2024/2025',
      crop: 'Soja',
      varietyName: 'TMG 2381 IPRO',
      startDate: new Date('2024-10-15'),
      endDate: new Date('2025-02-28'),
      plantedAreaHa: 1300,
      productivityKgHa: 3600,
      totalProductionKg: 4680000,
      operations: JSON.stringify([
        { date: '2024-10-15', type: 'plantio', description: 'Plantio direto' },
        { date: '2024-12-01', type: 'pulverização', description: 'Fungicida' },
        { date: '2025-02-28', type: 'colheita', description: 'Colheita mecanizada' },
      ]),
      notes: 'Boa produtividade, sem perdas significativas',
      createdBy: users[3].id, // Ana (AGRONOMIST)
    },
    {
      id: 'pcs-0001-4000-8000-000000000002',
      plotId: fieldPlots[0].id, // Talhão A1 — safrinha anterior
      farmId: farms[0].id,
      seasonType: 'SAFRINHA',
      seasonYear: '2024',
      crop: 'Milho',
      varietyName: 'AG 9025 PRO3',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-07-15'),
      plantedAreaHa: 1300,
      productivityKgHa: 5400,
      totalProductionKg: 7020000,
      operations: JSON.stringify([]),
      notes: null,
      createdBy: users[3].id,
    },
    {
      id: 'pcs-0001-4000-8000-000000000003',
      plotId: fieldPlots[1].id, // Talhão A2 — Milho
      farmId: farms[0].id,
      seasonType: 'SAFRA',
      seasonYear: '2024/2025',
      crop: 'Milho',
      varietyName: 'DKB 310 PRO3',
      startDate: new Date('2024-10-20'),
      endDate: new Date('2025-03-10'),
      plantedAreaHa: 1200,
      productivityKgHa: 8200,
      totalProductionKg: 9840000,
      operations: JSON.stringify([]),
      notes: 'Safra cheia de milho',
      createdBy: users[3].id,
    },
  ];

  for (const cs of cropSeasons) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO plot_crop_seasons (id, "plotId", "farmId", "seasonType", "seasonYear", crop, "varietyName", "startDate", "endDate", "plantedAreaHa", "productivityKgHa", "totalProductionKg", operations, notes, "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"SeasonType", $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, now(), now())`,
      cs.id,
      cs.plotId,
      cs.farmId,
      cs.seasonType,
      cs.seasonYear,
      cs.crop,
      cs.varietyName,
      cs.startDate,
      cs.endDate,
      cs.plantedAreaHa,
      cs.productivityKgHa,
      cs.totalProductionKg,
      cs.operations,
      cs.notes,
      cs.createdBy,
    );
    console.log(`  ✓ Safra: ${cs.crop} ${cs.seasonYear} (${cs.seasonType})`);
  }

  // ─── Análises de Solo ──────────────────────────────────────────────
  console.log('\n  Criando análises de solo...');

  const soilAnalyses = [
    {
      id: 'psa-0001-4000-8000-000000000001',
      plotId: fieldPlots[0].id, // Talhão A1
      farmId: farms[0].id,
      analysisDate: new Date('2024-08-15'),
      labName: 'Laboratório de Solos MT',
      sampleDepthCm: '0-20',
      phH2o: 5.8,
      organicMatterPct: 3.2,
      phosphorusMgDm3: 12.5,
      potassiumMgDm3: 85,
      calciumCmolcDm3: 4.2,
      magnesiumCmolcDm3: 1.8,
      aluminumCmolcDm3: 0.1,
      ctcCmolcDm3: 8.5,
      baseSaturationPct: 62,
      sulfurMgDm3: 8,
      clayContentPct: 45,
      notes: 'Solo em boas condições para soja',
      createdBy: users[3].id,
    },
    {
      id: 'psa-0001-4000-8000-000000000002',
      plotId: fieldPlots[0].id, // Talhão A1 — análise anterior
      farmId: farms[0].id,
      analysisDate: new Date('2023-08-10'),
      labName: 'Laboratório de Solos MT',
      sampleDepthCm: '0-20',
      phH2o: 5.4,
      organicMatterPct: 2.8,
      phosphorusMgDm3: 9.5,
      potassiumMgDm3: 72,
      calciumCmolcDm3: 3.5,
      magnesiumCmolcDm3: 1.5,
      aluminumCmolcDm3: 0.3,
      ctcCmolcDm3: 7.8,
      baseSaturationPct: 55,
      sulfurMgDm3: 6,
      clayContentPct: 45,
      notes: 'Recomendada calagem para elevação de V%',
      createdBy: users[3].id,
    },
  ];

  for (const sa of soilAnalyses) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO plot_soil_analyses (id, "plotId", "farmId", "analysisDate", "labName", "sampleDepthCm", "phH2o", "organicMatterPct", "phosphorusMgDm3", "potassiumMgDm3", "calciumCmolcDm3", "magnesiumCmolcDm3", "aluminumCmolcDm3", "ctcCmolcDm3", "baseSaturationPct", "sulfurMgDm3", "clayContentPct", notes, "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, now(), now())`,
      sa.id,
      sa.plotId,
      sa.farmId,
      sa.analysisDate,
      sa.labName,
      sa.sampleDepthCm,
      sa.phH2o,
      sa.organicMatterPct,
      sa.phosphorusMgDm3,
      sa.potassiumMgDm3,
      sa.calciumCmolcDm3,
      sa.magnesiumCmolcDm3,
      sa.aluminumCmolcDm3,
      sa.ctcCmolcDm3,
      sa.baseSaturationPct,
      sa.sulfurMgDm3,
      sa.clayContentPct,
      sa.notes,
      sa.createdBy,
    );
    console.log(`  ✓ Análise: ${sa.analysisDate.toISOString().split('T')[0]} (${sa.labName})`);
  }

  // ─── CAR Registrations ─────────────────────────────────────────────
  console.log('\n  Criando registros de CAR...');

  await prisma.$executeRawUnsafe(`DELETE FROM car_registration_links`);
  await prisma.$executeRawUnsafe(`DELETE FROM car_registrations`);

  const carRegistrations = [
    {
      id: 'car-0001-4000-8000-000000000001',
      farmId: farms[0].id, // Santa Helena
      carCode: 'MT-5107248-F8A9B1C2D3E4F5A6B7C8D9E0F1A2B3C4',
      status: 'ATIVO',
      inscriptionDate: '2018-05-15',
      areaHa: 3500,
      city: 'Sorriso',
      state: 'MT',
      nativeVegetationHa: 700,
      consolidatedAreaHa: 2450,
      legalReserveRecordedHa: 700,
      legalReserveApprovedHa: 700,
      appTotalHa: 350,
      appNativeVegetationHa: 280,
      appConsolidatedHa: 70,
    },
    {
      id: 'car-0001-4000-8000-000000000002',
      farmId: farms[0].id, // Santa Helena (segundo CAR)
      carCode: 'MT-5107248-A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6',
      status: 'ATIVO',
      inscriptionDate: '2020-02-10',
      areaHa: 1700,
      city: 'Sorriso',
      state: 'MT',
      nativeVegetationHa: 340,
      consolidatedAreaHa: 1190,
      legalReserveRecordedHa: 340,
      legalReserveApprovedHa: 340,
      appTotalHa: 170,
      appNativeVegetationHa: 136,
      appConsolidatedHa: 34,
    },
  ];

  for (const car of carRegistrations) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO car_registrations (id, "farmId", "carCode", status, "inscriptionDate", "areaHa", city, state, "nativeVegetationHa", "consolidatedAreaHa", "legalReserveRecordedHa", "legalReserveApprovedHa", "appTotalHa", "appNativeVegetationHa", "appConsolidatedHa", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"CarStatus", $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now())`,
      car.id,
      car.farmId,
      car.carCode,
      car.status,
      car.inscriptionDate,
      car.areaHa,
      car.city,
      car.state,
      car.nativeVegetationHa,
      car.consolidatedAreaHa,
      car.legalReserveRecordedHa,
      car.legalReserveApprovedHa,
      car.appTotalHa,
      car.appNativeVegetationHa,
      car.appConsolidatedHa,
    );
    console.log(`  ✓ CAR: ${car.carCode} (${car.city}/${car.state})`);
  }

  // Links CAR ↔ Matrícula
  console.log('\n  Criando vínculos CAR ↔ Matrícula...');

  const carRegistrationLinks = [
    // CAR 1 → Matrícula 15.234 e 15.235 (cobre as duas matrículas de Santa Helena)
    { carRegistrationId: carRegistrations[0].id, farmRegistrationId: farmRegistrations[0].id },
    { carRegistrationId: carRegistrations[0].id, farmRegistrationId: farmRegistrations[1].id },
    // CAR 2 → Matrícula 15.235 (segundo CAR cobre apenas a segunda matrícula)
    { carRegistrationId: carRegistrations[1].id, farmRegistrationId: farmRegistrations[1].id },
  ];

  for (const link of carRegistrationLinks) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO car_registration_links (id, "carRegistrationId", "farmRegistrationId", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, now())`,
      link.carRegistrationId,
      link.farmRegistrationId,
    );
  }
  console.log(`  ✓ ${carRegistrationLinks.length} vínculos CAR-matrícula criados`);

  // ─── Raças (Breeds) ──────────────────────────────────────────────
  console.log('\n  Criando raças...');

  const breeds = [
    {
      id: 'breed-0001-4000-8000-000000000001',
      name: 'Holandesa',
      code: 'HOL',
      category: 'LEITEIRA',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000002',
      name: 'Gir Leiteiro',
      code: 'GIR',
      category: 'LEITEIRA',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000003',
      name: 'Girolando',
      code: 'GIRO',
      category: 'LEITEIRA',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000004',
      name: 'Jersey',
      code: 'JER',
      category: 'LEITEIRA',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000005',
      name: 'Pardo-Suíço',
      code: 'PSU',
      category: 'DUPLA_APTIDAO',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000006',
      name: 'Guzerá',
      code: 'GUZ',
      category: 'DUPLA_APTIDAO',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000007',
      name: 'Sindi',
      code: 'SIN',
      category: 'LEITEIRA',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000008',
      name: 'Nelore',
      code: 'NEL',
      category: 'CORTE',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000009',
      name: 'Brahman',
      code: 'BRA',
      category: 'CORTE',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000010',
      name: 'Senepol',
      code: 'SEN',
      category: 'CORTE',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000011',
      name: 'Angus',
      code: 'ANG',
      category: 'CORTE',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000012',
      name: 'Caracu',
      code: 'CAR',
      category: 'DUPLA_APTIDAO',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000013',
      name: 'Simental',
      code: 'SIM',
      category: 'DUPLA_APTIDAO',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000014',
      name: 'Red Angus',
      code: 'RAN',
      category: 'CORTE',
      isDefault: true,
    },
    {
      id: 'breed-0001-4000-8000-000000000015',
      name: 'Mestiço/SRD',
      code: 'SRD',
      category: 'DUPLA_APTIDAO',
      isDefault: true,
    },
  ];

  for (const breed of breeds) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO breeds (id, name, code, species, category, "isDefault", "organizationId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'BOVINO', $4, $5, NULL, now(), now())
       ON CONFLICT (name, COALESCE("organizationId", '___global___')) DO UPDATE SET code = $3, category = $4`,
      breed.id,
      breed.name,
      breed.code,
      breed.category,
      breed.isDefault,
    );
    console.log(`  ✓ Raça: ${breed.name} (${breed.code})`);
  }

  // ─── Animais ──────────────────────────────────────────────────────────
  console.log('\n  Criando animais...');

  await prisma.$executeRawUnsafe(`DELETE FROM animal_health_records`);
  await prisma.$executeRawUnsafe(`DELETE FROM animal_genealogical_records`);
  await prisma.$executeRawUnsafe(`DELETE FROM animal_breed_compositions`);
  await prisma.$executeRawUnsafe(`DELETE FROM animals`);

  const SANTA_HELENA = farms[0].id;
  const HOLANDESA = breeds[0].id;
  const GIR_LEITEIRO = breeds[1].id;
  const NELORE = breeds[7].id;
  const ANGUS = breeds[10].id;
  const CREATED_BY = users[5].id; // José (OPERATOR)

  const seedAnimals = [
    {
      id: 'ani-0001-4000-8000-000000000001',
      earTag: 'SH-001',
      name: 'Mimosa',
      sex: 'FEMALE',
      birthDate: '2020-03-15',
      category: 'VACA_LACTACAO',
      categorySuggested: 'VACA_LACTACAO',
      origin: 'BORN',
      entryWeightKg: 520,
      bodyConditionScore: 3,
      isCompositionEstimated: false,
      compositions: [
        { breedId: HOLANDESA, fraction: '1/2', percentage: 50 },
        { breedId: GIR_LEITEIRO, fraction: '1/2', percentage: 50 },
      ],
    },
    {
      id: 'ani-0001-4000-8000-000000000002',
      earTag: 'SH-002',
      name: 'Estrela',
      sex: 'FEMALE',
      birthDate: '2019-08-20',
      category: 'VACA_LACTACAO',
      categorySuggested: 'VACA_LACTACAO',
      origin: 'PURCHASED',
      entryWeightKg: 550,
      bodyConditionScore: 4,
      isCompositionEstimated: false,
      compositions: [
        { breedId: HOLANDESA, fraction: '3/4', percentage: 75 },
        { breedId: GIR_LEITEIRO, fraction: '1/4', percentage: 25 },
      ],
    },
    {
      id: 'ani-0001-4000-8000-000000000003',
      earTag: 'SH-003',
      name: 'Princesa',
      sex: 'FEMALE',
      birthDate: '2021-11-05',
      category: 'VACA_SECA',
      categorySuggested: 'VACA_SECA',
      origin: 'BORN',
      entryWeightKg: 480,
      bodyConditionScore: 3,
      isCompositionEstimated: false,
      compositions: [
        { breedId: HOLANDESA, fraction: '5/8', percentage: 62.5 },
        { breedId: GIR_LEITEIRO, fraction: '3/8', percentage: 37.5 },
      ],
    },
    {
      id: 'ani-0001-4000-8000-000000000004',
      earTag: 'SH-004',
      name: 'Trovão',
      sex: 'MALE',
      birthDate: '2018-01-10',
      category: 'TOURO_REPRODUTOR',
      categorySuggested: 'TOURO_REPRODUTOR',
      origin: 'PURCHASED',
      entryWeightKg: 980,
      bodyConditionScore: 4,
      isCompositionEstimated: false,
      compositions: [
        { breedId: HOLANDESA, fraction: '1/2', percentage: 50 },
        { breedId: GIR_LEITEIRO, fraction: '1/2', percentage: 50 },
      ],
    },
    {
      id: 'ani-0001-4000-8000-000000000005',
      earTag: 'SH-005',
      name: null,
      sex: 'FEMALE',
      birthDate: '2025-02-10',
      category: 'BEZERRA',
      categorySuggested: 'BEZERRA',
      origin: 'BORN',
      entryWeightKg: 38,
      bodyConditionScore: null,
      isCompositionEstimated: false,
      sireId: 'ani-0001-4000-8000-000000000004', // Trovão
      damId: 'ani-0001-4000-8000-000000000001', // Mimosa
      compositions: [
        { breedId: HOLANDESA, fraction: '1/2', percentage: 50 },
        { breedId: GIR_LEITEIRO, fraction: '1/2', percentage: 50 },
      ],
    },
    {
      id: 'ani-0001-4000-8000-000000000006',
      earTag: 'SH-006',
      name: null,
      sex: 'MALE',
      birthDate: '2025-06-18',
      category: 'BEZERRO',
      categorySuggested: 'BEZERRO',
      origin: 'BORN',
      entryWeightKg: 42,
      bodyConditionScore: null,
      isCompositionEstimated: false,
      sireId: 'ani-0001-4000-8000-000000000004', // Trovão
      damId: 'ani-0001-4000-8000-000000000002', // Estrela
      compositions: [
        { breedId: HOLANDESA, fraction: '5/8', percentage: 62.5 },
        { breedId: GIR_LEITEIRO, fraction: '3/8', percentage: 37.5 },
      ],
    },
    {
      id: 'ani-0001-4000-8000-000000000007',
      earTag: 'SH-007',
      name: 'Flor',
      sex: 'FEMALE',
      birthDate: '2023-04-12',
      category: 'NOVILHA',
      categorySuggested: 'NOVILHA',
      origin: 'BORN',
      entryWeightKg: 320,
      bodyConditionScore: 3,
      isCompositionEstimated: true,
      compositions: [{ breedId: NELORE, fraction: '1/1', percentage: 100 }],
    },
    {
      id: 'ani-0001-4000-8000-000000000008',
      earTag: 'SH-008',
      name: 'Relâmpago',
      sex: 'MALE',
      birthDate: '2022-09-25',
      category: 'NOVILHO',
      categorySuggested: 'NOVILHO',
      origin: 'PURCHASED',
      entryWeightKg: 410,
      bodyConditionScore: 3,
      isCompositionEstimated: false,
      compositions: [
        { breedId: ANGUS, fraction: '1/2', percentage: 50 },
        { breedId: NELORE, fraction: '1/2', percentage: 50 },
      ],
    },
  ];

  for (const animal of seedAnimals) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO animals (id, "farmId", "earTag", name, sex, "birthDate", "birthDateEstimated", category, "categorySuggested", origin, "entryWeightKg", "bodyConditionScore", "sireId", "damId", "isCompositionEstimated", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::"AnimalSex", $6::date, false, $7::"AnimalCategory", $8::"AnimalCategory", $9::"AnimalOrigin", $10, $11, $12, $13, $14, $15, now(), now())`,
      animal.id,
      SANTA_HELENA,
      animal.earTag,
      animal.name,
      animal.sex,
      animal.birthDate,
      animal.category,
      animal.categorySuggested,
      animal.origin,
      animal.entryWeightKg,
      animal.bodyConditionScore,
      (animal as Record<string, unknown>).sireId ?? null,
      (animal as Record<string, unknown>).damId ?? null,
      animal.isCompositionEstimated,
      CREATED_BY,
    );

    for (const comp of animal.compositions) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO animal_breed_compositions (id, "animalId", "breedId", fraction, percentage, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
        animal.id,
        comp.breedId,
        comp.fraction,
        comp.percentage,
      );
    }

    console.log(
      `  ✓ Animal: ${animal.earTag}${animal.name ? ` — ${animal.name}` : ''} (${animal.sex}, ${animal.category})`,
    );
  }

  // Registro genealógico para Trovão (touro reprodutor com PO)
  await prisma.$executeRawUnsafe(
    `INSERT INTO animal_genealogical_records (id, "animalId", "genealogyClass", "registrationNumber", "associationName", "registrationDate", notes, "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, 'PO'::"GenealogyClass", $2, $3, $4::date, $5, now(), now())`,
    'ani-0001-4000-8000-000000000004', // Trovão
    'GR-HOL-12345',
    'Associação Brasileira dos Criadores de Girolando',
    '2019-03-15',
    'Puro de origem, registro definitivo',
  );
  console.log('  ✓ Registro genealógico: Trovão (PO, Girolando)');

  // ─── Lotes de Animais ──────────────────────────────────────────────
  console.log('\n  Criando lotes de animais...');

  await prisma.$executeRawUnsafe(`DELETE FROM animal_lot_movements`);
  await prisma.$executeRawUnsafe(`DELETE FROM animal_lots`);

  const animalLots = [
    {
      id: 'lot-0001-4000-8000-000000000001',
      farmId: SANTA_HELENA,
      name: 'Lote Maternidade',
      predominantCategory: 'BEZERRA',
      currentLocation: 'Pasto 3',
      locationType: 'BEZERREIRO',
      maxCapacity: 20,
      description: 'Bezerros e bezerras recém-nascidos',
    },
    {
      id: 'lot-0001-4000-8000-000000000002',
      farmId: SANTA_HELENA,
      name: 'Lote Recria Fêmeas',
      predominantCategory: 'NOVILHA',
      currentLocation: 'Pasto 5',
      locationType: 'PASTO',
      maxCapacity: 50,
      description: 'Novilhas em recria',
    },
    {
      id: 'lot-0001-4000-8000-000000000003',
      farmId: SANTA_HELENA,
      name: 'Lote Lactação',
      predominantCategory: 'VACA_LACTACAO',
      currentLocation: 'Galpão de Ordenha',
      locationType: 'GALPAO',
      maxCapacity: 30,
      description: 'Vacas em lactação ativa',
    },
  ];

  for (const lot of animalLots) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO animal_lots (id, "farmId", name, "predominantCategory", "currentLocation", "locationType", "maxCapacity", description, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"AnimalCategory", $5, $6::"LotLocationType", $7, $8, now(), now())`,
      lot.id,
      lot.farmId,
      lot.name,
      lot.predominantCategory,
      lot.currentLocation,
      lot.locationType,
      lot.maxCapacity,
      lot.description,
    );
    console.log(`  ✓ Lote: ${lot.name} (${lot.locationType}, cap: ${lot.maxCapacity})`);
  }

  // Assign animals to lots
  console.log('\n  Atribuindo animais aos lotes...');

  // Bezerros → Lote Maternidade
  const maternidadeAnimals = ['ani-0001-4000-8000-000000000005', 'ani-0001-4000-8000-000000000006'];
  for (const animalId of maternidadeAnimals) {
    await prisma.$executeRawUnsafe(
      `UPDATE animals SET "lotId" = $1 WHERE id = $2`,
      animalLots[0].id,
      animalId,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO animal_lot_movements (id, "animalId", "lotId", "enteredAt", "movedBy", reason, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, now() - interval '30 days', $3, 'Nascimento', now())`,
      animalId,
      animalLots[0].id,
      CREATED_BY,
    );
  }
  console.log('  ✓ 2 bezerros atribuídos ao Lote Maternidade');

  // Novilhas → Lote Recria Fêmeas
  const recriaAnimals = ['ani-0001-4000-8000-000000000007'];
  for (const animalId of recriaAnimals) {
    await prisma.$executeRawUnsafe(
      `UPDATE animals SET "lotId" = $1 WHERE id = $2`,
      animalLots[1].id,
      animalId,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO animal_lot_movements (id, "animalId", "lotId", "enteredAt", "movedBy", reason, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, now() - interval '60 days', $3, 'Recria', now())`,
      animalId,
      animalLots[1].id,
      CREATED_BY,
    );
  }
  console.log('  ✓ 1 novilha atribuída ao Lote Recria Fêmeas');

  // Vacas lactação → Lote Lactação
  const lactacaoAnimals = ['ani-0001-4000-8000-000000000001', 'ani-0001-4000-8000-000000000002'];
  for (const animalId of lactacaoAnimals) {
    await prisma.$executeRawUnsafe(
      `UPDATE animals SET "lotId" = $1 WHERE id = $2`,
      animalLots[2].id,
      animalId,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO animal_lot_movements (id, "animalId", "lotId", "enteredAt", "movedBy", reason, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, now() - interval '90 days', $3, 'Início lactação', now())`,
      animalId,
      animalLots[2].id,
      CREATED_BY,
    );
  }
  console.log('  ✓ 2 vacas atribuídas ao Lote Lactação');

  // ─── Farm Locations (Pastos e Instalações) ──────────────────────────
  console.log('\n  Criando pastos e instalações...');

  await prisma.$executeRawUnsafe(`DELETE FROM farm_locations`);

  const farmLocations = [
    {
      id: 'floc-0001-4000-8000-000000000001',
      farmId: SANTA_HELENA,
      name: 'Pasto Norte',
      type: 'PASTURE',
      capacityUA: 25,
      forageType: 'BRACHIARIA_BRIZANTHA',
      pastureStatus: 'EM_USO',
      description: 'Pasto principal, rotação com Pasto Sul',
    },
    {
      id: 'floc-0001-4000-8000-000000000002',
      farmId: SANTA_HELENA,
      name: 'Pasto Sul',
      type: 'PASTURE',
      capacityUA: 30,
      forageType: 'PANICUM_MOMBASA',
      pastureStatus: 'DESCANSO',
      description: 'Em descanso para recuperação da pastagem',
    },
    {
      id: 'floc-0001-4000-8000-000000000003',
      farmId: SANTA_HELENA,
      name: 'Piquete Maternidade',
      type: 'PASTURE',
      capacityUA: 10,
      forageType: 'CYNODON_TIFTON',
      pastureStatus: 'EM_USO',
      description: 'Piquete exclusivo para vacas em maternidade',
    },
    {
      id: 'floc-0001-4000-8000-000000000004',
      farmId: SANTA_HELENA,
      name: 'Curral Principal',
      type: 'FACILITY',
      capacityAnimals: 50,
      facilityType: 'CURRAL',
      facilityStatus: 'ATIVO',
      description: 'Curral de manejo com tronco e balança',
    },
    {
      id: 'floc-0001-4000-8000-000000000005',
      farmId: SANTA_HELENA,
      name: 'Bezerreiro',
      type: 'FACILITY',
      capacityAnimals: 20,
      facilityType: 'BEZERREIRO',
      facilityStatus: 'ATIVO',
      description: 'Instalação coberta para bezerros',
    },
  ];

  for (const loc of farmLocations) {
    if (loc.type === 'PASTURE') {
      await prisma.$executeRawUnsafe(
        `INSERT INTO farm_locations (id, "farmId", name, type, "capacityUA", "forageType", "pastureStatus", description, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4::"FarmLocationType", $5, $6::"ForageType", $7::"PastureStatus", $8, now(), now())`,
        loc.id,
        loc.farmId,
        loc.name,
        loc.type,
        loc.capacityUA,
        loc.forageType,
        loc.pastureStatus,
        loc.description,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO farm_locations (id, "farmId", name, type, "capacityAnimals", "facilityType", "facilityStatus", description, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4::"FarmLocationType", $5, $6::"FacilityType", $7::"FacilityStatus", $8, now(), now())`,
        loc.id,
        loc.farmId,
        loc.name,
        loc.type,
        loc.capacityAnimals,
        loc.facilityType,
        loc.facilityStatus,
        loc.description,
      );
    }
    console.log(`  ✓ ${loc.type === 'PASTURE' ? 'Pasto' : 'Instalação'}: ${loc.name}`);
  }

  // Link lots to locations
  console.log('\n  Vinculando lotes aos locais...');
  await prisma.$executeRawUnsafe(
    `UPDATE animal_lots SET "locationId" = $1 WHERE id = $2`,
    farmLocations[0].id, // Pasto Norte
    animalLots[1].id, // Lote Recria Fêmeas (was at Pasto 5)
  );
  await prisma.$executeRawUnsafe(
    `UPDATE animal_lots SET "locationId" = $1 WHERE id = $2`,
    farmLocations[4].id, // Bezerreiro
    animalLots[0].id, // Lote Maternidade (was at Pasto 3 / Bezerreiro)
  );
  console.log('  ✓ 2 lotes vinculados a locais');

  // ─── Pesagens de Animais ────────────────────────────────────────────
  console.log('\n  Criando pesagens de animais...');

  await prisma.$executeRawUnsafe(`DELETE FROM animal_weighings`);

  // Pesagens da Mimosa (SH-001, vaca lactação, entrada 520kg)
  const mimosaWeighings = [
    { measuredAt: '2025-07-01', weightKg: 520, bcs: 3, notes: 'Peso de entrada' },
    { measuredAt: '2025-08-01', weightKg: 510, bcs: 3, notes: 'Início lactação, perda esperada' },
    { measuredAt: '2025-09-01', weightKg: 505, bcs: 3, notes: null },
    { measuredAt: '2025-10-01', weightKg: 512, bcs: 3, notes: 'Recuperando peso' },
    { measuredAt: '2025-11-01', weightKg: 525, bcs: 4, notes: null },
    { measuredAt: '2025-12-01', weightKg: 530, bcs: 4, notes: 'Bom ganho de peso' },
  ];

  for (const w of mimosaWeighings) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO animal_weighings (id, "animalId", "farmId", "weightKg", "measuredAt", "bodyConditionScore", notes, "recordedBy", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::date, $5, $6, $7, now(), now())`,
      'ani-0001-4000-8000-000000000001',
      SANTA_HELENA,
      w.weightKg,
      w.measuredAt,
      w.bcs,
      w.notes,
      CREATED_BY,
    );
  }
  console.log(`  ✓ ${mimosaWeighings.length} pesagens: Mimosa (SH-001)`);

  // Pesagens do Trovão (SH-004, touro reprodutor, entrada 980kg)
  const trovaoWeighings = [
    { measuredAt: '2025-06-15', weightKg: 980, bcs: 4, notes: 'Peso de entrada na fazenda' },
    { measuredAt: '2025-09-15', weightKg: 995, bcs: 4, notes: null },
    { measuredAt: '2025-12-15', weightKg: 1010, bcs: 4, notes: 'Excelente condição' },
    { measuredAt: '2026-03-01', weightKg: 1025, bcs: 5, notes: 'Estação monta iniciada' },
  ];

  for (const w of trovaoWeighings) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO animal_weighings (id, "animalId", "farmId", "weightKg", "measuredAt", "bodyConditionScore", notes, "recordedBy", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::date, $5, $6, $7, now(), now())`,
      'ani-0001-4000-8000-000000000004',
      SANTA_HELENA,
      w.weightKg,
      w.measuredAt,
      w.bcs,
      w.notes,
      CREATED_BY,
    );
  }
  console.log(`  ✓ ${trovaoWeighings.length} pesagens: Trovão (SH-004)`);

  // Pesagens da Flor (SH-007, novilha, entrada 320kg)
  const florWeighings = [
    { measuredAt: '2025-08-01', weightKg: 320, bcs: 3, notes: 'Peso de entrada' },
    { measuredAt: '2025-10-01', weightKg: 345, bcs: 3, notes: null },
    { measuredAt: '2025-12-01', weightKg: 370, bcs: 3, notes: 'Crescimento adequado' },
    { measuredAt: '2026-02-01', weightKg: 395, bcs: 4, notes: null },
  ];

  for (const w of florWeighings) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO animal_weighings (id, "animalId", "farmId", "weightKg", "measuredAt", "bodyConditionScore", notes, "recordedBy", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::date, $5, $6, $7, now(), now())`,
      'ani-0001-4000-8000-000000000007',
      SANTA_HELENA,
      w.weightKg,
      w.measuredAt,
      w.bcs,
      w.notes,
      CREATED_BY,
    );
  }
  console.log(`  ✓ ${florWeighings.length} pesagens: Flor (SH-007)`);

  // ─── Registros Sanitários ──────────────────────────────────────────
  console.log('\n  Criando registros sanitários...');

  await prisma.$executeRawUnsafe(`DELETE FROM animal_health_records`);

  const healthRecords = [
    // Mimosa (SH-001)
    {
      animalId: 'ani-0001-4000-8000-000000000001',
      type: 'VACCINATION',
      eventDate: '2025-05-15',
      productName: 'Aftosa Bivalente',
      dosage: '5ml',
      applicationMethod: 'INJECTABLE',
      batchNumber: 'AFT-2025-B1',
      veterinaryName: 'Dr. Carlos Silva',
      notes: 'Campanha nacional vacinação aftosa',
    },
    {
      animalId: 'ani-0001-4000-8000-000000000001',
      type: 'DEWORMING',
      eventDate: '2025-06-01',
      productName: 'Ivomec Gold',
      dosage: '1ml/50kg',
      applicationMethod: 'INJECTABLE',
      notes: 'Vermifugação estratégica pré-parto',
    },
    {
      animalId: 'ani-0001-4000-8000-000000000001',
      type: 'VACCINATION',
      eventDate: '2025-11-10',
      productName: 'Aftosa Bivalente',
      dosage: '5ml',
      applicationMethod: 'INJECTABLE',
      batchNumber: 'AFT-2025-N2',
      veterinaryName: 'Dr. Carlos Silva',
      notes: '2ª etapa campanha aftosa',
    },
    // Trovão (SH-004)
    {
      animalId: 'ani-0001-4000-8000-000000000004',
      type: 'VACCINATION',
      eventDate: '2025-05-15',
      productName: 'Aftosa Bivalente',
      dosage: '5ml',
      applicationMethod: 'INJECTABLE',
      batchNumber: 'AFT-2025-B1',
      veterinaryName: 'Dr. Carlos Silva',
    },
    {
      animalId: 'ani-0001-4000-8000-000000000004',
      type: 'EXAM',
      eventDate: '2025-07-20',
      productName: 'Teste Brucelose/Tuberculose',
      examResult: 'Negativo para ambos',
      labName: 'Lab Vet Goiás',
      isFieldExam: false,
      veterinaryName: 'Dr. Carlos Silva',
      notes: 'Exame obrigatório reprodutor',
    },
    {
      animalId: 'ani-0001-4000-8000-000000000004',
      type: 'DEWORMING',
      eventDate: '2025-09-01',
      productName: 'Dectomax',
      dosage: '1ml/50kg',
      applicationMethod: 'INJECTABLE',
    },
    // Flor (SH-007)
    {
      animalId: 'ani-0001-4000-8000-000000000007',
      type: 'VACCINATION',
      eventDate: '2025-05-15',
      productName: 'Aftosa Bivalente',
      dosage: '5ml',
      applicationMethod: 'INJECTABLE',
      batchNumber: 'AFT-2025-B1',
      veterinaryName: 'Dr. Carlos Silva',
    },
    {
      animalId: 'ani-0001-4000-8000-000000000007',
      type: 'VACCINATION',
      eventDate: '2025-08-10',
      productName: 'Brucelose B-19',
      dosage: '2ml',
      applicationMethod: 'INJECTABLE',
      batchNumber: 'BRU-2025-01',
      veterinaryName: 'Dr. Carlos Silva',
      notes: 'Vacinação novilhas 3-8 meses',
    },
    {
      animalId: 'ani-0001-4000-8000-000000000007',
      type: 'TREATMENT',
      eventDate: '2025-10-05',
      productName: 'Terramicina LA',
      dosage: '10ml',
      applicationMethod: 'INJECTABLE',
      diagnosis: 'Infecção umbigo',
      durationDays: 3,
      veterinaryName: 'Dr. Santos',
    },
    // Estrela (SH-002)
    {
      animalId: 'ani-0001-4000-8000-000000000002',
      type: 'VACCINATION',
      eventDate: '2025-05-15',
      productName: 'Aftosa Bivalente',
      dosage: '5ml',
      applicationMethod: 'INJECTABLE',
      batchNumber: 'AFT-2025-B1',
    },
    {
      animalId: 'ani-0001-4000-8000-000000000002',
      type: 'TREATMENT',
      eventDate: '2025-12-20',
      productName: 'Mastofin',
      dosage: '10ml intramamário',
      applicationMethod: 'OTHER',
      diagnosis: 'Mastite clínica quarto anterior esquerdo',
      durationDays: 5,
      veterinaryName: 'Dr. Santos',
      notes: 'CMT positivo +++, leite descartado',
    },
    {
      animalId: 'ani-0001-4000-8000-000000000002',
      type: 'EXAM',
      eventDate: '2026-01-10',
      productName: 'Cultura microbiológica leite',
      examResult: 'Staphylococcus aureus — sensível a cefalosporina',
      labName: 'Lab Vet Goiás',
      isFieldExam: false,
      veterinaryName: 'Dr. Santos',
      notes: 'Pós-tratamento mastite',
    },
  ];

  for (const hr of healthRecords) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO animal_health_records (id, "animalId", "farmId", type, "eventDate", "productName", dosage, "applicationMethod", "batchNumber", diagnosis, "durationDays", "examResult", "labName", "isFieldExam", "veterinaryName", notes, "recordedBy", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3::"HealthEventType", $4::date, $5, $6, $7::"ApplicationMethod", $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now())`,
      hr.animalId,
      SANTA_HELENA,
      hr.type,
      hr.eventDate,
      (hr as Record<string, unknown>).productName ?? null,
      (hr as Record<string, unknown>).dosage ?? null,
      (hr as Record<string, unknown>).applicationMethod ?? null,
      (hr as Record<string, unknown>).batchNumber ?? null,
      (hr as Record<string, unknown>).diagnosis ?? null,
      (hr as Record<string, unknown>).durationDays ?? null,
      (hr as Record<string, unknown>).examResult ?? null,
      (hr as Record<string, unknown>).labName ?? null,
      (hr as Record<string, unknown>).isFieldExam ?? false,
      (hr as Record<string, unknown>).veterinaryName ?? null,
      (hr as Record<string, unknown>).notes ?? null,
      CREATED_BY,
    );
  }
  console.log(`  ✓ ${healthRecords.length} registros sanitários criados`);

  // Audit Logs de exemplo
  console.log('');
  const auditLogs = [
    {
      actorId: users[0].id,
      actorEmail: users[0].email,
      actorRole: 'SUPER_ADMIN' as const,
      action: 'CREATE_ORGANIZATION',
      targetType: 'organization',
      targetId: organizations[0].id,
      metadata: { name: organizations[0].name, type: organizations[0].type },
      ipAddress: '192.168.1.10',
    },
    {
      actorId: users[0].id,
      actorEmail: users[0].email,
      actorRole: 'SUPER_ADMIN' as const,
      action: 'CREATE_ORGANIZATION',
      targetType: 'organization',
      targetId: organizations[1].id,
      metadata: { name: organizations[1].name, type: organizations[1].type },
      ipAddress: '192.168.1.10',
    },
    {
      actorId: users[0].id,
      actorEmail: users[0].email,
      actorRole: 'SUPER_ADMIN' as const,
      action: 'CREATE_ORG_ADMIN',
      targetType: 'user',
      targetId: users[1].id,
      metadata: { organizationId: organizations[0].id, email: users[1].email },
      ipAddress: '192.168.1.10',
    },
    {
      actorId: users[0].id,
      actorEmail: users[0].email,
      actorRole: 'SUPER_ADMIN' as const,
      action: 'UPDATE_ORGANIZATION_PLAN',
      targetType: 'organization',
      targetId: organizations[0].id,
      metadata: { plan: 'premium', maxUsers: 20 },
      ipAddress: '10.0.0.5',
    },
  ];

  await prisma.auditLog.deleteMany();
  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
  }
  console.log(`  ✓ ${auditLogs.length} registros de auditoria criados`);

  console.log('\n🌱 Seed concluído com sucesso!\n');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
