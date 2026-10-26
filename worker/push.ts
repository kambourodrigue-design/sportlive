// Web Push (RFC 8030 + VAPID RFC 8292 + chiffrement aes128gcm RFC 8291) avec WebCrypto uniquement : aucune dépendance.

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidKeys {
  publicKey: string; // base64url, point non compressé de 65 octets (clé « applicationServerKey » du navigateur)
  privateJwk: JsonWebKey;
}

const enc = new TextEncoder();

export const b64uEncode = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const b64uDecode = (s: string): Uint8Array<ArrayBuffer> => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey);
  return { publicKey: b64uEncode(raw), privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey) };
}

async function vapidHeader(endpoint: string, vapid: VapidKeys, subject: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64uEncode(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)); // r||s : format attendu par JWS
  return `vapid t=${header}.${claims}.${b64uEncode(sig)}, k=${vapid.publicKey}`;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

// Corps chiffré (RFC 8291) : salt(16) | rs(4) | idlen(1) | clé publique éphémère(65) | données chiffrées
export async function encryptPayload(sub: PushSub, payload: string): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = b64uDecode(sub.keys.p256dh);
  const authSecret = b64uDecode(sub.keys.auth);
  const eph = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2])); // 0x02 = dernier bloc
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export type PushResult = 'ok' | 'gone' | 'error';

export async function sendPush(sub: PushSub, payload: object, vapid: VapidKeys, subject: string, opts: { ttl?: number } = {}): Promise<PushResult> {
  try {
    const body = await encryptPayload(sub, JSON.stringify(payload));
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        authorization: await vapidHeader(sub.endpoint, vapid, subject),
        'content-encoding': 'aes128gcm',
        'content-type': 'application/octet-stream',
        ttl: String(opts.ttl ?? 1800),
        urgency: 'high',
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return 'gone'; // abonnement supprimé côté navigateur
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export const isValidSub = (s: any): s is PushSub =>
  !!s &&
  typeof s.endpoint === 'string' &&
  s.endpoint.length < 600 &&
  /^https:\/\//.test(s.endpoint) &&
  typeof s.keys?.p256dh === 'string' &&
  s.keys.p256dh.length < 200 &&
  typeof s.keys?.auth === 'string' &&
  s.keys.auth.length < 100;
