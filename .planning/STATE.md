# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Phase 1 — Fundação Financeira

## Current Position

Phase: 1 of 6 (Fundação Financeira)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-15 — Roadmap criado com 6 fases cobrindo 15 requirements (FN-01 a FN-15)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| -     | -     | -     | -        |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

_Updated after each plan completion_

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 1]: producerId obrigatório como FK em BankAccount desde a primeira migration — sem isso não há isolamento fiscal por produtor rural
- [Phase 1]: Tipo Money (decimal.js) deve ser estabelecido em packages/shared antes de qualquer dado financeiro ser gravado — retrofitting exige auditoria completa
- [Phase 2]: CNAB deve usar padrão CnabAdapter por banco (não uma função genérica) — bancos rurais (Sicoob, Sicredi, BB) têm extensões proprietárias
- [Phase 4]: Cheques pré-datados são entidade de primeira classe com máquina de estados — não campo metadata em pagamento
- [Phase 5]: Horizonte de fluxo de caixa é 12 meses obrigatório — sazonalidade agrícola torna 90 dias inútil
- [Phase 5]: Antes de implementar, verificar status do ofx-js no npm; fallback: @xmldom/xmldom (já instalado) + parser SGML customizado

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 5]: ofx-js — verificar manutenção ativa no npm antes de adotar. Fallback documentado: @xmldom/xmldom
- [Phase 5]: Coletar amostras reais de OFX de BB, Bradesco, Sicoob antes de projetar o motor de matching
- [Phase 6]: Verificar rates atuais do Plano Safra 2025/2026 no BCB MCR antes de implementar — dados de treino podem estar desatualizados
- [Phase 6]: Obter manuais de layout CNAB Sicoob/Sicredi antes de implementar adapters para crédito rural

## Session Continuity

Last session: 2026-03-15
Stopped at: Roadmap criado e aprovado — pronto para /gsd:plan-phase 1
Resume file: None
