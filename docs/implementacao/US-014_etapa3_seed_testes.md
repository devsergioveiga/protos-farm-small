# US-014 Etapa 3 — Seed, Testes e Documentacao

## O que foi feito

### Seed (`prisma/seed.ts`)

Vinculos produtor-fazenda atualizados com novos campos:

- **Carlos Eduardo → Santa Helena:** proprietario, isItrDeclarant=true, startDate=2020-01, vinculado as 2 matriculas (15.234 e 15.235)
- **Agropecuaria Bom Futuro → Tres Irmaos:** proprietaria, isItrDeclarant=true, startDate=2019-06, vinculada a matricula 8.901
- **Agropecuaria Bom Futuro → Lagoa Dourada:** arrendataria, endDate=2027-06-30 (contrato com prazo)
- **Sociedade Irmaos Silva → Santa Helena:** condomino (alterado de PARCEIRO), vinculada a matricula 15.235
- **Joao Carlos → Recanto do Sol:** proprietario, isItrDeclarant=true, vinculado a matricula 5.678

Nova secao de `producer_registration_links` (5 vinculos com matriculas).

### Testes (20 novos em `producers.routes.spec.ts`)

Total: 375 testes passando (todos os 21 suites).

**Novos testes:**

1. Criar link com startDate/endDate/registrationIds (201)
2. Validar endDate >= startDate (400)
3. Validar registrationIds pertencem a farm (400)
4. Criar link com isItrDeclarant=true (201)
5. Atualizar link com startDate/endDate (200)
6. Validar endDate >= startDate no update (400)
7. Sync registrationIds no update (200)
8. Validar registrationIds no update (400)
9. PATCH itr-declarant retorna 200
10. PATCH itr-declarant retorna 404 (link nao encontrado)
11. GET participation retorna 200 com soma
12. GET participation retorna warnings quando != 100%
13. GET participation retorna 404 (fazenda nao encontrada)
14. GET itr-declarant retorna 200
15. GET itr-declarant retorna 404 (nenhum definido)
16. GET expiring contracts retorna 200 (default 30 dias)
17. GET expiring contracts aceita parametro days
18. GET expiring contracts retorna 400 para days invalido
19. GET expiring contracts retorna 400 para days > 365
20. GET expiring contracts retorna 403 para COWBOY
21. GET farm links inclui registrationLinks

### Documentacao

- `docs/implementacao/US-014_etapa1_migration.md`
- `docs/implementacao/US-014_etapa2_vinculacao_condominio.md`
- `docs/implementacao/US-014_etapa3_seed_testes.md` (este arquivo)

## Verificacao

1. `pnpm --filter backend exec prisma generate` — tipos gerados
2. `pnpm --filter backend test` — 375 testes passando (21 suites)
3. `pnpm --filter backend exec tsc --noEmit` — type-check OK
