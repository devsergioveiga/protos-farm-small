import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const pgUser = process.env.POSTGRES_USER ?? 'protos';
const pgPassword = process.env.POSTGRES_PASSWORD ?? 'protos';
const pgHost = process.env.POSTGRES_HOST ?? 'localhost';
const pgPort = process.env.POSTGRES_PORT ?? '5432';
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
  // Org 1 — Agropecuária Bom Futuro
  {
    id: 'b1b2c3d4-0001-4000-8000-000000000001',
    email: 'carlos.admin@bomfuturo.agro.br',
    name: 'Carlos Eduardo Silva',
    role: 'SUPER_ADMIN' as const,
    phone: '+55 65 99901-0001',
    organizationId: organizations[0].id,
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
  // SUPER_ADMIN e ADMIN acessam todas as fazendas da org
  { userId: users[0].id, farmId: farms[0].id }, // Carlos (SUPER_ADMIN) → Santa Helena
  { userId: users[0].id, farmId: farms[1].id }, // Carlos (SUPER_ADMIN) → Três Irmãos
  { userId: users[0].id, farmId: farms[2].id }, // Carlos (SUPER_ADMIN) → Lagoa Dourada
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
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        phone: user.phone,
        organizationId: user.organizationId,
        passwordHash: DEFAULT_PASSWORD_HASH,
      },
      create: {
        ...user,
        passwordHash: DEFAULT_PASSWORD_HASH,
      },
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
    },
    {
      id: 'h1b2c3d4-0002-4000-8000-000000000002',
      producerId: producers[1].id, // Agropecuária Bom Futuro → Três Irmãos
      farmId: farms[1].id,
      bondType: 'PROPRIETARIO' as const,
      participationPct: 100,
    },
    {
      id: 'h1b2c3d4-0003-4000-8000-000000000003',
      producerId: producers[1].id, // Agropecuária Bom Futuro → Lagoa Dourada
      farmId: farms[2].id,
      bondType: 'ARRENDATARIO' as const,
      participationPct: 80,
    },
    {
      id: 'h1b2c3d4-0004-4000-8000-000000000004',
      producerId: producers[2].id, // Sociedade Irmãos Silva → Santa Helena
      farmId: farms[0].id,
      bondType: 'PARCEIRO' as const,
      participationPct: 30,
    },
    {
      id: 'h1b2c3d4-0005-4000-8000-000000000005',
      producerId: producers[2].id, // Sociedade Irmãos Silva → Três Irmãos
      farmId: farms[1].id,
      bondType: 'MEEIRO' as const,
      participationPct: 50,
    },
    {
      id: 'h1b2c3d4-0006-4000-8000-000000000006',
      producerId: producers[3].id, // João Carlos Mendes → Recanto do Sol
      farmId: farms[3].id,
      bondType: 'PROPRIETARIO' as const,
      participationPct: 100,
    },
  ];

  for (const link of producerFarmLinks) {
    await prisma.producerFarmLink.upsert({
      where: { id: link.id },
      update: { bondType: link.bondType },
      create: link,
    });
  }
  console.log(`  ✓ ${producerFarmLinks.length} vínculos produtor-fazenda criados`);

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
