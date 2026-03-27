import aesjs from 'aes-js';

export type Credentials = { email: string; password: string };
export type PersistedAuth = { encrypted: string; key: string };

function b64encode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]!);
  }
  return btoa(binary);
}

function b64decode(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pkcs7Pad(data: Uint8Array, blockSize: number): Uint8Array {
  const padLen = blockSize - (data.length % blockSize);
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  for (let i = data.length; i < padded.length; i++) {
    padded[i] = padLen;
  }
  return padded;
}

function pkcs7Unpad(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  const padLen = data[data.length - 1]!;
  if (padLen < 1 || padLen > 16) return data;
  for (let i = data.length - padLen; i < data.length; i++) {
    if (data[i] !== padLen) return data;
  }
  return data.slice(0, data.length - padLen);
}

export async function encrypt(email: string, password: string): Promise<PersistedAuth> {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(16));

  const plaintext = new TextEncoder().encode(JSON.stringify({ email, password }));
  const padded = pkcs7Pad(plaintext, 16);

  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const ciphertext = aesCbc.encrypt(padded);

  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);

  return {
    encrypted: b64encode(combined),
    key: b64encode(key),
  };
}

export async function decrypt(persisted: PersistedAuth): Promise<Credentials | null> {
  try {
    const key = b64decode(persisted.key);
    const combined = b64decode(persisted.encrypted);

    const iv = combined.slice(0, 16);
    const ciphertext = combined.slice(16);

    const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
    const decrypted = aesCbc.decrypt(ciphertext);

    const unpadded = pkcs7Unpad(decrypted);
    const text = new TextDecoder().decode(unpadded);
    return JSON.parse(text) as Credentials;
  } catch {
    return null;
  }
}
