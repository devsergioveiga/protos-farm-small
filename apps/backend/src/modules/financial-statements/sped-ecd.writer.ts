// ─── SpedEcdWriter ────────────────────────────────────────────────────────────
// Pure class — no Prisma imports. Formats SpedEcdInput into pipe-delimited
// SPED Contabil ECD text with Blocos 0, I, J, 9.
//
// SPED ECD format rules:
// - Each line: |FIELD1|FIELD2|...|FIELDN|\r\n
// - Dates: DDMMAAAA (e.g. 01012025)
// - Amounts: period decimal, no thousand separator (e.g. 1234.56)
// - CRLF line endings

import { format } from 'date-fns';
import Decimal from 'decimal.js';
import type { SpedEcdInput } from './sped-ecd.types';

export class SpedEcdWriter {
  private readonly input: SpedEcdInput;
  private lines: string[] = [];
  private registerCounts = new Map<string, number>();
  private lineCount = 0;

  constructor(input: SpedEcdInput) {
    this.input = input;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public generate(): string {
    this.lines = [];
    this.registerCounts = new Map();
    this.lineCount = 0;

    this.writeBloco0();
    this.writeBlocoI();
    this.writeBlocoJ();
    this.writeBloco9();

    return this.lines.join('');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Append a formatted SPED line: |f1|f2|...|fN|\r\n */
  private line(regType: string, fields: (string | number | null)[]): void {
    const all = [regType, ...fields];
    const formatted = '|' + all.map((f) => (f == null ? '' : String(f))).join('|') + '|\r\n';
    this.lines.push(formatted);
    this.lineCount++;
    this.registerCounts.set(regType, (this.registerCounts.get(regType) ?? 0) + 1);
  }

  /** Format Date to DDMMAAAA */
  private formatDate(d: Date): string {
    return format(d, 'ddMMyyyy');
  }

  /** Format decimal string: period decimal, 2 fixed places, no thousand sep */
  private formatAmount(val: string): string {
    return new Decimal(val).toFixed(2);
  }

  /** COD_NAT: ATIVO=01, PASSIVO=02, PL=03, RECEITA=04, DESPESA=04 */
  private codNat(accountType: string): string {
    switch (accountType) {
      case 'ATIVO':
        return '01';
      case 'PASSIVO':
        return '02';
      case 'PL':
        return '03';
      case 'RECEITA':
        return '04';
      case 'DESPESA':
        return '04';
      default:
        return '01';
    }
  }

  /**
   * IND_DC: D if DEVEDORA nature (or positive balance for devedora accounts),
   *         C if CREDORA nature (or positive balance for credora accounts)
   */
  private indDc(accountNature: string, _balance: string): string {
    return accountNature === 'DEVEDORA' ? 'D' : 'C';
  }

  // ─── Bloco 0 ──────────────────────────────────────────────────────────────

  private writeBloco0(): void {
    const { org, fiscalYearStart, fiscalYearEnd } = this.input;
    const dtIni = this.formatDate(fiscalYearStart);
    const dtFin = this.formatDate(fiscalYearEnd);

    // 0000 — SPED header
    this.line('0000', [
      'LECD',        // TIPO_ESCRT
      dtIni,         // DT_INI
      dtFin,         // DT_FIN
      org.name,      // NOME
      org.cnpj,      // CNPJ
      org.uf,        // UF
      org.ie,        // IE
      org.codMun,    // COD_MUN
      org.im,        // IM
      '',            // IND_SIT_ESP (blank = normal)
      '0',           // IND_SIT_ESP_DETALHE (0 = not in special situation)
      '0',           // IND_NIRE
      '0',           // IND_FIN_ESC
      '',            // COD_SCP
      '',            // HASH_ESCR
      '',            // NR_LINHAS
    ]);

    // 0001 — Bloco 0 open
    this.line('0001', ['1']);

    // 0007 — Book identification (Tipo G = Livro Diário)
    this.line('0007', [
      'Livro 1',  // COD_LIVR
      '1',        // NUM_ORD
      'G',        // TIP_LIVR (G = Livro Diário)
      dtIni,      // DT_INI
      dtFin,      // DT_FIN
      '1',        // QTD_LINHAS (placeholder)
      '',         // COD_HASH
    ]);

    // 0990 — Bloco 0 close
    const count0 = (this.registerCounts.get('0000') ?? 0)
      + (this.registerCounts.get('0001') ?? 0)
      + (this.registerCounts.get('0007') ?? 0)
      + 1; // 0990 itself
    this.line('0990', [String(count0)]);
  }

  // ─── Bloco I ──────────────────────────────────────────────────────────────

  private writeBlocoI(): void {
    const { org, accounts, monthlyBalances, journalEntries, costCenters, fiscalYearStart } = this.input;

    // I001 — Bloco I open
    this.line('I001', ['1']);

    // I010 — Writing software identification
    this.line('I010', [
      'Protos Farm',  // VRS_AAC
      '1.0',          // DT_VRS_AAC
    ]);

    // I050/I051 — Chart of accounts (all active accounts, synthetic + analytic)
    for (const acct of accounts) {
      const indCta = acct.isSynthetic ? 'S' : 'A';
      const codNat = this.codNat(acct.accountType);

      this.line('I050', [
        this.formatDate(fiscalYearStart),  // DT_ALT
        codNat,                             // COD_NAT
        indCta,                             // IND_CTA (S=synthetic, A=analytic)
        String(acct.level),                 // NIVEL
        acct.code,                          // COD_CTA
        acct.parentCode ?? '',              // COD_CTA_SUP
        acct.name,                          // CTA_NAME
      ]);

      // I051 — only for analytic accounts with spedRefCode
      if (!acct.isSynthetic && acct.spedRefCode) {
        this.line('I051', [
          acct.spedRefCode,  // COD_AGL (L300R referential code)
          '',                // IND_COD_AGL
        ]);
      }
    }

    // I100 — Cost centers
    for (const cc of costCenters) {
      this.line('I100', [
        cc.code,  // COD_CTA_CUS
        cc.name,  // DESC_CUS
      ]);
    }

    // I150/I155 — Monthly balances (analytic accounts only)
    // Group balances by month
    const balancesByMonth = new Map<string, typeof monthlyBalances>();
    for (const bal of monthlyBalances) {
      const key = `${bal.year}-${String(bal.month).padStart(2, '0')}`;
      if (!balancesByMonth.has(key)) balancesByMonth.set(key, []);
      balancesByMonth.get(key)!.push(bal);
    }

    // Get analytic accounts for I155
    const analyticAccounts = new Set(accounts.filter((a) => !a.isSynthetic).map((a) => a.code));

    for (const [, bals] of balancesByMonth) {
      if (bals.length === 0) continue;
      const firstBal = bals[0];
      // Build I150 month start/end
      const monthStart = new Date(firstBal.year, firstBal.month - 1, 1);
      const monthEnd = new Date(firstBal.year, firstBal.month, 0); // last day of month

      this.line('I150', [
        this.formatDate(monthStart),  // DT_INI
        this.formatDate(monthEnd),    // DT_FIN
      ]);

      for (const bal of bals) {
        if (!analyticAccounts.has(bal.accountCode)) continue;
        const acct = accounts.find((a) => a.code === bal.accountCode);
        const nature = acct?.accountNature ?? 'DEVEDORA';

        this.line('I155', [
          bal.accountCode,                              // COD_CTA
          '',                                            // COD_CTA_CUS (blank = no CC)
          this.formatAmount(bal.openingBalance),         // VL_SLD_INI
          this.indDc(nature, bal.openingBalance),        // IND_DC_INI
          this.formatAmount(bal.totalDebits),            // VL_DEB
          this.formatAmount(bal.totalCredits),           // VL_CRED
          this.formatAmount(bal.closingBalance),         // VL_SLD_FIN
          this.indDc(nature, bal.closingBalance),        // IND_DC_FIN
        ]);
      }
    }

    // I200/I250 — Journal entries (analytic accounts only in I250)
    for (const entry of journalEntries) {
      this.line('I200', [
        String(entry.entryNumber),            // NUM_LCTO
        this.formatDate(entry.entryDate),     // DT_LCTO
        this.formatAmount(entry.totalDebit),  // VL_LCTO
        'N',                                  // IND_LCTO (N = normal)
      ]);

      for (const lineItem of entry.lines) {
        const dc = lineItem.isDebit ? 'D' : 'C';
        this.line('I250', [
          lineItem.accountCode,                  // COD_CTA
          '',                                     // COD_CTA_CUS
          this.formatAmount(lineItem.amount),     // VL_DC
          dc,                                     // IND_DC
          String(entry.entryNumber),              // NUM_LCTO
          lineItem.description,                   // HIST
          this.formatDate(entry.entryDate),        // DT_LCTO
        ]);
      }
    }

    // I990 — Bloco I close
    // Count all I-block lines + 1 for I990 itself
    let iCount = 0;
    for (const [key, cnt] of this.registerCounts) {
      if (key.startsWith('I')) iCount += cnt;
    }
    iCount += 1; // I990 itself
    this.line('I990', [String(iCount)]);
  }

  // ─── Bloco J ──────────────────────────────────────────────────────────────

  private writeBlocoJ(): void {
    const { fiscalYearStart, fiscalYearEnd, bpRows, dreRows, dlpaRows } = this.input;

    // J001 — Bloco J open
    this.line('J001', ['1']);

    // J005 — Period header
    this.line('J005', [
      this.formatDate(fiscalYearStart),  // DT_INI
      this.formatDate(fiscalYearEnd),    // DT_FIN
      '0',                               // COD_AGL (0 = no grouping)
    ]);

    // J100 — Balance Sheet (BP)
    for (let i = 0; i < bpRows.length; i++) {
      const row = bpRows[i];
      const level = '1'; // simplified level
      const sup = ''; // top-level
      const indAgl = 'T'; // T = total, D = detail

      this.line('J100', [
        row.spedRefCode,                              // COD_AGL
        indAgl,                                       // IND_COD_AGL
        level,                                        // NIVEL_AGL
        sup,                                          // COD_AGL_SUP
        row.groupIndicator,                           // IND_GRP_BAL (A=Ativo, P=Passivo+PL)
        row.name,                                     // DESCR
        this.formatAmount(row.openingAmount),          // VL_CTA_INI
        row.openingIsDebit ? 'D' : 'C',               // IND_DC_INI
        this.formatAmount(row.closingAmount),          // VL_CTA_FIN
        row.closingIsDebit ? 'D' : 'C',               // IND_DC_FIN
      ]);
    }

    // J150 — DRE
    for (const row of dreRows) {
      const indGrpDre = row.isDebit ? 'D' : 'R'; // D=Despesa, R=Receita
      this.line('J150', [
        row.spedRefCode,              // COD_AGL
        'T',                          // IND_COD_AGL
        '1',                          // NIVEL_AGL
        '',                           // COD_AGL_SUP
        row.name,                     // DESCR
        this.formatAmount(row.amount), // VL_CTA
        row.isDebit ? 'D' : 'C',      // IND_DC
        indGrpDre,                    // IND_GRP_DRE
      ]);
    }

    // J210 — DLPA (Demonstracao de Lucros e Prejuizos Acumulados)
    for (const row of dlpaRows) {
      this.line('J210', [
        '0',                                          // NUM_LINHA
        row.spedRefCode,                              // COD_AGL
        row.name,                                     // DESCR
        this.formatAmount(row.openingAmount),          // VL_CTA_INI
        row.openingIsDebit ? 'D' : 'C',               // IND_DC_INI
        this.formatAmount(row.closingAmount),          // VL_CTA_FIN
        row.closingIsDebit ? 'D' : 'C',               // IND_DC_FIN
      ]);
    }

    // J990 — Bloco J close
    let jCount = 0;
    for (const [key, cnt] of this.registerCounts) {
      if (key.startsWith('J')) jCount += cnt;
    }
    jCount += 1; // J990 itself
    this.line('J990', [String(jCount)]);
  }

  // ─── Bloco 9 ──────────────────────────────────────────────────────────────

  private writeBloco9(): void {
    // 9001 — Bloco 9 open
    this.line('9001', ['1']);

    // Snapshot current counts (before writing 9900 lines)
    const snapshotCounts = new Map(this.registerCounts);

    // Calculate how many 9900 lines we'll write (one per unique register type + 9001 + 9990 + 9999)
    const typesForCounting = new Set([
      ...Array.from(snapshotCounts.keys()),
      '9001',
      '9900',
      '9990',
      '9999',
    ]);

    // 9900 — counts per register type
    const sortedTypes = Array.from(typesForCounting).sort();
    for (const regType of sortedTypes) {
      let count = snapshotCounts.get(regType) ?? 0;
      // Adjust for registers that will be written in Bloco 9
      if (regType === '9001') count = 1;
      if (regType === '9990') count = 1;
      if (regType === '9999') count = 1;
      if (regType === '9900') count = sortedTypes.length; // one per type
      this.line('9900', [regType, String(count)]);
    }

    // 9990 — Bloco 9 close (count of Bloco 9 lines + 1 for 9990 itself)
    let blk9Count = 0;
    for (const [key, cnt] of this.registerCounts) {
      if (key === '9001' || key === '9900' || key === '9990' || key === '9999') {
        blk9Count += cnt;
      }
    }
    blk9Count += 1; // 9990 itself
    this.line('9990', [String(blk9Count)]);

    // 9999 — Total file line count (including 9999 itself)
    const totalLines = this.lineCount + 1; // +1 for 9999 itself
    this.line('9999', [String(totalLines)]);
  }
}
