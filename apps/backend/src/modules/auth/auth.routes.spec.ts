import request from 'supertest';
import { app } from '../../app';
import * as authService from './auth.service';
import * as googleOAuthService from './google-oauth.service';

jest.mock('./auth.service', () => {
  const actual = jest.requireActual('./auth.service');
  return {
    ...actual,
    login: jest.fn(),
    refreshTokens: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
    acceptInvite: jest.fn(),
    logout: jest.fn(),
    verifyAccessToken: jest.fn(),
  };
});

jest.mock('./google-oauth.service', () => ({
  buildGoogleAuthUrl: jest.fn(),
  handleGoogleCallback: jest.fn(),
  exchangeGoogleCode: jest.fn(),
  isGoogleConfigured: jest.fn(),
}));

jest.mock('../../middleware/rate-limit', () => ({
  loginRateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  incrementLoginFailures: jest.fn().mockResolvedValue(undefined),
  clearLoginFailures: jest.fn().mockResolvedValue(undefined),
}));

const mockedService = jest.mocked(authService);
const mockedGoogleService = jest.mocked(googleOAuthService);

function withAuth() {
  mockedService.verifyAccessToken.mockReturnValue({
    userId: 'user-1',
    email: 'user@test.com',
    role: 'ORG_ADMIN' as authService.TokenPayload['role'],
    organizationId: 'org-1',
  });
}

describe('Auth endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── POST /api/auth/login ────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should return 200 with tokens on valid credentials', async () => {
      mockedService.login.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'Test@1234' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });
      expect(mockedService.login).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'Test@1234',
      });
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app).post('/api/auth/login').send({ password: 'Test@1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.login).not.toHaveBeenCalled();
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app).post('/api/auth/login').send({ email: 'user@test.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.login).not.toHaveBeenCalled();
    });

    it('should return 401 on invalid credentials', async () => {
      mockedService.login.mockRejectedValue(
        new authService.AuthError('Credenciais inválidas', 401),
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Credenciais inválidas');
    });

    it('should return 403 when account is inactive', async () => {
      mockedService.login.mockRejectedValue(new authService.AuthError('Conta inativa', 403));

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inactive@test.com', password: 'Test@1234' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Conta inativa');
    });

    it('should return 403 when organization is suspended', async () => {
      mockedService.login.mockRejectedValue(
        new authService.AuthError('Organização suspensa ou cancelada', 403),
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@suspended-org.com', password: 'Test@1234' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Organização suspensa ou cancelada');
    });

    it('should return 403 when organization is cancelled', async () => {
      mockedService.login.mockRejectedValue(
        new authService.AuthError('Organização suspensa ou cancelada', 403),
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@cancelled-org.com', password: 'Test@1234' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Organização suspensa ou cancelada');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.login.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'Test@1234' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── POST /api/auth/refresh ──────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('should return 200 with new tokens on valid refresh token', async () => {
      mockedService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(mockedService.refreshTokens).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should return 400 when refreshToken is missing', async () => {
      const response = await request(app).post('/api/auth/refresh').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.refreshTokens).not.toHaveBeenCalled();
    });

    it('should return 401 on invalid refresh token', async () => {
      mockedService.refreshTokens.mockRejectedValue(
        new authService.AuthError('Refresh token inválido ou expirado', 401),
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'expired-token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Refresh token inválido ou expirado');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.refreshTokens.mockRejectedValue(new Error('Redis down'));

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'some-token' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── POST /api/auth/forgot-password ──────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    it('should return 200 with message on valid email', async () => {
      mockedService.requestPasswordReset.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'user@test.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();
      expect(mockedService.requestPasswordReset).toHaveBeenCalledWith('user@test.com');
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app).post('/api/auth/forgot-password').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.requestPasswordReset).not.toHaveBeenCalled();
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.requestPasswordReset.mockRejectedValue(new Error('SMTP down'));

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'user@test.com' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── POST /api/auth/reset-password ───────────────────────────────

  describe('POST /api/auth/reset-password', () => {
    it('should return 200 on successful password reset', async () => {
      mockedService.resetPassword.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'valid-token', password: 'NewPass@1234' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Senha redefinida com sucesso');
      expect(mockedService.resetPassword).toHaveBeenCalledWith('valid-token', 'NewPass@1234');
    });

    it('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ password: 'NewPass@1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.resetPassword).not.toHaveBeenCalled();
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'valid-token' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.resetPassword).not.toHaveBeenCalled();
    });

    it('should return 401 on invalid or expired token', async () => {
      mockedService.resetPassword.mockRejectedValue(
        new authService.AuthError('Token inválido ou expirado', 401),
      );

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'expired-token', password: 'NewPass@1234' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token inválido ou expirado');
    });

    it('should return 403 when account is inactive', async () => {
      mockedService.resetPassword.mockRejectedValue(
        new authService.AuthError('Conta inativa', 403),
      );

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'some-token', password: 'NewPass@1234' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Conta inativa');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.resetPassword.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'some-token', password: 'NewPass@1234' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── POST /api/auth/accept-invite ─────────────────────────────────

  describe('POST /api/auth/accept-invite', () => {
    it('should return 200 with tokens on valid invite', async () => {
      mockedService.acceptInvite.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });

      const response = await request(app)
        .post('/api/auth/accept-invite')
        .send({ token: 'valid-invite-token', password: 'Senha@123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });
      expect(mockedService.acceptInvite).toHaveBeenCalledWith('valid-invite-token', 'Senha@123');
    });

    it('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/accept-invite')
        .send({ password: 'Senha@123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.acceptInvite).not.toHaveBeenCalled();
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/accept-invite')
        .send({ token: 'valid-invite-token' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.acceptInvite).not.toHaveBeenCalled();
    });

    it('should return 401 on invalid token', async () => {
      mockedService.acceptInvite.mockRejectedValue(
        new authService.AuthError('Token inválido ou expirado', 401),
      );

      const response = await request(app)
        .post('/api/auth/accept-invite')
        .send({ token: 'expired-token', password: 'Senha@123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token inválido ou expirado');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.acceptInvite.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/auth/accept-invite')
        .send({ token: 'some-token', password: 'Senha@123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });

    it('should return 400 when password is too weak', async () => {
      const response = await request(app)
        .post('/api/auth/accept-invite')
        .send({ token: 'valid-token', password: 'weak' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Senha não atende aos requisitos');
      expect(response.body.details).toBeDefined();
      expect(mockedService.acceptInvite).not.toHaveBeenCalled();
    });
  });

  // ─── Password strength validation ──────────────────────────────────

  describe('POST /api/auth/reset-password — password strength', () => {
    it('should return 400 when password is too weak', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'valid-token', password: 'weak' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Senha não atende aos requisitos');
      expect(response.body.details).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(mockedService.resetPassword).not.toHaveBeenCalled();
    });
  });

  // ─── POST /api/auth/logout ────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('should return 200 on successful logout', async () => {
      withAuth();
      mockedService.logout.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .send({ refreshToken: 'refresh-token-123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Sessão encerrada com sucesso');
      expect(mockedService.logout).toHaveBeenCalledWith('refresh-token-123');
    });

    it('should return 400 when refreshToken is missing', async () => {
      withAuth();

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Refresh token é obrigatório');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'refresh-token-123' });

      expect(response.status).toBe(401);
    });

    it('should return 500 on unexpected error', async () => {
      withAuth();
      mockedService.logout.mockRejectedValue(new Error('Redis down'));

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .send({ refreshToken: 'refresh-token-123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── GET /api/auth/google ──────────────────────────────────────────

  describe('GET /api/auth/google', () => {
    it('should redirect to Google when configured', async () => {
      mockedGoogleService.isGoogleConfigured.mockReturnValue(true);
      mockedGoogleService.buildGoogleAuthUrl.mockResolvedValue(
        'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
      );

      const response = await request(app).get('/api/auth/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
      );
    });

    it('should return 503 when Google OAuth is not configured', async () => {
      mockedGoogleService.isGoogleConfigured.mockReturnValue(false);

      const response = await request(app).get('/api/auth/google');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Login com Google não está configurado');
    });
  });

  // ─── GET /api/auth/google/callback ─────────────────────────────────

  describe('GET /api/auth/google/callback', () => {
    it('should redirect to frontend with exchange code on success', async () => {
      mockedGoogleService.handleGoogleCallback.mockResolvedValue('exchange-code-123');

      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'google-code', state: 'csrf-state' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'http://localhost:5173/auth/callback?code=exchange-code-123',
      );
    });

    it('should redirect to login with error when Google denies access', async () => {
      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ error: 'access_denied' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'http://localhost:5173/login?error=google_access_denied',
      );
    });

    it('should redirect to login with error when code/state are missing', async () => {
      const response = await request(app).get('/api/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'http://localhost:5173/login?error=google_invalid_request',
      );
    });

    it('should redirect to login with google_email_not_found when email is not registered', async () => {
      mockedGoogleService.handleGoogleCallback.mockRejectedValue(
        new authService.AuthError('Email não cadastrado no sistema', 403),
      );

      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'google-code', state: 'csrf-state' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'http://localhost:5173/login?error=google_email_not_found',
      );
    });

    it('should redirect to login with google_account_mismatch when Google sub does not match', async () => {
      mockedGoogleService.handleGoogleCallback.mockRejectedValue(
        new authService.AuthError('Esta conta está vinculada a outra conta Google', 403),
      );

      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'google-code', state: 'csrf-state' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'http://localhost:5173/login?error=google_account_mismatch',
      );
    });

    it('should redirect to login with google_error on unexpected error', async () => {
      mockedGoogleService.handleGoogleCallback.mockRejectedValue(new Error('unexpected'));

      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'google-code', state: 'csrf-state' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('http://localhost:5173/login?error=google_error');
    });
  });

  // ─── POST /api/auth/google/exchange ────────────────────────────────

  describe('POST /api/auth/google/exchange', () => {
    it('should return tokens on valid exchange code', async () => {
      mockedGoogleService.exchangeGoogleCode.mockResolvedValue({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      });

      const response = await request(app)
        .post('/api/auth/google/exchange')
        .send({ code: 'exchange-code-123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      });
    });

    it('should return 400 when code is missing', async () => {
      const response = await request(app).post('/api/auth/google/exchange').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Código é obrigatório');
    });

    it('should return 401 on invalid exchange code', async () => {
      mockedGoogleService.exchangeGoogleCode.mockRejectedValue(
        new authService.AuthError('Código inválido ou expirado', 401),
      );

      const response = await request(app)
        .post('/api/auth/google/exchange')
        .send({ code: 'invalid-code' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Código inválido ou expirado');
    });

    it('should return 500 on unexpected error', async () => {
      mockedGoogleService.exchangeGoogleCode.mockRejectedValue(new Error('Redis down'));

      const response = await request(app)
        .post('/api/auth/google/exchange')
        .send({ code: 'some-code' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });
});
