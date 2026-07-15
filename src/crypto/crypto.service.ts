import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { getCredentialsEncryptionKey } from '../config/env';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/** Prefix đánh dấu giá trị đã mã hóa — tránh double-encrypt / nhận plaintext legacy */
export const ENC_PREFIX = 'enc:v1:';

/** Field nhạy cảm trong `user_credentials.data` (và payload tương tự) */
export const SENSITIVE_DATA_KEYS = [
  'apiKey',
  'appPassword',
  'password',
  'secret',
  'accessToken',
  'refreshToken',
  'clientSecret',
] as const;

@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private key!: Buffer;

  onModuleInit() {
    this.key = this.parseKey(getCredentialsEncryptionKey());
    this.logger.log('AES-256-GCM credentials encryption ready');
  }

  isEncrypted(value: string): boolean {
    return typeof value === 'string' && value.startsWith(ENC_PREFIX);
  }

  /**
   * Mã hóa plaintext → hex packed string:
   * `enc:v1:{ivHex}{authTagHex}{ciphertextHex}`
   */
  encrypt(plaintext: string): string {
    if (plaintext == null) {
      throw new InternalServerErrorException('encrypt() requires a string');
    }

    if (this.isEncrypted(plaintext)) {
      return plaintext;
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return (
      ENC_PREFIX +
      Buffer.concat([iv, authTag, encrypted]).toString('hex')
    );
  }

  /** Giải mã hex packed string → plaintext */
  decrypt(payload: string): string {
    if (payload == null) {
      throw new InternalServerErrorException('decrypt() requires a string');
    }

    // Legacy plaintext (chưa migrate) — trả nguyên để không phá runtime
    if (!this.isEncrypted(payload)) {
      return payload;
    }

    const packed = Buffer.from(payload.slice(ENC_PREFIX.length), 'hex');
    const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1;

    if (packed.length < minLength) {
      throw new InternalServerErrorException('Invalid encrypted payload');
    }

    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Failed to decrypt credential payload — check CREDENTIALS_ENCRYPTION_KEY',
      );
    }
  }

  /** Encrypt các field nhạy cảm trong object trước khi ghi MongoDB */
  encryptSensitiveFields(
    data?: Record<string, string> | null,
  ): Record<string, string> | undefined {
    if (!data || typeof data !== 'object') return undefined;

    const next: Record<string, string> = { ...data };

    for (const key of SENSITIVE_DATA_KEYS) {
      const value = next[key];
      if (typeof value === 'string' && value.length > 0) {
        next[key] = this.encrypt(value);
      }
    }

    return next;
  }

  /** Decrypt field nhạy cảm khi resolve / gửi n8n */
  decryptSensitiveFields(
    data?: Record<string, string> | null,
  ): Record<string, string> | undefined {
    if (!data || typeof data !== 'object') return undefined;

    const next: Record<string, string> = { ...data };

    for (const key of SENSITIVE_DATA_KEYS) {
      const value = next[key];
      if (typeof value === 'string' && value.length > 0) {
        next[key] = this.decrypt(value);
      }
    }

    return next;
  }

  /** Mask secret khi list API — không trả plaintext/ciphertext ra ngoài */
  maskSensitiveFields(
    data?: Record<string, string> | null,
  ): Record<string, string> | undefined {
    if (!data || typeof data !== 'object') return undefined;

    const next: Record<string, string> = { ...data };

    for (const key of SENSITIVE_DATA_KEYS) {
      if (typeof next[key] === 'string' && next[key].length > 0) {
        next[key] = '********';
      }
    }

    return next;
  }

  private parseKey(raw: string): Buffer {
    const trimmed = raw.trim();

    // 64 hex chars = 32 bytes
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }

    // base64 → 32 bytes
    try {
      const fromB64 = Buffer.from(trimmed, 'base64');
      if (fromB64.length === KEY_LENGTH) {
        return fromB64;
      }
    } catch {
      // fall through
    }

    const asUtf8 = Buffer.from(trimmed, 'utf8');
    if (asUtf8.length === KEY_LENGTH) {
      return asUtf8;
    }

    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64). Got ${asUtf8.length} utf8 bytes.`,
    );
  }
}

/** timing-safe compare helper — export nếu cần verify secrets */
export function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
