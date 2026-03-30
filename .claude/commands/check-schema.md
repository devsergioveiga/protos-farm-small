Validate Prisma schema and generate client.

Steps:
1. Validate schema: `pnpm --filter @protos-farm/backend exec prisma validate`
2. Format schema: `pnpm --filter @protos-farm/backend exec prisma format`
3. Generate client: `pnpm --filter @protos-farm/backend exec prisma generate`
4. Check for pending migrations: `pnpm --filter @protos-farm/backend exec prisma migrate status`
5. Report status of each step.
