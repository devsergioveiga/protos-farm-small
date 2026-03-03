# US-007-FE: Telas de Redefinir Senha e Aceitar Convite

## Resumo

Implementação das telas frontend para completar o fluxo de autenticação (US-007): redefinição de senha via link de email e aceitação de convite de organização.

## Arquivos Criados

| Arquivo                                           | Descrição                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/components/ui/PasswordStrengthIndicator.tsx` | Componente reutilizável com barra de progresso e checklist de 4 regras |
| `src/components/ui/PasswordStrengthIndicator.css` | Estilos do indicador de força                                          |
| `src/pages/ResetPasswordPage.tsx`                 | Tela `/reset-password?token=` — redefinir senha via link do email      |
| `src/pages/ResetPasswordPage.css`                 | Estilos específicos (error state sem token)                            |
| `src/pages/ResetPasswordPage.spec.tsx`            | 8 testes unitários                                                     |
| `src/pages/AcceptInvitePage.tsx`                  | Tela `/accept-invite?token=` — definir senha e entrar automaticamente  |
| `src/pages/AcceptInvitePage.css`                  | Estilos (reusa classes existentes)                                     |
| `src/pages/AcceptInvitePage.spec.tsx`             | 8 testes unitários                                                     |

## Arquivos Modificados

| Arquivo               | Alteração                                                             |
| --------------------- | --------------------------------------------------------------------- |
| `src/services/api.ts` | +2 métodos: `resetPassword()`, `acceptInvite()`                       |
| `src/App.tsx`         | +2 lazy imports + rotas públicas `/reset-password` e `/accept-invite` |

## Componentes

### PasswordStrengthIndicator

- Props: `password: string`
- 4 regras espelhando o backend (`password-validator.ts`):
  1. Mínimo 8 caracteres
  2. Pelo menos 1 letra maiúscula
  3. Pelo menos 1 número
  4. Pelo menos 1 caractere especial
- Barra de progresso: 0=vazio, 1-2=vermelho (Fraca), 3=amarelo (Razoável), 4=verde (Forte)
- Lista com CheckCircle/Circle do Lucide
- Export: `isPasswordValid(password): boolean` para validação nos forms

### ResetPasswordPage (`/reset-password?token=`)

- Sem token → mensagem de erro + link para `/forgot-password`
- Com token → form (nova senha + confirmação + PasswordStrengthIndicator)
- Validação inline onBlur (senhas coincidem, força OK)
- Submit: `POST /auth/reset-password` → success state com link para `/login`
- Error: mensagem do backend (token expirado, etc.)

### AcceptInvitePage (`/accept-invite?token=`)

- Sem token → mensagem de erro + link para `/login`
- Com token → form com header UserPlus + "Defina sua senha"
- Submit: `POST /auth/accept-invite` → `loginWithTokens()` → redirect `/dashboard`
- Autenticação automática após aceitar convite

## Padrões Seguidos

- Layout reutiliza classes `.login-page`, `.login-card`, `.login-header` do LoginPage
- CSS reutiliza `.forgot-back-link`, `.forgot-success` do ForgotPasswordPage
- Acessibilidade: `role="alert"`, `aria-live="polite"`, `aria-required`, focus management
- HTML semântico: `<main>`, `<section>`, `<header>`, `<form>`, `<label>`
- Fontes: DM Sans (headings), Source Sans 3 (body), via CSS custom properties
- Espaçamento: escala de 4px via `var(--space-*)`

## Testes

- 16 novos testes (8 + 8)
- Total frontend: 137 testes passando
