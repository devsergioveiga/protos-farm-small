# US-008 CA4 — Token OAuth armazenado de forma segura (nunca no frontend)

## Status: Satisfeito pelo CA1

Os tokens OAuth do Google nunca são expostos ao frontend. A arquitetura implementada no CA1 garante isso por design.

## Onde está implementado

### Backend — `google-oauth.service.ts` (handleGoogleCallback)

```typescript
// Tokens do Google ficam apenas no backend
const { tokens } = await client.getToken(code);       // server-side
const ticket = await client.verifyIdToken({ ... });    // server-side
```

O fluxo:

1. **Google → Backend**: o callback do Google envia o authorization code para o backend
2. **Backend troca code por tokens**: `client.getToken(code)` retorna `access_token`, `refresh_token` e `id_token` do Google — tudo server-side
3. **Backend verifica id_token**: extrai email e `sub` do Google — server-side
4. **Tokens do Google descartados**: não são persistidos em banco nem em Redis — usados apenas para identificar o usuário
5. **Backend gera JWTs próprios**: via `createSessionForUser()`, cria access/refresh tokens do Protos Farm
6. **One-time code**: os JWTs são armazenados no Redis (60s TTL) sob um UUID opaco, que é enviado ao frontend via redirect

### O que o frontend recebe

- **Nunca**: `access_token`, `refresh_token` ou `id_token` do Google
- **Apenas**: os JWTs do Protos Farm, obtidos via `POST /auth/google/exchange` com o one-time code

## Por que já estava satisfeito

O padrão one-time exchange code foi escolhido no CA1 especificamente para evitar tokens em URLs/logs. Como efeito colateral, os tokens OAuth do Google nunca precisam sair do backend — são consumidos e descartados no mesmo request do callback.
