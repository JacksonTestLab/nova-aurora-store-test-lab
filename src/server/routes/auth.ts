import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getActiveDatabaseMode, repo } from '../../db/repo.ts';
import {
  AuthRequest,
  JWT_SECRET,
  logAudit,
  requireAuth,
  toSafeUser,
} from '../../middleware/auth.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import {
  getSupabaseStatus,
  supabaseAdmin,
  verifySupabaseAccessToken,
} from '../../lib/supabase-server.ts';
import {
  isValidCPF,
  isValidEmail,
  maskCPF,
  onlyDigits,
  sanitizeText,
} from '../../utils/validators.ts';

const router = Router();
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

function setAuthCookie(res: any, token: string) {
  res.cookie('na_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8h
    path: '/',
  });
}

router.get('/config', async (_req, res) => {
  const supabaseStatus = getSupabaseStatus();
  try {
    const settings = await repo.listAll('lab_settings');
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return res.json({
      appName: 'Nova Aurora Store Test Lab',
      version: '1.4.0',
      labMode: process.env.LAB_MODE !== 'false',
      simulatedDelayMs: Number(map.simulatedDelayMs || '0'),
      maxCashierDiscountPercent: Number(map.maxCashierDiscountPercent || '15'),
      databaseMode: getActiveDatabaseMode(),
      supabase: supabaseStatus,
    });
  } catch (err) {
    console.error('Config error:', err);
    return res.json({
      appName: 'Nova Aurora Store Test Lab',
      version: '1.4.0',
      labMode: process.env.LAB_MODE !== 'false',
      simulatedDelayMs: 0,
      maxCashierDiscountPercent: 15,
      databaseMode: getActiveDatabaseMode(),
      supabase: supabaseStatus,
    });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const emailRaw = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!emailRaw || !password) {
      return res.status(400).json({
        error: 'Preencha os campos obrigatórios de e-mail e senha.',
      });
    }

    if (!isValidEmail(emailRaw)) {
      return res.status(400).json({
        error: 'Informe um endereço de e-mail válido.',
      });
    }

    const user = await repo.findOneWhere('users', { email: emailRaw });

    if (!user) {
      return res.status(401).json({
        error: 'E-mail ou senha incorretos.',
      });
    }

    if (user.status !== 'ativo') {
      return res.status(403).json({
        error: 'Esta conta está inativa. Procure um administrador.',
      });
    }

    // Check temporary lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingSeconds = Math.ceil(
        (new Date(user.lockedUntil).getTime() - Date.now()) / 1000
      );
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      const formatted = mins > 0 ? `${mins}m ${secs}s` : `${secs} segundos`;
      return res.status(423).json({
        error: `Conta temporariamente bloqueada após ${LOCKOUT_MAX_ATTEMPTS} tentativas inválidas. Tente novamente em ${formatted}.`,
        remainingSeconds,
      });
    }

    const passwordMatches =
      user.passwordHash && (await bcrypt.compare(password, user.passwordHash));

    if (!passwordMatches) {
      const nextAttempts = (user.failedLoginAttempts || 0) + 1;
      if (nextAttempts >= LOCKOUT_MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await repo.updateWhere(
          'users',
          { id: user.id },
          { failedLoginAttempts: nextAttempts, lockedUntil: lockUntil }
        );
        await logAudit(
          { email: user.email, role: user.role },
          'LOGIN_LOCKED',
          'auth',
          `Conta bloqueada por ${LOCKOUT_MINUTES} minutos após ${nextAttempts} falhas.`
        );
        return res.status(423).json({
          error: `Conta temporariamente bloqueada após ${LOCKOUT_MAX_ATTEMPTS} tentativas inválidas. Tente novamente em ${LOCKOUT_MINUTES} minutos.`,
          remainingSeconds: LOCKOUT_MINUTES * 60,
        });
      }

      await repo.updateWhere('users', { id: user.id }, { failedLoginAttempts: nextAttempts });

      return res.status(401).json({
        error: `E-mail ou senha incorretos. Tentativa ${nextAttempts} de ${LOCKOUT_MAX_ATTEMPTS}.`,
      });
    }

    // Reset failure counter on success
    await repo.updateWhere(
      'users',
      { id: user.id },
      { failedLoginAttempts: 0, lockedUntil: null }
    );

    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    setAuthCookie(res, token);
    await logAudit(
      { email: user.email, role: user.role },
      'LOGIN_SUCCESS',
      'auth',
      `Login realizado com sucesso (${user.role}).`
    );

    return res.json({ user: toSafeUser(user), token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Erro interno ao processar o login.' });
  }
});

router.post('/auth/firebase', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '');
    if (!idToken) {
      return res.status(400).json({ error: 'Token Firebase ausente.' });
    }
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email) {
      return res.status(400).json({ error: 'Conta Google sem e-mail.' });
    }
    const email = decoded.email.toLowerCase();
    let userRecord = await repo.findOneWhere('users', { email });

    if (!userRecord) {
      userRecord = await repo.upsertRow(
        'users',
        {
          uid: decoded.uid,
          name: sanitizeText(decoded.name || email.split('@')[0]),
          email,
          role: 'cliente',
          avatarUrl: decoded.picture || null,
          status: 'ativo',
        },
        'email'
      );
    }

    if (userRecord.status !== 'ativo') {
      return res.status(403).json({ error: 'Conta inativa.' });
    }

    const token = jwt.sign(
      { userId: userRecord.id, role: userRecord.role, email: userRecord.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    setAuthCookie(res, token);
    return res.json({ user: toSafeUser(userRecord), token });
  } catch (err) {
    console.error('Firebase auth error:', err);
    return res.status(401).json({ error: 'Falha na autenticação via Google.' });
  }
});

router.post('/auth/supabase', async (req, res) => {
  try {
    const accessToken = String(req.body?.accessToken || '');
    if (!accessToken) {
      return res.status(400).json({ error: 'Token Supabase ausente.' });
    }
    const sbUser = await verifySupabaseAccessToken(accessToken);
    if (!sbUser || !sbUser.email) {
      return res.status(401).json({ error: 'Sessão Supabase inválida ou expirada.' });
    }
    const email = sbUser.email.toLowerCase();
    let userRecord =
      (await repo.findOneWhere('users', { uid: sbUser.id })) ||
      (await repo.findOneWhere('users', { email }));

    if (!userRecord) {
      const displayName = sanitizeText(
        (sbUser.user_metadata?.name as string) ||
          (sbUser.user_metadata?.full_name as string) ||
          email.split('@')[0]
      );
      userRecord = await repo.upsertRow(
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
    } else if (!userRecord.uid) {
      const [updated] = await repo.updateWhere('users', { id: userRecord.id }, { uid: sbUser.id });
      if (updated) userRecord = updated;
    }

    if (userRecord.status !== 'ativo') {
      return res.status(403).json({ error: 'Conta inativa.' });
    }

    const token = jwt.sign(
      { userId: userRecord.id, role: userRecord.role, email: userRecord.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    setAuthCookie(res, token);
    await logAudit(
      { email: userRecord.email, role: userRecord.role },
      'LOGIN_SUPABASE',
      'auth',
      `Autenticação via Supabase Auth (${userRecord.role}).`
    );
    return res.json({ user: toSafeUser(userRecord), token });
  } catch (err) {
    console.error('Supabase auth error:', err);
    return res.status(401).json({ error: 'Falha na autenticação via Supabase.' });
  }
});

router.post('/auth/register', async (req, res) => {
  try {
    const name = sanitizeText(req.body?.name);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const cpfDigits = onlyDigits(req.body?.cpf || '');
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!name || !email || !cpfDigits || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }
    if (name.length < 3) {
      return res.status(400).json({ error: 'O nome deve ter pelo menos 3 caracteres.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (!isValidCPF(cpfDigits)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'A senha e a confirmação de senha não coincidem.' });
    }

    const formattedCpf = maskCPF(cpfDigits);

    const dupEmail = await repo.findOneWhere('users', { email });
    if (dupEmail) {
      return res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
    }

    const dupCpf = await repo.findOneWhere('users', { cpf: formattedCpf });
    if (dupCpf) {
      return res.status(409).json({ error: 'Já existe uma conta cadastrada com este CPF.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let created = await repo.insertRow('users', {
      name,
      email,
      cpf: formattedCpf,
      passwordHash,
      role: 'cliente',
      status: 'ativo',
    });

    // Also register in Supabase Auth when service role is configured
    if (supabaseAdmin) {
      try {
        const { data: sbCreated } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name },
        });
        if (sbCreated?.user?.id) {
          const [updated] = await repo.updateWhere(
            'users',
            { id: created.id },
            { uid: sbCreated.user.id }
          );
          if (updated) created = updated;
        }
      } catch {
        // non-fatal
      }
    }

    const token = jwt.sign(
      { userId: created.id, role: created.role, email: created.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    setAuthCookie(res, token);
    await logAudit({ email: created.email, role: created.role }, 'REGISTER', 'users', 'Novo cliente cadastrado.');

    return res.status(201).json({ user: toSafeUser(created), token });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar conta.' });
  }
});

router.post('/auth/recover-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido para recuperação.' });
  }
  await logAudit({ email, role: 'guest' }, 'PASSWORD_RECOVERY_REQUEST', 'auth', 'Solicitação de recuperação de senha.');
  return res.json({
    message:
      'Se o e-mail estiver cadastrado, enviamos as instruções de redefinição (simulado em ambiente de laboratório).',
  });
});

router.post('/auth/logout', (_req, res) => {
  res.clearCookie('na_token', { path: '/' });
  return res.json({ message: 'Sessão encerrada com sucesso.' });
});

router.get('/auth/me', requireAuth, (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

export default router;
