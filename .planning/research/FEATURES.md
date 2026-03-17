# Feature Research

**Domain:** Procurement / Purchasing Module (Gestao de Compras) — Farm Management ERP Brazil
**Researched:** 2026-03-17
**Confidence:** HIGH — ERP procurement is a mature domain with well-established patterns; verified against ERPNext, SAP, NetSuite, Dynamics 365 documentation.

---

## Context: What Already Exists

The system already ships:

- `payables` module — CP with installments, cost center rateio, CNAB, aging, alerts
- `stock-entries` module — entries with accessory expense rateio, custo medio ponderado
- `stock-outputs` module — FEFO, historical movements, CSV export
- `products` module — product catalog with measurement units and conversions
- `producers` module — fiscal entity (CNPJ/CPF) linked to bank accounts
- `cost-centers` module — fazenda/setor rateio

The procurement module is NOT building financial infrastructure from scratch. It is building the upstream P2P (Purchase-to-Pay) flow that feeds the existing `payables` and `stock-entries` modules. The most important integration point is GRN confirmation: one action creates both a CP and a stock entry automatically.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a procurement module must have. Missing any of these makes the module feel broken or incomplete to a purchasing or finance manager.

| Feature                                                | Why Expected                                                                                                                                                  | Complexity | Notes                                                                                                                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supplier registration with fiscal data                 | Every purchase has a fiscal counterpart (CNPJ/CPF, IE). Without structured supplier data, CP generation is manual and error-prone.                            | MEDIUM     | Fields: razao social, nome fantasia, CNPJ/CPF, inscricao estadual, endereco, contatos, payment terms. Same fiscal entity pattern as `producers`.                                               |
| Multiple contacts per supplier                         | Farms deal with sales reps, billing contacts, and logistics contacts at the same supplier simultaneously                                                      | LOW        | Contact fields: name, role, phone, email. At least one contact marked as "principal".                                                                                                          |
| Supplier search and filtering                          | Supplier list grows fast; without search the module is unusable at 50+ suppliers                                                                              | LOW        | Filter by: name, CNPJ fragment, product category, status (active/inactive)                                                                                                                     |
| Supplier payment terms defaults                        | Each supplier has preferred terms (30/60/90 dias); default on OC avoids repeated manual entry                                                                 | LOW        | Stored on supplier, copied to OC at creation, editable per OC                                                                                                                                  |
| Purchase Requisition (RC) creation                     | Entry point of any traceable procurement workflow. Without it, purchases are ad-hoc and unauditable.                                                          | MEDIUM     | Fields: requester, date needed, items (product + qty + estimated unit price), cost center, farm, justification, urgency flag (normal/urgente)                                                  |
| RC items linked to existing product catalog            | Requisitions must reference real products for stock integration to work automatically                                                                         | LOW        | Search from existing `products` module; allow free-text for items not yet cataloged (flagged for product creation)                                                                             |
| RC approval workflow with value thresholds             | Core financial control requirement. No approval = no accountability or budget protection.                                                                     | HIGH       | Configurable alcadas: up to R$X = auto-approve, R$X to R$Y = supervisor, above R$Y = director. State machine: RASCUNHO -> SUBMETIDA -> APROVADA / REJEITADA. Rejection requires comment.       |
| Request for Quotation (Cotacao) to multiple suppliers  | Required for fiscal compliance and cost control in any structured farm operation. Brazilian agro law mandates competitive quotation above certain thresholds. | MEDIUM     | Attach RC items, select 2-5 suppliers, set response deadline, record via email or manual entry                                                                                                 |
| Manual supplier quotation registration                 | Not all agro suppliers have email or a portal. Manual entry is the baseline that must work without any external dependency.                                   | LOW        | Per-item registration: unit price, available quantity, delivery time, payment terms, validity date                                                                                             |
| Quotation comparison map (mapa comparativo)            | Core decision support tool. Buyers need side-by-side item-level comparison across all responding suppliers to justify winner selection.                       | MEDIUM     | Matrix view: rows = items, columns = suppliers, highlight lowest price per item, show non-responding suppliers, compute line totals and grand total per supplier                               |
| Winner selection with justification                    | Must formalize which supplier was chosen and why, creating an audit trail.                                                                                    | LOW        | Mark winning supplier per item (can split order across suppliers), record approval user + timestamp + optional justification note                                                              |
| Purchase Order (OC) generation from approved quotation | Formal purchase commitment document required before receiving goods.                                                                                          | MEDIUM     | Generate OC with: supplier, items, agreed prices, delivery date, payment terms, cost center rateio, OC number (sequential per org)                                                             |
| OC PDF export                                          | Suppliers expect a formal document; required for email dispatch.                                                                                              | LOW        | Use existing pdfkit pattern. Include: OC number, farm CNPJ, items, unit prices, totals, payment terms, delivery address, signature line                                                        |
| OC status tracking                                     | Managers need to know which OCs are open, partially received, or closed                                                                                       | LOW        | States: EMITIDA -> RECEBIMENTO_PARCIAL -> ENCERRADA / CANCELADA                                                                                                                                |
| Goods Receiving (Recebimento / GRN)                    | Physical confirmation that goods arrived. This is the most critical event: it triggers both stock update and CP generation.                                   | HIGH       | 6 explicit scenarios (see below). 3-way match against OC. Captures NF data (numero, serie, data, valor total, chave NF-e).                                                                     |
| Automatic CP generation from GRN + NF data             | Core P2P integration with the existing `payables` module. Eliminates double-entry and ensures every receipt creates a payable.                                | MEDIUM     | On GRN confirmation: create CP with supplier as vendor, NF value as amount, installments from OC payment terms (reuse existing installmentGenerator from packages/shared), cost center from OC |
| Automatic stock entry from GRN                         | Core integration with the existing `stock-entries` module. Eliminates double-entry and ensures received goods enter stock at the correct cost.                | MEDIUM     | On GRN confirmation: create stock entry with received items, quantities, unit costs calculated from NF value                                                                                   |
| GRN with discrepancy handling                          | Quantities or prices frequently differ from OC in agro purchasing (weight-based products, price updates). Must not block legitimate receipts.                 | MEDIUM     | Tolerance bands configurable per org (default ±3%). Within tolerance: auto-accept. Outside tolerance: flag for buyer review before closing.                                                    |
| Purchase return (Devolucao) with supplier credit       | Goods rejected at receiving or after quality check must be returned with financial credit from supplier.                                                      | HIGH       | Reverse stock entry, generate credit note linked to original CP. States: SOLICITADA -> APROVADA -> ENVIADA -> CREDITO_RECEBIDO                                                                 |
| Kanban / pipeline view of procurement flow             | Managers and buyers need a real-time view of what is pending approval, awaiting delivery, or blocked.                                                         | MEDIUM     | Columns: RC Pendente -> Cotacao -> Aprovacao OC -> OC Emitida -> Aguardando Recebimento -> Encerrada. Filter by farm, buyer, date range.                                                       |
| Purchasing history per supplier                        | Buyers need price history to negotiate; auditors need traceability per supplier relationship.                                                                 | LOW        | List of all OCs + GRNs per supplier with items, values, delivery performance, and return history                                                                                               |
| Email notifications at each workflow step              | Users not logged in must be notified when action is required from them (approval, quotation response deadline, OC sent).                                      | MEDIUM     | Triggered by: RC submitted for approval, RC approved/rejected, OC emitted to supplier, GRN created                                                                                             |

### Goods Receiving Scenarios (Detail)

The 6 receiving scenarios are a well-known ERP pattern (SAP MIGO, ERPNext GRN). Each creates different state machine paths and must be explicitly designed.

| Scenario                              | Description                                              | Handling                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1. NF antecipada                      | Supplier sends NF before delivering goods                | Register NF data and park. No stock entry until physical receipt confirmed. GRN in state AGUARDANDO_ENTREGA.                            |
| 2. Recebimento normal                 | Standard: truck arrives with goods and NF simultaneously | GRN creation + stock entry + CP generation in one confirmed flow. Most common scenario.                                                 |
| 3. Recebimento parcial                | Supplier delivers part of OC; remainder is pending       | GRN for received items only, OC stays open for remainder, CP created for received portion value. OC status becomes RECEBIMENTO_PARCIAL. |
| 4. Compra emergencial                 | Goods must enter stock immediately; no OC exists         | Open GRN flagged as "sem OC", requires post-hoc approval within 48h. Retroactive OC created or exception noted.                         |
| 5. Divergencia de quantidade ou preco | Quantities or prices differ from OC                      | Within tolerance (±3%): auto-accept with note. Outside tolerance: flag for buyer review. Buyer resolves before GRN is confirmed.        |
| 6. Devolucao no ato do recebimento    | Goods rejected during physical inspection at dock        | No stock entry created. Generate return document against supplier immediately. No CP generated. OC item stays open.                     |

### Differentiators (Competitive Advantage)

Features that go beyond basic procurement software. These are the ones that justify Protos Farm over a generic ERP for Brazilian farm operators.

| Feature                                                         | Value Proposition                                                                                                                                                                                               | Complexity | Notes                                                                                                                                                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saving analysis (economia realizada)                            | Shows exactly how much was saved vs. last purchase price and vs. the highest quote received. Proves procurement team value and justifies the tool ROI.                                                          | MEDIUM     | Compare winning quote to: (a) last purchase price for same product+supplier, (b) highest quote in the same cotacao. Display saving in R$ and %. Aggregate by period, product category, and supplier. |
| Price history per product across all suppliers                  | Buyers see price trends and seasonality — critical for agro inputs (defensivos, fertilizantes, racoes) that have significant price volatility tied to USD exchange rate and harvest seasons.                    | LOW        | Time-series of unit prices per product per supplier. Flag price increase >10% vs last purchase as alert. Visible from product detail and from supplier profile.                                      |
| Supplier scorecard / ranking                                    | Quantified supplier performance enables data-driven negotiation and reduces dependence on a single supplier. Rarely available in farm ERP tools.                                                                | MEDIUM     | Computed score from: on-time delivery rate, quote response rate, price competitiveness rank, return rate. Displayed on supplier profile and in dashboard supplier ranking.                           |
| Procurement dashboard (executive view)                          | CFO or fazenda owner needs one screen showing: spend by category, by supplier, by farm, pending approvals, savings achieved, and open OC value. Reuses existing dashboard tab pattern.                          | MEDIUM     | KPIs: total spend MTD/YTD, open OC value, pending approvals count, savings realized, top 5 suppliers by spend, spend by product category chart                                                       |
| CP generation with automatic installments from OC payment terms | If OC specifies "30/60/90 dias", CP is automatically created with 3 installments. Reuses the existing installmentGenerator from packages/shared — zero duplication.                                             | LOW        | Payment terms on OC (a_vista, 30d, 30_60d, 30_60_90d, safra) drive installment schedule on CP. Safra term is flagged specially for visibility in cash flow.                                          |
| Supplier import (CNPJ lookup)                                   | Pre-populate supplier registration from public CNPJ data (Receita Federal API) to reduce manual data entry errors on fiscal data.                                                                               | LOW        | Hit public Receita Federal CNPJ API (free, no auth) to fill razao social, endereco, situacao. User confirms and saves.                                                                               |
| Mobile requisition (RC from campo)                              | Field workers or farm managers can create emergency purchase requisitions from the farm using the mobile app. Manager approves from web. Closes the loop on "I called the buyer on WhatsApp" informal requests. | MEDIUM     | Simplified mobile RC form: product search, quantity, urgency flag, photo attachment (e.g., damaged equipment part). Push notification to web approver.                                               |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature                                          | Why Requested                                                | Why Problematic                                                                                                                                                                                                                                              | Alternative                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NF-e XML import for automatic GRN                | Eliminates manual NF data entry at receiving                 | NF-e XML parsing requires SEFAZ integration, digital certificate validation, schema versioning, and fiscal rule interpretation. This is a full fiscal module (out of scope per PROJECT.md). One edge case breaks the entire flow.                            | Manual NF data entry on GRN form: NF number, series, date, total value, chave NF-e (as future hook). Takes 30 seconds, always works.                        |
| Supplier portal (suppliers submit quotes online) | Reduces back-and-forth in quotation collection               | High development cost for a feature that serves suppliers, not farm staff. Brazilian agro suppliers (small distributors, local vendors) won't adopt a portal login.                                                                                          | Email RFQ with manual response registration covers 90% of cases at 10% of the development cost.                                                             |
| Automated 3-way match with hard payment block    | Prevents paying wrong invoices                               | If tolerance is strict and blocks CP creation, it generates constant support burden. Rural suppliers often round weights and prices differently from the OC. Blocking breaks operations.                                                                     | Tolerance bands (±3%) with warning-not-block. Outside tolerance triggers buyer review, not payment block. Buyer resolves discrepancy before confirming GRN. |
| Auction / reverse bidding                        | Competitive price discovery for large purchases              | Excessive complexity for farm context. Suppliers are often local and relationship-based. Adds significant UX complexity for a scenario that happens rarely.                                                                                                  | Standard RFQ with comparison map achieves the same outcome at a fraction of the complexity.                                                                 |
| Supplier credit scoring via Serasa/SPC API       | Risk management for new suppliers                            | API cost, legal consent requirements under LGPD, and overkill for farm-scale supplier relationships (typically 10-30 known suppliers).                                                                                                                       | Manual risk flag field on supplier profile + qualitative notes field. Sufficient for farm scale.                                                            |
| Blanket Purchase Orders / frame contracts        | Long-term volume commitments to lock in prices               | Adds contract lifecycle management complexity. Brazilian farms rarely have formal frame agreements; they operate on relationship and phone call.                                                                                                             | Recurring OC from template (copy OC feature) covers the practical use case without contract management overhead.                                            |
| Full EDI / e-procurement integration             | Large enterprise capability for automated order transmission | Cost vs. benefit wrong for farm scale. No local agro suppliers have EDI capability.                                                                                                                                                                          | Email dispatch of OC PDF covers the practical need.                                                                                                         |
| Budget control (orcamento de compras)            | Enforce spend limits per cost center                         | Requires a budget planning module as a prerequisite — a separate complex process. Budget entities, period management, and carryover rules are a milestone on their own. Block-on-budget without proper budget setup creates false alarms and user hostility. | Mark as P3 (future milestone). For v1.1, the dashboard spend-vs-period visualization provides informal budget awareness without enforcement.                |

---

## Feature Dependencies

```
[Supplier Registration]
    required-by --> [RFQ / Cotacao]
    required-by --> [Purchase Order (OC)]
    required-by --> [CP generation]

[Product Catalog (existing)]
    required-by --> [RC items]
    required-by --> [GRN items]
    required-by --> [Stock Entry (existing)]

[Purchase Requisition (RC)]
    required-by --> [RC Approval Workflow]
                        required-by --> [RFQ / Cotacao]
                                            required-by --> [Quotation Comparison Map]
                                                                required-by --> [Winner Selection]
                                                                                    required-by --> [Purchase Order (OC)]
                                                                                                        required-by --> [Goods Receiving (GRN)]
                                                                                                                            feeds --> [CP (payables module, existing)]
                                                                                                                            feeds --> [Stock Entry (stock-entries module, existing)]

[Price History]
    accumulated-by --> [GRN confirmation]
    required-by --> [Saving Analysis]

[Saving Analysis]
    enhances --> [Procurement Dashboard]

[Supplier Scorecard]
    requires --> [multiple completed GRN cycles]
    enhances --> [Quotation Comparison Map]

[Purchase Return]
    requires --> [GRN] (must reference a received GRN line)
    feeds --> [CP credit note or CP reduction]
    feeds --> [Stock Output reversal]

[Mobile RC]
    simplified-version-of --> [RC]
    feeds --> [RC Approval Workflow] (same flow)

[installmentGenerator (packages/shared, existing)]
    reused-by --> [CP generation from GRN]

[Cost Centers (existing)]
    required-by --> [RC cost center rateio]
    required-by --> [OC cost center rateio]
    required-by --> [CP cost center rateio]
```

### Dependency Notes

- **Supplier Registration is the root dependency.** Nothing in procurement works without a clean supplier entity. It must be the first story in any phase ordering.
- **RC -> Approval -> RFQ -> OC -> GRN is the critical path.** The entire P2P lifecycle must be implemented in order. You cannot skip steps without breaking auditability.
- **GRN is the most critical integration point.** A single GRN confirmation event must atomically create a CP (in `payables`) and a stock entry (in `stock-entries`). Get the data model and transaction boundary right before building UI.
- **Price history accumulates naturally.** No extra data model is needed for price history — it is a query over GRN items grouped by product + supplier + date. Saving analysis is built on top of this at zero extra storage cost.
- **Saving analysis needs data before it is meaningful.** Do not prioritize saving analysis UI in the first sprint; there will be no historical data to show.
- **Purchase Return requires GRN to exist first.** Cannot return goods that have not been received. Return is always a reference to one or more GRN line items.
- **installmentGenerator from packages/shared must be reused.** Creating a separate installment logic for procurement would be duplication and drift. OC payment terms drive the same installment schedule as manual CP creation.
- **Budget control is a separate prerequisite.** It requires a `purchase_budgets` entity with period + cost center + amount. This is an org process change (someone must set budgets) before enforcement makes sense. Defer to v2.

---

## MVP Definition

### Launch With (v1.1 — the full milestone)

This milestone is not decomposable into sub-MVPs. A procurement module that has requisitions but no GRN is useless. A GRN without CP auto-generation defeats the purpose. The minimum coherent unit is the complete P2P cycle.

- [ ] Supplier CRUD with fiscal data, contacts, and payment terms — root dependency for everything
- [ ] Purchase Requisition (RC) with items, cost center, and urgency flag — entry point of cycle
- [ ] RC approval workflow (configurable value thresholds, state machine, rejection with comment) — control requirement
- [ ] RFQ to multiple suppliers, manual quotation registration — price discovery
- [ ] Quotation comparison map (mapa comparativo) with winner selection — decision support
- [ ] Purchase Order (OC) generation with PDF export — formal commitment
- [ ] Goods Receiving (6 scenarios) with NF data capture and 3-way match tolerance — stock + finance trigger
- [ ] Automatic CP generation from GRN + NF — eliminates double-entry (core value)
- [ ] Automatic stock entry from GRN — eliminates double-entry (core value)
- [ ] Purchase return (devolucao) with credit note — required for complete financial cycle
- [ ] Kanban / pipeline view of procurement flow — operational visibility
- [ ] Procurement dashboard (executive view) — management visibility
- [ ] Email notifications at key workflow transitions — keeps process moving

### Add After Validation (v1.2)

Add after the core P2P cycle has 2-3 months of real data and user feedback.

- [ ] Saving analysis — needs historical price data to be meaningful; ship UI after data accumulates
- [ ] Supplier scorecard / ranking — needs multiple completed purchase cycles before scores are reliable
- [ ] Price history visualization per product — data exists after v1.1 runs; UI is the only addition
- [ ] Mobile requisition (RC from campo) — validate web flow and approval process first; mobile is an accelerator
- [ ] CNPJ lookup for supplier registration — quality-of-life improvement, not blocking

### Future Consideration (v2+)

- [ ] Budget control (orcamento de compras) — requires budget planning module as prerequisite; organizational process change
- [ ] Email RFQ sending with supplier response tracking — higher fidelity workflow; email + manual covers day-1
- [ ] Frame contracts / blanket orders — enterprise feature, farm scale does not need it
- [ ] NF-e XML import — full fiscal module, explicitly out of scope per PROJECT.md
- [ ] Supplier portal — high cost, low ROI at farm scale

---

## Feature Prioritization Matrix

| Feature                       | User Value | Implementation Cost | Priority     |
| ----------------------------- | ---------- | ------------------- | ------------ |
| Supplier registration         | HIGH       | LOW                 | P1           |
| Purchase Requisition (RC)     | HIGH       | MEDIUM              | P1           |
| RC approval workflow          | HIGH       | HIGH                | P1           |
| RFQ + quotation registration  | HIGH       | MEDIUM              | P1           |
| Quotation comparison map      | HIGH       | MEDIUM              | P1           |
| Purchase Order (OC) + PDF     | HIGH       | MEDIUM              | P1           |
| Goods Receiving — 6 scenarios | HIGH       | HIGH                | P1           |
| Auto CP generation from GRN   | HIGH       | MEDIUM              | P1           |
| Auto stock entry from GRN     | HIGH       | MEDIUM              | P1           |
| Purchase return (devolucao)   | HIGH       | HIGH                | P1           |
| Kanban pipeline view          | HIGH       | MEDIUM              | P1           |
| Procurement dashboard         | HIGH       | MEDIUM              | P1           |
| Email notifications           | MEDIUM     | MEDIUM              | P1           |
| Price history per product     | MEDIUM     | LOW                 | P2           |
| Saving analysis               | HIGH       | MEDIUM              | P2           |
| Supplier scorecard            | MEDIUM     | MEDIUM              | P2           |
| Mobile requisition            | MEDIUM     | MEDIUM              | P2           |
| CNPJ lookup on supplier       | LOW        | LOW                 | P2           |
| Budget control                | HIGH       | HIGH                | P3           |
| Email RFQ with tracking       | MEDIUM     | HIGH                | P3           |
| NF-e XML import               | MEDIUM     | VERY HIGH           | Out of scope |
| Supplier portal               | LOW        | HIGH                | Out of scope |

**Priority key:**

- P1: Must have for v1.1 milestone launch
- P2: Add after core P2P cycle is stable, when data exists (v1.2)
- P3: Future milestone

---

## Competitor Feature Analysis

Reference systems analyzed to inform patterns and scope decisions.

| Feature               | ERPNext (open source reference)                | SAP S/4HANA (enterprise reference)                  | Our Approach                                                                                                    |
| --------------------- | ---------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Supplier registration | Full master data with optional supplier portal | Full master with credit management and risk scoring | Simplified: fiscal data + contacts + payment terms + quality flag. No portal. CNPJ lookup from Receita Federal. |
| RC workflow           | Configurable approval chains                   | Complex org hierarchy with role-based routing       | Value-threshold alcadas (3 levels max, configurable per org). Mobile approval for web approvers.                |
| RFQ                   | Email to supplier portal                       | Formal sourcing event with sourcing cockpit         | Email dispatch + manual response registration. No portal. Comparison map included.                              |
| Quotation comparison  | Line-item supplier quotation report            | SRM analytics with scoring                          | Visual matrix with lowest-price highlight per item. Winner selection with audit trail.                          |
| PO / OC               | Full document with conditions and approval     | Formal contract with release strategy               | OC document with PDF + email dispatch. Linked to RFQ winner.                                                    |
| Goods receiving       | Multiple GRN scenarios + warehouse movements   | MIGO with warehouse management integration          | 6 explicit scenarios with tolerance bands. No warehouse management.                                             |
| 3-way match           | Automated with tolerance                       | Automated + ML anomaly detection                    | Tolerance bands (±3%) with warning-not-block. Buyer resolves before GRN confirmed.                              |
| CP generation         | Manual AP link after GRN                       | Automatic via MIRO with FI integration              | Automatic on GRN confirmation using existing installmentGenerator. Zero double-entry.                           |
| Saving analysis       | Basic quotation savings report                 | Advanced spend analytics platform                   | Saving vs. last price + vs. max quote. Aggregate by period, category, supplier.                                 |
| Budget control        | Yes, linked to cost centers                    | Yes, complex (commitment accounting)                | P3 — not in v1.1 scope. Dashboard spend visualization provides informal awareness.                              |

---

## Brazilian Agricultural Context — Specific Notes

### Supplier Types Common in Brazilian Agro

1. **Insumos (defensivos, fertilizantes, sementes)** — typically large regional distributors (Nutrien, Mosaic dealers, AgroGalaxy). Issue NF-e. Have formal quotation processes. High value purchases.
2. **Servicos agricolas (calcario, aviacao agricola, manutencao de maquinas)** — smaller, may issue NFS-e or nota de produtor. Less formal quotation.
3. **Veterinarios e produtos veterinarios** — regulated products. Some items require receituario agronômico (already built in EPIC-10).
4. **Manutencao e pecas (implementos, tratores, equipamentos de irrigacao)** — mix of large dealers and small workshops.
5. **Alimentos e insumos pecuarios (racoes, minerais, sal)** — regular recurring purchases with seasonal price variation. Good candidates for recurring OC templates.

### NF Data Capture Strategy

NF-e XML parsing is out of scope. The GRN receiving form must capture manually:

- Numero NF
- Serie NF
- Data de emissao NF
- Valor total NF (drives CP amount)
- Chave NF-e (optional 44-digit key, stored as future hook for fiscal module integration)

This manual entry is sufficient for CP generation and audit trail. Takes under 30 seconds. Chave NF-e field is the integration interface for the future fiscal module.

### Payment Terms in Brazilian Agro

Common terms that must be modeled on OC:

- A vista (immediate)
- 30 dias
- 30/60 dias
- 30/60/90 dias
- Safra (linked to harvest date — common for large input purchases at planting time, paid at harvest)

"Safra" payment term requires special treatment in CP: due date is "estimada colheita" not a fixed calendar date. This is a known agro-specific requirement that generic ERPs miss.

### Price Volatility Context

Defensivos agricolas (herbicides, fungicides, insecticides) and fertilizantes are priced in USD. Price can swing 15-30% between planting seasons. Price history and saving analysis are therefore not vanity features — they are legitimate procurement intelligence tools that help buyers time purchases and demonstrate performance.

---

## Sources

- [ERPNext Open Source Procurement](https://frappe.io/erpnext/open-source-procurement) — RFQ, comparison map, PO generation patterns. Confidence: HIGH.
- [NetSuite Procurement Module](https://www.netsuite.com/portal/resource/articles/erp/procurement-module.shtml) — lifecycle and integration patterns. Confidence: HIGH.
- [Three-Way Matching — NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/three-way-matching.shtml) — 3-way match definition and tolerance patterns. Confidence: HIGH.
- [Goods Receipt Definition and Process — Ramp](https://ramp.com/blog/accounts-payable/goods-receipt) — receiving scenarios and GRN workflow. Confidence: HIGH.
- [Purchase Requisition Best Practices — Stampli](https://www.stampli.com/blog/accounts-payable/purchase-requisition-best-practices/) — approval workflow patterns and threshold configuration. Confidence: HIGH.
- [Procurement Dashboard KPIs — Upsolve](https://upsolve.ai/blog/procurement-dashboard) — dashboard metrics and KPI selection. Confidence: MEDIUM.
- [Supplier Scorecard Guide — HighRadius](https://www.highradius.com/resources/Blog/supplier-scorecard/) — scorecard metrics and computation methodology. Confidence: HIGH.
- [Procurement Savings Analysis — Sievo](https://sievo.com/resources/procurement-analytics-demystified) — saving analysis methodology. Confidence: HIGH.
- [Purchase Return — Microsoft Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/tasks/create-purchase-return-order) — return order workflow and credit note process. Confidence: HIGH.
- [NFP-e for Rural Producers — Aegro](https://aegro.com.br/blog/nota-fiscal-eletronica-produtor-rural/) — Brazilian fiscal context for agricultural suppliers. Confidence: HIGH.
- PROJECT.md — milestone requirements, out-of-scope items, existing module inventory. Confidence: HIGH (primary source).

---

_Feature research for: Protos Farm v1.1 — Gestao de Compras (Procurement)_
_Researched: 2026-03-17_
