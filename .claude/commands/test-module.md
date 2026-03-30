Run tests for a specific backend module.

Usage: /test-module <module-name>

Steps:
1. Run tests matching the module: `pnpm --filter @protos-farm/backend exec jest --testPathPattern="$ARGUMENTS" --verbose`
2. If tests fail, read the failing test file and the source file, diagnose the issue, and suggest a fix.
3. Report: total tests, passed, failed, and coverage if available.
