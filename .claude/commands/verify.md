Verify the current changes are correct before committing.

Run these steps in order and report the results:

1. **TypeScript check (backend):**
   ```
   cd apps/backend && npx tsc --noEmit --pretty
   ```

2. **TypeScript check (frontend):**
   ```
   cd apps/frontend && npx tsc -b --pretty
   ```

3. **Lint changed files:**
   ```
   pnpm -r lint
   ```

4. **Run affected tests:**
   - Identify which modules were changed using `git diff --name-only`
   - Run only the relevant test files (e.g., `pnpm --filter @protos-farm/backend exec jest --testPathPattern="module-name"`)
   - If frontend files changed, run `pnpm --filter @protos-farm/frontend test`

5. **Summary:** Report pass/fail for each step. If any step fails, show the errors and suggest fixes.
