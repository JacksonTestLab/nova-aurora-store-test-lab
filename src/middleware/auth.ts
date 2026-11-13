import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { repo } from '../db/repo.ts';
import { users } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySupabaseAccessToken } from '../lib/supabase-server.ts';

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

export function toSafeUser(u: typeof users.$inferSelect | any): SafeUser {
  return {
    id: u.id,
    uid: u.uid ?? null,
    name: u.name,
    email: u.email,
    role: u.role,
    cpf: u.cpf ?? null,
    phone: u.phone ?? null,
    birthDate: u.birthDate ?? null,
    cep: u.cep ?? null,
    address: u.address ?? null,
    number: u.number ?? null,
    complement: u.complement ?? null,
    neighborhood: u.neighborhood ?? null,
    city: u.city ?? null,
    state: u.state ?? null,
    avatarUrl: u.avatarUrl ?? null,
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
    const found = await repo.findOneWhere('users', { id: decoded.userId });

    if (!found) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }
    if (found.status !== 'ativo') {
      return res.status(403).json({ error: 'Conta inativa. Contate o administrador.' });
    }
    req.user = toSafeUser(found);
    return next();
  } catch {
    // Fallback 1: Verify as Supabase Auth JWT
    try {
      const sbUser = await verifySupabaseAccessToken(token);
      if (sbUser && sbUser.email) {
        const email = sbUser.email.toLowerCase();
        const existing =
          (await repo.findOneWhere('users', { uid: sbUser.id })) ||
          (await repo.findOneWhere('users', { email }));

        if (existing) {
          if (existing.status !== 'ativo') {
            return res.status(403).json({ error: 'Conta inativa.' });
          }
          if (!existing.uid) {
            await repo.updateWhere('users', { id: existing.id }, { uid: sbUser.id });
          }
          req.user = toSafeUser(existing);
          return next();
        }

        const displayName =
          (sbUser.user_metadata?.name as string) ||
          (sbUser.user_metadata?.full_name as string) ||
          email.split('@')[0];

        const created = await repo.upsertRow(
          'users',
          {
            uid: sbUser.id,
            name: displayName,
            email,
            role: 'cliente',
            avatarUrl: (sbUser.user_metadata?.avatar_url as string) || null,
            status: 'ativo',
          },
          'email'
        );
        req.user = toSafeUser(created);
        return next();
      }
    } catch {
      // continue to Firebase fallback
    }

    // Fallback 2: Verify as Firebase ID Token
    try {
      const fbDecoded = await adminAuth.verifyIdToken(token);
      if (!fbDecoded.email) {
        return res.status(401).json({ error: 'Token inválido.' });
      }
      const existing = await repo.findOneWhere('users', {
        email: fbDecoded.email.toLowerCase(),
      });

      if (existing) {
        if (existing.status !== 'ativo') {
          return res.status(403).json({ error: 'Conta inativa.' });
        }
        req.user = toSafeUser(existing);
        return next();
      }
      const created = await repo.upsertRow(
        'users',
        {
          uid: fbDecoded.uid,
          name: fbDecoded.name || fbDecoded.email.split('@')[0],
          email: fbDecoded.email.toLowerCase(),
          role: 'cliente',
          avatarUrl: fbDecoded.picture || null,
          status: 'ativo',
        },
        'email'
      );
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
    await repo.insertRow('audit_logs', {
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
