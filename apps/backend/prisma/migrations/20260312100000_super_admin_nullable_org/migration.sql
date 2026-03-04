-- AlterTable: make organizationId nullable for platform admins (SUPER_ADMIN)
ALTER TABLE "users" ALTER COLUMN "organizationId" DROP NOT NULL;
