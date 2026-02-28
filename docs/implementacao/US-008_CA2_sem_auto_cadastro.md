# US-008 CA2 — Login social só funciona se email já existir (sem auto-cadastro)

## Status: Satisfeito pelo CA1

Este critério de aceite foi implementado como constraint de segurança dentro do CA1.

## Onde está implementado

### Backend — `google-oauth.service.ts` (linhas 82-84)

```typescript
const user = await prisma.user.findUnique({ where: { email: payload.email } });
if (!user) {
  throw new AuthError('Email não cadastrado no sistema', 403);
}
```

O fluxo:

1. Google retorna o email do usuário via id_token
2. Backend busca o email na tabela `users`
3. Se não encontra → erro 403, redirecionamento para `/login?error=google_email_not_found`
4. Se encontra → verifica status ativo antes de criar sessão

### Backend — `auth.routes.ts` (callback)

O erro `Email não cadastrado no sistema` é mapeado para o query param `google_email_not_found`, diferenciando dos demais erros Google.

### Frontend — `LoginPage.tsx`

Mensagem amigável exibida ao usuário:

> "Este email não está cadastrado no sistema. Entre em contato com o administrador."

### Teste — `auth.routes.spec.ts`

```
✓ should redirect to login with google_email_not_found when email is not registered
```

## Por que foi incluído no CA1

Auto-cadastro via Google seria uma falha de segurança — qualquer pessoa com conta Google poderia criar acesso ao sistema. Como essa constraint afeta o fluxo principal do OAuth, foi implementada desde o início.
