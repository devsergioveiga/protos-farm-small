import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/auth.service';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header) {
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return;
  }

  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Formato de token inválido' });
    return;
  }

  const token = header.slice(7);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
