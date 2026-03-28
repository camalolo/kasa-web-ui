import crypto from 'node:crypto';
import axios from 'axios';

export interface TapoRawSession {
  send(request: TapoRequest): Promise<Record<string, unknown>>;
  close(): void;
}

export interface TapoRequest {
  method: string;
  params?: Record<string, unknown>;
}

const sessionCache = new Map<string, TapoRawSession>();

function sha256(data: Buffer | string): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

function sha1(data: Buffer | string): Buffer {
  return crypto.createHash('sha1').update(data).digest();
}

function aes128CbcEncrypt(key: Buffer, iv: Buffer, plaintext: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

function aes128CbcDecrypt(key: Buffer, iv: Buffer, ciphertext: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function checkTapoError(data: Record<string, unknown>): void {
  const code = data['err_code'] ?? data['error_code'];
  if (code !== undefined && code !== 0) {
    const msg = data['msg'];
    throw new Error(typeof msg === 'string' ? msg : `Tapo error: ${code}`);
  }
}

function extractCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'];
  if (typeof raw === 'string') {
    const idx = raw.indexOf(';');
    return idx >= 0 ? raw.substring(0, idx) : raw;
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0]!;
    const idx = first.indexOf(';');
    return idx >= 0 ? first.substring(0, idx) : first;
  }
  return '';
}

class KlaspSession implements TapoRawSession {
  private readonly ip: string;
  private readonly key: Buffer;
  private readonly baseIv: Buffer;
  private readonly sig: Buffer;
  private seq: Buffer;
  private readonly cookie: string;

  constructor(
    ip: string,
    localSeed: Buffer,
    remoteSeed: Buffer,
    authHash: Buffer,
    cookie: string,
  ) {
    this.ip = ip;
    this.key = sha256(
      Buffer.concat([Buffer.from('lsk'), localSeed, remoteSeed, authHash]),
    ).slice(0, 16);
    this.baseIv = sha256(
      Buffer.concat([Buffer.from('iv'), localSeed, remoteSeed, authHash]),
    );
    this.sig = sha256(
      Buffer.concat([Buffer.from('ldk'), localSeed, remoteSeed, authHash]),
    ).slice(0, 28);
    this.seq = Buffer.from(this.baseIv.subarray(this.baseIv.length - 4));
    this.cookie = cookie;
  }

  private ivWithSeq(): Buffer {
    return Buffer.concat([this.baseIv.subarray(0, 12), this.seq]);
  }

  private nextSeq(): void {
    const buf = Buffer.alloc(4);
    buf.writeInt32BE(this.seq.readInt32BE() + 1);
    this.seq = buf;
  }

  async send(request: TapoRequest): Promise<Record<string, unknown>> {
    this.nextSeq();
    const iv = this.ivWithSeq();
    const ciphertext = aes128CbcEncrypt(
      this.key,
      iv,
      Buffer.from(JSON.stringify(request)),
    );
    const signature = sha256(
      Buffer.concat([this.sig, this.seq, ciphertext]),
    );

    const response = await axios.post(
      `http://${this.ip}/app/request?seq=${this.seq.readInt32BE()}`,
      Buffer.concat([signature, ciphertext]),
      {
        responseType: 'arraybuffer',
        headers: { Cookie: this.cookie },
        timeout: 5000,
      },
    );

    const responseBuf = Buffer.from(response.data);
    const decrypted = aes128CbcDecrypt(
      this.key,
      iv,
      responseBuf.subarray(32),
    );
    const result: Record<string, unknown> = JSON.parse(
      decrypted.toString('utf-8'),
    );
    checkTapoError(result);
    return result;
  }

  close(): void {}
}

const RSA_PASSPHRASE = 'top secret';

class PassthroughSession implements TapoRawSession {
  private readonly ip: string;
  private readonly key: Buffer;
  private readonly iv: Buffer;
  private readonly token: string;
  private readonly cookie: string;

  constructor(ip: string, key: Buffer, iv: Buffer, token: string, cookie: string) {
    this.ip = ip;
    this.key = key;
    this.iv = iv;
    this.token = token;
    this.cookie = cookie;
  }

  async send(request: TapoRequest): Promise<Record<string, unknown>> {
    const encrypted = aes128CbcEncrypt(
      this.key,
      this.iv,
      Buffer.from(JSON.stringify(request)),
    ).toString('base64');

    const url = this.token
      ? `http://${this.ip}/app?token=${this.token}`
      : `http://${this.ip}/app`;

    const response = await axios.post(
      url,
      { method: 'securePassthrough', params: { request: encrypted } },
      { headers: { Cookie: this.cookie }, timeout: 5000 },
    );

    checkTapoError(response.data);

    const decrypted = aes128CbcDecrypt(
      this.key,
      this.iv,
      Buffer.from(response.data.result.response, 'base64'),
    );
    const inner: Record<string, unknown> = JSON.parse(
      decrypted.toString('utf-8'),
    );
    checkTapoError(inner);
    return inner;
  }

  close(): void {}
}

async function createKlaspSession(
  ip: string,
  email: string,
  password: string,
): Promise<KlaspSession> {
  const localSeed = crypto.randomBytes(16);

  const response = await axios.post(
    `http://${ip}/app/handshake1`,
    localSeed,
    { responseType: 'arraybuffer', withCredentials: true },
  );

  const responseBytes = Buffer.from(response.data);
  const sessionCookie = extractCookie(response.headers as Record<string, unknown>);

  const remoteSeed = responseBytes.subarray(0, 16);
  const serverHash = responseBytes.subarray(16);

  const authHash = sha256(Buffer.concat([sha1(email), sha1(password)]));
  const localSeedAuthHash = sha256(
    Buffer.concat([localSeed, remoteSeed, authHash]),
  );

  if (serverHash.compare(localSeedAuthHash) !== 0) {
    throw new Error('email or password incorrect');
  }

  const handshake2Payload = sha256(
    Buffer.concat([remoteSeed, localSeed, authHash]),
  );
  await axios.post(`http://${ip}/app/handshake2`, handshake2Payload, {
    responseType: 'arraybuffer',
    headers: { Cookie: sessionCookie },
  });

  return new KlaspSession(ip, localSeed, remoteSeed, authHash, sessionCookie);
}

async function createPassthroughSession(
  ip: string,
  email: string,
  password: string,
): Promise<PassthroughSession> {
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: RSA_PASSPHRASE,
    },
  });

  const handshakeResponse = await axios.post(
    `http://${ip}/app`,
    { method: 'handshake', params: { key: keyPair.publicKey } },
    { timeout: 5000 },
  );

  checkTapoError(handshakeResponse.data);
  const sessionCookie = extractCookie(
    handshakeResponse.headers as Record<string, unknown>,
  );

  const deviceKeyRaw = crypto.privateDecrypt(
    {
      key: keyPair.privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
      passphrase: RSA_PASSPHRASE,
    },
    Buffer.from(handshakeResponse.data.result.key, 'base64'),
  );

  const key = deviceKeyRaw.subarray(0, 16);
  const iv = deviceKeyRaw.subarray(16, 32);

  const loginEncrypted = aes128CbcEncrypt(
    key,
    iv,
    Buffer.from(
      JSON.stringify({
        method: 'login_device',
        params: {
          username: Buffer.from(sha1(email).toString('hex')).toString(
            'base64',
          ),
          password: Buffer.from(password).toString('base64'),
        },
        requestTimeMils: 0,
      }),
    ),
  ).toString('base64');

  const loginResponse = await axios.post(
    `http://${ip}/app`,
    { method: 'securePassthrough', params: { request: loginEncrypted } },
    { headers: { Cookie: sessionCookie }, timeout: 5000 },
  );

  checkTapoError(loginResponse.data);

  const loginDecrypted = aes128CbcDecrypt(
    key,
    iv,
    Buffer.from(loginResponse.data.result.response, 'base64'),
  );
  const loginResult: Record<string, unknown> = JSON.parse(
    loginDecrypted.toString('utf-8'),
  );
  checkTapoError(loginResult);

  const token = loginResult['token'] as string | undefined;
  return new PassthroughSession(ip, key, iv, token ?? '', sessionCookie);
}

function wrapSession(ip: string, session: TapoRawSession): TapoRawSession {
  return {
    async send(request: TapoRequest): Promise<Record<string, unknown>> {
      try {
        return await session.send(request);
      } catch {
        sessionCache.delete(ip);
        throw new Error('Session error');
      }
    },
    close(): void {
      session.close();
    },
  };
}

export async function getOrCreateRawSession(
  ip: string,
  email: string,
  password: string,
): Promise<TapoRawSession> {
  const cached = sessionCache.get(ip);
  if (cached) return cached;

  let session: TapoRawSession;
  try {
    session = await createKlaspSession(ip, email, password);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      session = await createPassthroughSession(ip, email, password);
    } else {
      throw err;
    }
  }

  const wrapped = wrapSession(ip, session);
  sessionCache.set(ip, wrapped);
  return wrapped;
}

export function clearRawSession(ip: string): void {
  sessionCache.delete(ip);
}

export function clearAllRawSessions(): void {
  sessionCache.clear();
}
