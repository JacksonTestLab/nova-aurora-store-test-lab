import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { auditLogs, users } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export const JWT_SECRET =
  process.env.JWT_SECRET || 'nova-aurora-test-lab-secret-key-2026';

export interface SafeUser {
  id: number;
  uid: string | null;
  name: string;
  email: string;
  role: string;
  cpf: string | null;
  phone: string | null;
  birthDate: string | null;
  cep: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  avatarUrl: string | null;
  status: string;
}

export interface AuthRequest extends Request {
  user?: SafeUser;
}

export function toSafeUser(u: typeof users.$inferSelect): SafeUser {
  return {
    id: u.id,
    uid: u.uid,
    name: u.name,
    email: u.email,
    role: u.role,
    cpf: u.cpf,
    phone: u.phone,
    birthDate: u.birthDate,
    cep: u.cep,
    address: u.address,
    number: u.number,
    complement: u.complement,
    neighborhood: u.neighborhood,
    city: u.city,
    state: u.state,
    avatarUrl: u.avatarUrl,
    status: u.status,
  };
}

export function parseCookieToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === 'na_token') {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    token = parseCookieToken(req.headers.cookie);
  }

  if (!token) {
    return res.status(401).json({ error: 'Sessão não autenticada. Faça login para continuar.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!found) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }
    if (found.status !== 'ativo') {
      return res.status(403).json({ error: 'Conta inativa. Contate o administrador.' });
    }
    req.user = toSafeUser(found);
    return next();
  } catch {
    // Fallback: try verifying as Firebase ID Token
    try {
      const fbDecoded = await adminAuth.verifyIdToken(token);
      if (!fbDecoded.email) {
        return res.status(401).json({ error: 'Token inválido.' });
      }
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, fbDecoded.email.toLowerCase()))
        .limit(1);

      if (existing) {
        if (existing.status !== 'ativo') {
          return res.status(403).json({ error: 'Conta inativa.' });
        }
        req.user = toSafeUser(existing);
        return next();
      }
      const [created] = await db
        .insert(users)
        .values({
          uid: fbDecoded.uid,
          name: fbDecoded.name || fbDecoded.email.split('@')[0],
          email: fbDecoded.email.toLowerCase(),
          role: 'cliente',
          avatarUrl: fbDecoded.picture || null,
          status: 'ativo',
        })
        .onConflictDoUpdate({
          target: users.email,
          set: { uid: fbDecoded.uid },
        })
        .returning();
      req.user = toSafeUser(created);
      return next();
    } catch {
      return res.status(401).json({ error: 'Sessão expirada ou token inválido.' });
    }
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Acesso negado: seu perfil não possui permissão para esta operação.',
      });
    }
    return next();
  };
};

export async function logAudit(
  actor: { email: string; role: string } | undefined,
  action: string,
  entity: string,
  details: string
) {
  try {
    await db.insert(auditLogs).values({
      actorEmail: actor?.email || 'sistema',
      actorRole: actor?.role || 'system',
      action,
      entity,
      details,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
