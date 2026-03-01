const ITERATIONS = 100_000;

async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const ab = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(ab);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const ivBuf = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuf);
  window.crypto.getRandomValues(iv);
  const enc = new TextEncoder();
  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data));
  return toHex(iv) + toHex(ciphertext);
}

async function decryptData(hexData: string, key: CryptoKey): Promise<string> {
  const iv = fromHex(hexData.slice(0, 24));
  const ciphertext = fromHex(hexData.slice(24));
  const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

export async function encryptNames(names: string[], password: string, salt: string): Promise<string> {
  const key = await deriveKey(password, salt);
  return encryptData(JSON.stringify(names), key);
}

export async function decryptNames(hexData: string, password: string, salt: string): Promise<string[]> {
  const key = await deriveKey(password, salt);
  const plain = await decryptData(hexData, key);
  return JSON.parse(plain);
}

export async function hashPassword(password: string): Promise<Uint8Array<ArrayBuffer>> {
  const enc = new TextEncoder();
  const hash = await window.crypto.subtle.digest('SHA-256', enc.encode(password));
  return new Uint8Array(hash);
}

export function hexToBytes(hex: string): number[] {
  return Array.from(fromHex(hex));
}
