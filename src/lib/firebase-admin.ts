import jwt from 'jsonwebtoken';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export interface VerifiedFirebaseToken {
  uid: string;
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;

async function getGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Falha ao obter certificados públicos do Firebase (${res.status}).`);
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;

  cachedCerts = certs;
  cachedCertsExpiresAt = now + maxAgeMs;
  return certs;
}

async function verifyWithGoogleCerts(idToken: string): Promise<VerifiedFirebaseToken> {
  const decodedHeader = jwt.decode(idToken, { complete: true }) as {
    header?: { alg?: string; kid?: string };
  } | null;

  const alg = decodedHeader?.header?.alg;
  const kid = decodedHeader?.header?.kid;
  if (alg !== 'RS256' || !kid) {
    throw new Error('Cabeçalho de token Firebase inválido.');
  }

  let certs = await getGooglePublicCerts(false);
  if (!certs[kid]) {
    certs = await getGooglePublicCerts(true);
  }
  const cert = certs[kid];
  if (!cert) {
    throw new Error('Chave pública do Firebase não encontrada para o token.');
  }

  const projectId = firebaseConfig.projectId;
  const verified = jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  }) as Record<string, unknown>;

  const sub = typeof verified.sub === 'string' ? verified.sub : '';
  if (!sub || sub.length > 128) {
    throw new Error('Subject inválido no token Firebase.');
  }

  return {
    ...verified,
    sub,
    uid: sub,
  } as VerifiedFirebaseToken;
}

let cachedSdkVerify: ((token: string) => Promise<VerifiedFirebaseToken>) | null = null;
let sdkUnavailable = false;

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  if (!sdkUnavailable && !cachedSdkVerify) {
    try {
      const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
      ]);
      if (!getApps().length) {
        initializeApp({ projectId: firebaseConfig.projectId });
      }
      const auth = getAuth();
      cachedSdkVerify = (token: string) =>
        auth.verifyIdToken(token) as Promise<VerifiedFirebaseToken>;
    } catch {
      sdkUnavailable = true;
    }
  }

  if (cachedSdkVerify && !sdkUnavailable) {
    return cachedSdkVerify(idToken);
  }

  return verifyWithGoogleCerts(idToken);
}

export const adminAuth = {
  verifyIdToken: verifyFirebaseIdToken,
};

