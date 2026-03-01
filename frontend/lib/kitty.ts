import { decryptNames } from './crypto';

export const PW_STORAGE_KEY = (id: string) => `kitty_pw_${id}`;

export function savePassword(id: string, pw: string) {
  try { localStorage.setItem(PW_STORAGE_KEY(id), pw); } catch {}
}

export function loadPassword(id: string): string {
  try { return localStorage.getItem(PW_STORAGE_KEY(id)) ?? ''; } catch { return ''; }
}

export async function decryptEvent(fields: any, password: string) {
  const encHex: number[] = fields.encrypted_participants;
  const salt = new TextDecoder().decode(new Uint8Array(encHex.slice(0, 16))).replace(/\0/g, '').replace(/^0+/, '').trim();
  const names = await decryptNames(new TextDecoder().decode(new Uint8Array(encHex.slice(16))), password, salt);

  let title: string | null = null;
  try {
    const titleHex: number[] = fields.title_encrypted;
    const titleSalt = new TextDecoder().decode(new Uint8Array(titleHex.slice(0, 24))).replace(/\0/g, '').replace(/^0+/, '').trim();
    const titleArr = await decryptNames(new TextDecoder().decode(new Uint8Array(titleHex.slice(24))), password, titleSalt);
    title = titleArr[0] ?? null;
  } catch {}

  return { names, title };
}

export function parseStatuses(fields: any): Record<string, number> {
  const out: Record<string, number> = {};
  (fields?.statuses?.fields?.contents ?? []).forEach((e: any) => {
    out[e.fields.key] = parseInt(e.fields.value);
  });
  return out;
}
