# Ajustes Pós-Implementação

Lista de melhorias e correções a serem feitas após a implementação inicial, organizadas por módulo.

---

## Cadastro de Animal

### 1. Simplificar categorias no cadastro

**Situação atual:** O cadastro permite selecionar "Vaca em Lactação" e "Vaca Seca" como categorias.

**Mudança:** A categoria de cadastro deve ter apenas "Vaca". A sub-classificação (em lactação / seca) deve ser calculada automaticamente a partir dos lançamentos de lactação.

**Implementação:**

- Adicionar dois campos no banco: `initialCategory` (imutável, informado pelo usuário no cadastro) e `currentCategory` (atualizada automaticamente por eventos)
- `currentCategory` não aparece no formulário de cadastro — é gerenciado pelo sistema
- Eventos que atualizam `currentCategory`: parto (novilha → vaca), secagem (vaca em lactação → vaca seca), início lactação (vaca seca → vaca em lactação), idade (bezerro → garrote), etc.

---

## Baixa de Animal

### 2. Substituir soft delete por status + evento de baixa

**Situação atual:** A baixa de animal usa soft delete (`deletedAt`).

**Mudança:** Usar abordagem de status + evento de baixa.

**Implementação:**

- Animal passa a ter `status: ACTIVE | INACTIVE` em vez de `deletedAt`
- Criar registro de evento de baixa com: data, motivo (morte, venda, abate, doação), observações
- Animal inativo sai das listagens padrão mas continua visível em:
  - Árvore genealógica (mãe/pai)
  - Relatórios históricos
  - Consultas com filtro "incluir inativos"
  - Histórico financeiro/patrimonial
- Remover lógica de soft delete (`WHERE deletedAt IS NULL`) e substituir por `WHERE status = 'ACTIVE'`

---

## Diagnóstico de Gestação

### 3. Simplificar resultado do diagnóstico

**Situação atual:** O diagnóstico de gestação registra múltiplas opções de resultado.

**Mudança:** O diagnóstico deve registrar apenas resultado **positivo** ou **negativo**.

**Implementação:**

- Alterar o campo de resultado para `result: POSITIVE | NEGATIVE`
- Permitir múltiplos diagnósticos por inseminação (acompanhamento ao longo do tempo)
- Manter vínculo com a inseminação de origem
