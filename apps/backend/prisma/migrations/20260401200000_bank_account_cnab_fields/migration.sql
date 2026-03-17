-- AlterTable: Add CNAB convenience fields to bank_accounts
ALTER TABLE "bank_accounts" ADD COLUMN "convenioCode" TEXT;
ALTER TABLE "bank_accounts" ADD COLUMN "carteira"     TEXT;
ALTER TABLE "bank_accounts" ADD COLUMN "variacao"     TEXT;
