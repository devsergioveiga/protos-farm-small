# US-094 — Receituário Agronômico Integrado (CA1-CA8)

## Resumo

Implementação completa do receituário agronômico integrado, permitindo emissão,
gestão e exportação de receituários vinculados a aplicações de defensivos e
estoque, conforme modelo CREA/CONFEA.

## Critérios de Aceite

| CA  | Descrição                                           | Status   |
| --- | --------------------------------------------------- | -------- |
| CA1 | Geração conforme modelo CREA/CONFEA                 | COMPLETO |
| CA2 | Campos auto-preenchidos (propriedade, talhão, etc.) | COMPLETO |
| CA3 | Produtos selecionados do estoque com dose/calda     | COMPLETO |
| CA4 | Dados do agrônomo (nome, CREA, assinatura digital)  | COMPLETO |
| CA5 | Período de carência e intervalo de segurança auto   | COMPLETO |
| CA6 | PDF gerado com layout padrão para impressão         | COMPLETO |
| CA7 | Vinculação receituário → aplicação → saída estoque  | COMPLETO |
| CA8 | Numeração sequencial e registro no histórico        | COMPLETO |

## Arquitetura

### Backend

- **Módulo:** `apps/backend/src/modules/pesticide-prescriptions/`
- **Modelos:** `PesticidePrescription`, `PesticidePrescriptionProduct`
- **Migration:** `20260344100000_add_pesticide_prescriptions`
- **Dependência:** `pdfkit` para geração de PDF (CA6)

**Endpoints:**

| Método | Rota                                                 | Descrição              |
| ------ | ---------------------------------------------------- | ---------------------- |
| POST   | `/org/farms/:farmId/pesticide-prescriptions`         | Criar receituário      |
| GET    | `/org/farms/:farmId/pesticide-prescriptions`         | Listar com paginação   |
| GET    | `/org/farms/:farmId/pesticide-prescriptions/:id`     | Buscar por ID          |
| PATCH  | `/org/farms/:farmId/pesticide-prescriptions/:id`     | Atualizar              |
| DELETE | `/org/farms/:farmId/pesticide-prescriptions/:id`     | Cancelar (soft-delete) |
| GET    | `/org/farms/:farmId/pesticide-prescriptions/:id/pdf` | Download PDF (CA6)     |
| GET    | `.../pesticide-prescriptions/export/csv`             | Export CSV             |

### Frontend

- **Página:** `apps/frontend/src/pages/PesticidePrescriptionsPage.tsx`
- **Modal:** `apps/frontend/src/components/pesticide-prescriptions/PrescriptionModal.tsx`
- **Hook:** `apps/frontend/src/hooks/usePesticidePrescriptions.ts`
- **Types:** `apps/frontend/src/types/pesticide-prescription.ts`
- **Rota:** `/pesticide-prescriptions`
- **Sidebar:** Grupo LAVOURA, ícone FileText, label "Receituários"

### Fluxo

1. Usuário seleciona talhão → sistema auto-preenche fazenda, área, cultura (CA2)
2. Seleciona produtos do estoque → auto-preenche ingrediente, toxicidade, carência (CA3/CA5)
3. Preenche dados do agrônomo (CA4)
4. Submete → sistema gera número sequencial por fazenda (CA8)
5. Pode vincular a aplicação de defensivo e saída de estoque (CA7)
6. Pode baixar PDF formatado modelo CREA/CONFEA (CA6)

## Testes

- 22 testes backend (routes spec com mocks)
- Cobertura de todos os endpoints + CAs
