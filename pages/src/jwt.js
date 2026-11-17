// JWT（HS256），与 Python 端 PyJWT 完全兼容：
// payload = { sub: "用户id", iat, exp, pv: 密码版本号 }
// 用 Web Crypto 实现，边缘函数与 Node 运行时都能跑。

const encoder = new TextEncoder();
const keyCache = new Map();

async function webcrypto() {
  if (globalThis.crypto?.subtle) return globalThis.crypto;
  const mod = await import('node:crypto');
  return mod.webcrypto;
}

function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const normalized = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const crypto = await webcrypto();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  keyCache.set(secret, key);
  return key;
}

/**
 * 签发 token
 * @param {string} secret
 * @param {number} userId
 * @param {number} pwdVersion tab_user.pwd_version
 * @param {number} expireMinutes
 */
export async function createToken(secret, userId, pwdVersion, expireMinutes) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64urlEncode(
    encoder.encode(
      JSON.stringify({
        sub: String(userId),
        iat: now,
        exp: now + Math.trunc(expireMinutes) * 60,
        pv: Number(pwdVersion) || 0,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const crypto = await webcrypto();
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(signingInput));
  return `${signingInput}.${b64urlEncode(new Uint8Array(signature))}`;
}

/**
 * 校验 token，返回 { uid, pv }；无效返回 null
 */
export async function parseToken(secret, token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const crypto = await webcrypto();
    const okSign = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      b64urlDecode(signature),
      encoder.encode(`${header}.${payload}`),
    );
    if (!okSign) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    if (!claims || claims.pv === undefined) return null;
    const exp = Number(claims.exp);
    if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return null;
    const uid = Number.parseInt(String(claims.sub), 10);
    if (!Number.isFinite(uid)) return null;
    return { uid, pv: Number(claims.pv) };
  } catch {
    return null;
  }
}
