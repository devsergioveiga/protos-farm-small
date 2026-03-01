# US-013 — Etapa 3: Seed + Testes

## Seed

4 produtores, 3 participantes (SC), 5 IEs, 6 vínculos fazenda:

- **Org 1:** Carlos Eduardo Silva (PF), Agropecuária Bom Futuro (PJ), Sociedade Irmãos Silva (SC com 3 participantes)
- **Org 2:** João Carlos Mendes (PF)

## Testes

42 testes em `producers.routes.spec.ts` cobrindo:

- Auth guard e permission checks
- CRUD produtor (3 tipos, validações)
- Participantes SC (CPF, soma %)
- CRUD IEs (duplicata, UF)
- IE padrão por fazenda
- Vínculos produtor-fazenda
- Reverse lookup fazenda→produtores
- Audit log em mutações

## Arquivos modificados

- `prisma/seed.ts` — dados de produtores, participantes, IEs e vínculos
