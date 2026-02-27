import request from 'supertest';
import { app } from '../../app';
import * as authService from './auth.service';

jest.mock('./auth.service', () => {
  const actual = jest.requireActual('./auth.service');
  return {
    ...actual,
    login: jest.fn(),
    refreshTokens: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  };
});

const mockedService = jest.mocked(authService);

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
});
