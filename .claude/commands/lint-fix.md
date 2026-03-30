Lint and fix all changed files.

Steps:
1. Get list of changed files: `git diff --name-only HEAD`
2. For `.ts` files in `apps/backend/`: run `pnpm --filter @protos-farm/backend lint:fix`
3. For `.ts`/`.tsx` files in `apps/frontend/`: run `pnpm --filter @protos-farm/frontend lint:fix`
4. Run Prettier on all changed files: `npx prettier --write <files>`
5. Report what was fixed.
