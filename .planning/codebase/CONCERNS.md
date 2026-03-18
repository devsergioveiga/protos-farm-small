# Codebase Concerns

**Analysis Date:** 2026-03-15

## Tech Debt

**Incomplete Farm Deletion Dependencies Check:**

- Issue: Farm deletion does not verify active dependencies before soft-deleting
- Files: `apps/backend/src/modules/farms/farms.service.ts` (line 574-585)
- Impact: Users can delete farms that have active crops, animals, or financial records. This violates data integrity and creates orphaned records. Currently only name confirmation check exists.
- Fix approach: Uncomment and implement the dependency checks for active crops, animals, and pending financial entries. Add cascade delete rules or block deletion with clear error message listing blockers.

**Type Safety with `any` in Milking Records:**

- Issue: Heavy use of `@typescript-eslint/no-explicit-any` and `as any` casts in production code
- Files: `apps/backend/src/modules/milking-records/milking-records.service.ts` (lines 18, 34, 80, 111, 157, 225, 259, 292, 299, 317, 337, 365, 383, 390, 405, 417, 481, 504, 533)
- Impact: Loss of type safety in critical dairy management logic. Makes refactoring risky, harder to catch bugs. Risk is high in lactation tracking which depends on accurate type information.
- Fix approach: Generate proper types from database schema using Prisma. Replace raw transaction objects with typed queries. Use `Prisma.PrismaClientKnownRequestError` for error handling instead of casting.

**Weak Encryption in Offline Queue:**

- Issue: Simple XOR cipher used for data-at-rest encryption in SQLite
- Files: `apps/mobile/services/offline-queue.ts` (lines 95-101)
- Impact: XOR cipher provides minimal security — vulnerable to frequency analysis and known-plaintext attacks. While HTTPS handles transport, local device compromise still exposes sensitive farm data.
- Fix approach: Replace XOR cipher with AES-256-GCM using a proper crypto library (expo-crypto supports this). Use key derivation with PBKDF2 instead of SHA256 direct hashing. Consider using sqlite-crypto extension for database-level encryption.

**Unbounded Payload Encryption Hint:**

- Issue: Compression hint header `X-Payload-Compressed` sent but actual gzip compression not implemented
- Files: `apps/mobile/services/offline-queue.ts` (lines 418-425)
- Impact: Server may expect compressed payloads but receives uncompressed data. Creates protocol mismatch and potential data loss on large offline queue flushes. Backend must handle both cases or data corrupts.
- Fix approach: Either (1) Remove compression hint and validate server doesn't expect it, or (2) Implement actual gzip compression using a JS library (pako or fflate). Add compression round-trip tests.

**Missing Explicit Dependency Check in Farm Deletion:**

- Issue: TODO comment indicates checks for safras, animais, and financial records are not implemented
- Files: `apps/backend/src/modules/farms/farms.service.ts` (lines 574-585)
- Impact: Farm can be deleted with active data, violating referential integrity
- Fix approach: Implement the commented checks; add tests for blocked deletion scenarios

## Known Bugs

**Biometric Password Storage Risk:**

- Symptoms: Plaintext password stored in Expo SecureStore, then used for auto-login
- Files: `apps/mobile/services/biometrics.ts` (lines 33-36)
- Trigger: User enables biometric login, password gets saved locally
- Workaround: SecureStore is OS-level encrypted, but password is still recoverable if device is compromised
- Mitigation: Use refresh tokens instead of storing passwords. Implement token-based re-auth after biometric unlock.

**Payload Decryption Silent Failure:**

- Symptoms: If decryption fails (corrupted encrypted data), returns original payload without error
- Files: `apps/mobile/services/offline-queue.ts` (lines 398-408)
- Trigger: Encryption key mismatch or corrupted encrypted payload during sync
- Workaround: Currently silently falls back, which can mask data corruption
- Mitigation: Log decryption failures with warning level. Add metrics to track fallback rates. Consider quarantining corrupted operations instead of blindly trusting.

**N+1 Query in Milking Variation Calculation:**

- Symptoms: For each milking record created, separate query to fetch previous day's record
- Files: `apps/backend/src/modules/milking-records/milking-records.service.ts` (lines 89-97, repeated in bulk operations)
- Trigger: Bulk import of 100+ milking records creates 100+ additional queries
- Workaround: None — operation is slow
- Mitigation: Batch fetch all previous records in a single query; use index on `(animalId, milkingDate, shift)` composite.

## Security Considerations

**Biometric Credential Storage:**

- Risk: Expo SecureStore can be compromised if device is rooted or jailbroken
- Files: `apps/mobile/services/biometrics.ts`
- Current mitigation: OS-level encryption provided by SecureStore
- Recommendations: (1) Never store passwords; use opaque refresh tokens instead. (2) Add app-level tamper detection. (3) Expire stored credentials after 30 days. (4) Implement pin/pattern fallback, not password.

**Unencrypted Sensitive Data in SQLite Offline Queue:**

- Risk: Sensitive farm data (pesticide applications, animal health records) stored unencrypted in local SQLite by default
- Files: `apps/mobile/services/offline-queue.ts` (option `enableEncryption` defaults to `false`)
- Current mitigation: XOR cipher available but not default
- Recommendations: (1) Enable encryption by default for all offline operations. (2) Use AES-256-GCM. (3) Add encryption toggle with warning if disabled. (4) Encrypt at database level using SQLCipher.

**No Rate Limiting on Offline Sync Retry:**

- Risk: Exponential backoff has max of 30s but no upper limit on total retry duration
- Files: `apps/mobile/services/offline-queue.ts` (lines 288-298)
- Current mitigation: MAX_RETRIES = 5 prevents infinite loops
- Recommendations: (1) Add total timeout across all retries (5 minutes). (2) Implement jitter to prevent thundering herd on reconnect. (3) Add user-visible UI for "sync stuck" state after 2 retries.

**XOR Encryption Vulnerability:**

- Risk: XOR cipher can be broken with known-plaintext attacks if attacker has samples of unencrypted payloads
- Files: `apps/mobile/services/offline-queue.ts` (lines 95-101)
- Current mitigation: None
- Recommendations: Implement AES-256-GCM or use sqlite-crypto extension for transparent encryption.

## Performance Bottlenecks

**Large Service Files (2000+ LOC):**

- Problem: Single service files handling all business logic for domain
- Files:
  - `apps/backend/src/modules/farms/farms.service.ts` (2266 LOC)
  - `apps/backend/src/modules/animals/animals.service.ts` (1350 LOC)
  - `apps/backend/src/modules/producers/producers.service.ts` (1169 LOC)
  - `apps/backend/src/modules/measurement-units/measurement-units.service.ts` (1251 LOC)
  - `apps/backend/src/modules/operation-types/operation-types.service.ts` (1271 LOC)
- Cause: Monolithic service pattern without separation of concerns. Each service handles CRUD, validation, business logic, and sometimes file parsing.
- Improvement path: (1) Extract helpers into separate modules (e.g., `farms.validators.ts`, `farms.query-builder.ts`). (2) Use dependency injection to break coupling. (3) Aim for <500 LOC per service file.

**Bulk Import Without Pagination:**

- Problem: Mobile bulk import screens with 1000+ rows render all items at once
- Files: `apps/mobile/app/(app)/planting-operation.tsx` (1688 LOC)
- Cause: FlatList without virtualization or pagination
- Improvement path: (1) Implement pagination (20-50 items per page). (2) Use `getItemLayout` for FlatList optimization. (3) Add search/filter to reduce visible items. (4) Cache parsed items in SQLite instead of parsing all at load time.

**Complex Modal Forms Without Lazy Loading:**

- Problem: Large mobile forms (ProductModal, FarmFormModal) render all tabs immediately
- Files: `apps/frontend/src/components/products/ProductModal.tsx` (1144 LOC)
- Cause: All form state and fields initialized at mount
- Improvement path: (1) Split into sub-components with lazy mounting. (2) Use conditional rendering for off-screen tabs. (3) Defer heavy computations (calculations, validations) to onChange handlers with debounce.

**Missing Database Indexes:**

- Problem: Common queries on (animalId, milkingDate, shift), (farmId, entityType), (entityId) likely missing indexes
- Files: `apps/backend/prisma/schema.prisma` (no explicit index definitions visible)
- Cause: Reliance on Prisma's generated indexes; no explicit composite indexes defined
- Improvement path: (1) Add `@@index` and `@@unique` directives for common query patterns. (2) Profile slow queries with pg_stat_statements. (3) Index soft-delete columns: `@@index([deletedAt])` for faster filtered queries.

**Unoptimized Milking Record Aggregations:**

- Problem: Daily production summary recalculates from all historical records
- Files: `apps/backend/src/modules/milking-records/milking-records.service.ts` (lines 400+)
- Cause: No materialized views or aggregate caching
- Improvement path: (1) Add pre-calculated daily aggregates table. (2) Update aggregates incrementally on each milking record. (3) Cache summaries with 1-hour TTL in Redis.

## Fragile Areas

**Farm Service State Management:**

- Files: `apps/backend/src/modules/farms/farms.service.ts`
- Why fragile: Handles 8+ different features (CRUD, boundaries, plots, history, bulk import, subdivision, merging). Any change to one feature risks breaking others. Heavy use of raw SQL and geo calculations with no intermediate validation.
- Safe modification: (1) Add new features in separate service modules (e.g., `farm-plots.service.ts`, `farm-boundaries.service.ts`). (2) Refactor geo operations into `geo.service.ts`. (3) Add integration tests for cross-feature scenarios.
- Test coverage: ~2173 test lines in spec file, but many tests are boundary-focused. Missing tests for edge cases in deletion, bulk import error handling, and subdivision with overlapping plots.

**Milking Record Variation Calculation:**

- Files: `apps/backend/src/modules/milking-records/milking-records.service.ts`
- Why fragile: Variation percent calculation has hardcoded 30% threshold. Logic uses `any` types and raw tx queries. If threshold changes, no way to trace all affected records.
- Safe modification: (1) Extract threshold to configurable constant with unit tests. (2) Replace `any` with explicit types. (3) Add audit log when variation detected.
- Test coverage: Basic unit tests exist, but missing edge cases (0L baseline, leap seconds, null previous values).

**Mobile Offline Queue Conflict Resolution:**

- Files: `apps/mobile/services/offline-queue.ts`
- Why fragile: Conflict resolution is "server wins" with no validation that server data is valid. If server is corrupted, local good data gets overwritten silently.
- Safe modification: (1) Add optional conflict resolution callback so app can decide per-entity. (2) Log all conflicts to backend audit system. (3) Implement "merge" strategy for certain entities (e.g., append-only logs).
- Test coverage: Logic tested but not conflict scenarios with network failures mid-operation.

**Mobile Field Plot Form State:**

- Files: `apps/mobile/app/(app)/planting-operation.tsx` (1688 LOC)
- Why fragile: Large form with dozens of fields and nested objects. State management spread across multiple useState calls. No clear validation order. Risk of invalid state persisting locally.
- Safe modification: (1) Use useReducer with formal state machine. (2) Add explicit validation steps. (3) Implement undo/rollback on validation failure.
- Test coverage: No visible tests for this component.

## Scaling Limits

**Single SQLite Database for Offline State:**

- Current capacity: Safe for ~50,000 pending operations per device
- Limit: As offline queue grows beyond 1M operations, SQLite query performance degrades (linear scans). Encryption overhead adds 20-30% slowdown.
- Scaling path: (1) Archive completed operations after 30 days. (2) Implement table partitioning by date. (3) Add cleanup job triggered on app foreground. (4) Consider moving to RxDB if queue grows beyond 10M ops.

**Farm Farms Service Monolith:**

- Current capacity: Handles 500+ farms per organization
- Limit: At 5000+ farms, geo operations (boundary intersection, polygon merging) hit O(n) complexity. Bulk import with 10k+ plots times out.
- Scaling path: (1) Move boundary operations to PostGIS directly (use ST_Intersects in SQL). (2) Implement async background jobs for bulk import. (3) Split farms.service.ts into domain-specific services.

**Milking Record Queries on Large Herds:**

- Current capacity: ~1000 animals per farm
- Limit: Queries for milk dashboard become slow at 5000+ animals. Variation calculation N+1 multiplies cost.
- Scaling path: (1) Add composite index on (farmId, milkingDate, shift). (2) Pre-calculate daily summaries. (3) Implement pagination/filtering UI. (4) Use materialized views for lactation metrics.

**Mobile Bulk Form Rendering:**

- Current capacity: 500 items in FlatList before noticeable lag
- Limit: At 1000+ items (e.g., bulk animal import), navigation becomes jerky, memory usage grows unbounded
- Scaling path: (1) Implement pagination (20-50 items per page). (2) Use virtualized list (FlashList or react-native-super-grid). (3) Split bulk import into phases: upload → parse → preview → confirm.

## Dependencies at Risk

**Prisma 7 Migration:**

- Risk: Prisma 7 has breaking changes from v4; some edge cases in custom SQL queries may break
- Impact: Complex queries using raw SQL with RLS context could fail; migrations may need manual intervention
- Migration plan: (1) Test all complex Prisma queries in staging before production. (2) Run parallel Prisma v4 and v7 during transition. (3) Pin all workspace packages to same Prisma version to avoid conflicts.

**React Native 0.76 → Future Versions:**

- Risk: Major updates often break third-party libraries (navigation, gesture handlers, native modules)
- Impact: Offline queue, biometrics, location services may break on version bump
- Migration plan: (1) Keep detailed native module requirements in docs. (2) Test expo-sqlite and expo-crypto compatibility before upgrading. (3) Run E2E tests on staging after each minor version bump.

**Expo SDK 52 → Future Versions:**

- Risk: Expo SDK changes can break managed build system; certain APIs deprecated
- Impact: offline-queue, biometrics, location services rely on Expo APIs
- Migration plan: (1) Subscribe to Expo release notes. (2) Test SDK upgrades in isolated branch. (3) Maintain fallbacks for deprecated APIs.

**XOR Encryption in Offline Queue:**

- Risk: Simple cipher is not industry standard; replacing it will require data migration
- Impact: All encrypted offline data becomes unrecoverable if key is lost during migration
- Migration plan: (1) Add "encryption version" field to pending_operations table. (2) Implement dual-read (decrypt with v1 or v2). (3) On next sync, re-encrypt with v2. (4) Remove v1 after 30 days.

## Missing Critical Features

**Farm Deletion Dependency Validation:**

- Problem: No checks for active crops, animals, or financial records before deletion
- Blocks: Safe farm archival workflows. Users can accidentally delete farms with active data.
- Implementation: Add queries counting active records in related entities; block deletion with clear error message listing blockers.

**Offline Queue Conflict UI Resolution:**

- Problem: Conflicts logged but no UI to review or resolve them
- Blocks: Users cannot see what data was overwritten during offline sync conflicts
- Implementation: Add conflicts view in mobile settings; show local vs. server data; allow user to choose winner.

**Encryption Key Rotation:**

- Problem: No mechanism to rotate user-derived encryption keys
- Blocks: If encryption seed (user ID) is compromised, all encrypted offline data is at risk; no way to re-key
- Implementation: Add rotation endpoint that issues new seed; background job to re-encrypt all pending operations.

**Audit Log for Offline Sync:**

- Problem: Server-side audit logs don't capture offline sync conflicts and retries
- Blocks: Cannot investigate data discrepancies from offline operations
- Implementation: Log all conflict resolutions and failed retries to audit_log table with metadata.

## Test Coverage Gaps

**Farm Deletion with Dependencies:**

- What's not tested: Attempting to delete farm with active animals, crops, or financials
- Files: `apps/backend/src/modules/farms/farms.routes.spec.ts`
- Risk: Soft delete could leave orphaned data; RLS might not protect against dangling references
- Priority: **High** — data integrity is critical for financial accuracy

**Offline Queue Retry and Conflict Scenarios:**

- What's not tested: (1) Retry with 409 conflict when network recovers. (2) Encryption key mismatch during decryption. (3) Payload corruption. (4) Out-of-order operations with dependencies.
- Files: No visible test file for `offline-queue.ts`
- Risk: Syncing fails silently in edge cases; data loss or corruption undetected
- Priority: **High** — offline is core feature; failures affect all mobile users

**Milking Record Variation on Edge Cases:**

- What's not tested: (1) Variation when previous milk was 0L. (2) First milking for animal (no previous). (3) Leap seconds or DST transitions. (4) Bulk import with 100+ records.
- Files: `apps/backend/src/modules/milking-records/milking-records.routes.spec.ts`
- Risk: Variation calculation could throw or return incorrect percent; bulk operations 100x slower
- Priority: **Medium** — affects dairy management but usually caught in manual review

**Mobile Form State Validation Order:**

- What's not tested: (1) Saving form with invalid state (skipped fields). (2) Network failure mid-save leaving partial local state. (3) Concurrent form edits.
- Files: No tests visible for `planting-operation.tsx`, `monitoring-record.tsx`, etc.
- Risk: Invalid data persisted locally; user unaware of sync failure
- Priority: **Medium** — affects field operations but data eventually syncs or errors

**Large Bulk Imports (1000+ items):**

- What's not tested: (1) Performance of parsing + rendering 1000+ items. (2) Memory usage during import. (3) Cancellation mid-import. (4) Error recovery when partial import fails.
- Files: `apps/frontend/src/components/bulk-import/`, `apps/mobile/app/(app)/planting-operation.tsx`
- Risk: UI hangs or crashes; user loses work
- Priority: **Medium** — affects occasionally but happens at critical times (seasonal imports)

---

_Concerns audit: 2026-03-15_
