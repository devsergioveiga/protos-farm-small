# US-012 — Etapa 3: Seed + Testes

## Seed

5 matrículas adicionadas ao seed:

- Fazenda Santa Helena: 2 matrículas (3.200 ha + 2.000 ha = 5.200 ha)
- Fazenda Três Irmãos: 1 matrícula (1.800,5 ha)
- Fazenda Lagoa Dourada: 1 matrícula (520,75 ha)
- Sítio Recanto do Sol: 1 matrícula (185,3 ha)

## Testes

30+ testes em `farms.routes.spec.ts` cobrindo:

- Auth guard (401 sem token, 403 permissão insuficiente)
- Criar fazenda (201 sucesso, 400 validações, 422 limite)
- Listar paginado com filtros
- Obter por ID (200, 404)
- Editar (200, 404, 500)
- Toggle status (200, 400 status inválido)
- CRUD matrículas (201, 400 campos obrigatórios, 404, 500)
- Alerta divergência área >5%

## Arquivos modificados

- `prisma/seed.ts` — dados de matrículas
