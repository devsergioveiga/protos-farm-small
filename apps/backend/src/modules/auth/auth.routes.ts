import { Router } from 'express';
import {
  login,
  refreshTokens,
  requestPasswordReset,
  resetPassword,
  acceptInvite,
  logout,
  AuthError,
} from './auth.service';
import {
  buildGoogleAuthUrl,
  handleGoogleCallback,
  exchangeGoogleCode,
  isGoogleConfigured,
} from './google-oauth.service';
import { authenticate } from '../../middleware/auth';
import { validatePasswordStrength } from '../../shared/utils/password-validator';
import { loadEnv } from '../../config/env';
import {
  loginRateLimit,
  incrementLoginFailures,
  clearLoginFailures,
} from '../../middleware/rate-limit';

export const authRouter = Router();

authRouter.post('/auth/login', loginRateLimit(), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' });
      return;
    }

    const tokens = await login({ email, password });
    await clearLoginFailures(email);
    res.json(tokens);
  } catch (err) {
    if (err instanceof AuthError) {
      const email = req.body?.email;
      if (err.statusCode === 401 && email) {
        await incrementLoginFailures(email);
      }
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

authRouter.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token é obrigatório' });
      return;
    }

    const tokens = await refreshTokens(refreshToken);
    res.json(tokens);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

authRouter.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email é obrigatório' });
      return;
    }

    await requestPasswordReset(email);
    res.json({
      message: 'Se o email estiver cadastrado, você receberá um link de redefinição de senha',
    });
  } catch {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

authRouter.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token é obrigatório' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Senha é obrigatória' });
      return;
    }

    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      res
        .status(400)
        .json({ error: 'Senha não atende aos requisitos', details: validation.errors });
      return;
    }

    await resetPassword(token, password);
    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

authRouter.post('/auth/accept-invite', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token é obrigatório' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Senha é obrigatória' });
      return;
    }

    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      res
        .status(400)
        .json({ error: 'Senha não atende aos requisitos', details: validation.errors });
      return;
    }

    const tokens = await acceptInvite(token, password);
    res.json(tokens);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── Google OAuth ────────────────────────────────────────────────────

authRouter.get('/auth/google', async (_req, res) => {
  try {
    if (!isGoogleConfigured()) {
      res.status(503).json({ error: 'Login com Google não está configurado' });
      return;
    }

    const url = await buildGoogleAuthUrl();
    res.redirect(url);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

authRouter.get('/auth/google/callback', async (req, res) => {
  const env = loadEnv();
  const frontendUrl = env.FRONTEND_URL;

  try {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(`${frontendUrl}/login?error=google_access_denied`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${frontendUrl}/login?error=google_invalid_request`);
      return;
    }

    const exchangeCode = await handleGoogleCallback(code as string, state as string);
    res.redirect(`${frontendUrl}/auth/callback?code=${exchangeCode}`);
  } catch (err) {
    if (err instanceof AuthError) {
      let errorCode = 'google_error';
      if (err.message === 'Email não cadastrado no sistema') {
        errorCode = 'google_email_not_found';
      } else if (err.message === 'Esta conta está vinculada a outra conta Google') {
        errorCode = 'google_account_mismatch';
      } else if (err.message === 'Login social desabilitado para esta organização') {
        errorCode = 'google_social_disabled';
      }
      res.redirect(`${frontendUrl}/login?error=${errorCode}`);
      return;
    }
    res.redirect(`${frontendUrl}/login?error=google_error`);
  }
});

authRouter.post('/auth/google/exchange', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Código é obrigatório' });
      return;
    }

    const tokens = await exchangeGoogleCode(code);
    res.json(tokens);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

authRouter.post('/auth/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token é obrigatório' });
      return;
    }

    await logout(refreshToken);
    res.json({ message: 'Sessão encerrada com sucesso' });
  } catch {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
