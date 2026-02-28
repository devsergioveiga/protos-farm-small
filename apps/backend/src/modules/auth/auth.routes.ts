import { Router } from 'express';
import {
  login,
  refreshTokens,
  requestPasswordReset,
  resetPassword,
  acceptInvite,
  AuthError,
} from './auth.service';

export const authRouter = Router();

authRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' });
      return;
    }

    const tokens = await login({ email, password });
    res.json(tokens);
  } catch (err) {
    if (err instanceof AuthError) {
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
