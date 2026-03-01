-- AlterTable: add googleId and customRoleId to users
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;
ALTER TABLE "users" ADD COLUMN "customRoleId" TEXT;
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- AlterTable: add allowSocialLogin to organizations
ALTER TABLE "organizations" ADD COLUMN "allowSocialLogin" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: custom_roles
CREATE TABLE "custom_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseRole" "UserRole" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_roles_name_organizationId_key" ON "custom_roles"("name", "organizationId");

-- CreateTable: role_permissions
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "customRoleId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_permissions_customRoleId_module_action_key" ON "role_permissions"("customRoleId", "module", "action");

-- AlterTable: add farmId and organizationId to audit_logs
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "farmId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "audit_logs_farmId_idx" ON "audit_logs"("farmId");
CREATE INDEX IF NOT EXISTS "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "custom_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
