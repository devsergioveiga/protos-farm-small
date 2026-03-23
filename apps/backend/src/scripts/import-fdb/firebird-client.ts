/**
 * Firebird client via Docker isql.
 * Uses `docker exec` to run queries with `-nod` (no database triggers)
 * to bypass UDF dependencies (SU$APPENDBLOBTOFILE).
 */
import { execSync } from 'child_process';

const CONTAINER = 'fb25_reader';
const DB_PATH = '/firebird/data/DADOS988.FDB';
const ISQL = '/usr/local/firebird/bin/isql';

export interface FirebirdRow {
  [key: string]: string | number | null;
}

/**
 * Ensure the Firebird Docker container is running.
 */
export function ensureContainer(fdbPath: string): void {
  const running = execSync(`docker ps --filter name=${CONTAINER} --format '{{.Names}}'`)
    .toString()
    .trim();

  if (running === CONTAINER) {
    console.log(`  ✓ Container ${CONTAINER} already running`);
    return;
  }

  // Stop if exists but stopped
  execSync(`docker rm -f ${CONTAINER} 2>/dev/null || true`);

  console.log(`  Starting Firebird container...`);
  execSync(
    `docker run --rm -d --name ${CONTAINER} ` +
      `-v "${fdbPath}:${DB_PATH}" ` +
      `-e ISC_PASSWORD=masterkey ` +
      `jacobalberty/firebird:2.5-ss`,
    { stdio: 'pipe' },
  );

  // Wait for server to be ready
  execSync('sleep 3');
  console.log(`  ✓ Container ${CONTAINER} started`);
}

/**
 * Execute a SQL query against Firebird and return parsed rows.
 * Uses SET LIST ON format for reliable parsing.
 */
export function query(sql: string): FirebirdRow[] {
  // Normalize multiline SQL to single line, ensure semicolon, and escape quotes
  let normalizedSql = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalizedSql.endsWith(';')) normalizedSql += ';';
  const escapedSql = normalizedSql.replace(/'/g, "'\\''");

  const cmd =
    `docker exec ${CONTAINER} sh -c 'echo "SET LIST ON; ${escapedSql}" | ` +
    `${ISQL} -u SYSDBA -p masterkey -nod -ch WIN1252 ${DB_PATH}'`;

  const raw = execSync(cmd, {
    maxBuffer: 200 * 1024 * 1024, // 200MB for large tables
    encoding: 'latin1', // WIN1252 ≈ latin1 for most chars
  });

  return parseListOutput(raw);
}

/**
 * Execute a query in batches using FIRST/SKIP for large tables.
 * Yields rows in chunks to avoid memory issues.
 */
export function* queryBatched(
  sql: string,
  tableName: string,
  batchSize = 5000,
): Generator<FirebirdRow[]> {
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batchSql = sql
      .replace(/^SELECT /i, `SELECT FIRST ${batchSize} SKIP ${offset} `)
      .trim();

    const rows = query(batchSql);

    if (rows.length === 0) {
      hasMore = false;
    } else {
      yield rows;
      offset += rows.length;
      process.stdout.write(`  ${tableName}: ${offset} rows extracted\r`);

      if (rows.length < batchSize) {
        hasMore = false;
      }
    }
  }

  console.log(`  ${tableName}: ${offset} rows total`);
}

/**
 * Parse isql SET LIST ON output into row objects.
 *
 * Format:
 *   FIELD1                  value1
 *   FIELD2                  value2
 *   <blank line>
 *   FIELD1                  value3
 *   ...
 */
function parseListOutput(raw: string): FirebirdRow[] {
  const rows: FirebirdRow[] = [];
  let current: FirebirdRow = {};
  let hasFields = false;

  for (const line of raw.split('\n')) {
    // Skip empty lines (row separator) or header lines
    const trimmed = line.trimEnd();

    if (trimmed === '' || trimmed.startsWith('=')) {
      if (hasFields) {
        rows.push(current);
        current = {};
        hasFields = false;
      }
      continue;
    }

    // LIST format: "FIELDNAME                       value"
    // The field name is left-padded, value starts after whitespace
    const match = trimmed.match(/^(\S+)\s{2,}(.*)$/);
    if (match) {
      const [, fieldName, rawValue] = match;
      const key = fieldName.trim().toLowerCase();
      const value = rawValue.trim();

      current[key] = parseValue(value);
      hasFields = true;
    }
  }

  // Don't forget last row
  if (hasFields) {
    rows.push(current);
  }

  return rows;
}

/**
 * Parse a Firebird value string to JS type.
 */
function parseValue(value: string): string | number | null {
  if (value === '<null>') return null;

  // Try integer
  if (/^-?\d+$/.test(value)) {
    const n = parseInt(value, 10);
    if (n >= Number.MIN_SAFE_INTEGER && n <= Number.MAX_SAFE_INTEGER) return n;
  }

  // Try float (Firebird uses . as decimal separator in LIST mode)
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  return value;
}

/**
 * Get row count for a table.
 */
export function count(tableName: string): number {
  const rows = query(`SELECT COUNT(*) AS CNT FROM ${tableName}`);
  return (rows[0]?.cnt as number) ?? 0;
}

/**
 * Stop the Firebird container.
 */
export function stopContainer(): void {
  execSync(`docker stop ${CONTAINER} 2>/dev/null || true`);
  console.log(`  ✓ Container ${CONTAINER} stopped`);
}
