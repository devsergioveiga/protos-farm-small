-- CreateEnum
CREATE TYPE "FieldTeamType" AS ENUM ('COLHEITA_MANUAL', 'APLICACAO_DEFENSIVOS', 'CAPINA_ROCAGEM', 'VACINACAO_MANEJO', 'MANUTENCAO_CERCAS', 'PLANTIO_MANUAL', 'COLHEITA_CAFE', 'COLHEITA_LARANJA', 'GENERICA');

-- CreateTable
CREATE TABLE "field_teams" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamType" "FieldTeamType" NOT NULL,
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "leaderId" TEXT NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "field_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_teams_farmId_idx" ON "field_teams"("farmId");
CREATE INDEX "field_teams_leaderId_idx" ON "field_teams"("leaderId");
CREATE INDEX "field_teams_teamType_idx" ON "field_teams"("teamType");

CREATE INDEX "field_team_members_teamId_idx" ON "field_team_members"("teamId");
CREATE INDEX "field_team_members_userId_idx" ON "field_team_members"("userId");
CREATE UNIQUE INDEX "field_team_members_teamId_userId_leftAt_key" ON "field_team_members"("teamId", "userId", "leftAt");

-- AddForeignKey
ALTER TABLE "field_teams" ADD CONSTRAINT "field_teams_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "field_teams" ADD CONSTRAINT "field_teams_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_teams" ADD CONSTRAINT "field_teams_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "field_team_members" ADD CONSTRAINT "field_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "field_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "field_team_members" ADD CONSTRAINT "field_team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "field_teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "field_team_members" ENABLE ROW LEVEL SECURITY;
