import { CryptoService, ENC_PREFIX } from './crypto.service';

describe('CryptoService', () => {
  const previous = process.env.CREDENTIALS_ENCRYPTION_KEY;
  let service: CryptoService;

  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'a'.repeat(64);
    service = new CryptoService();
    service.onModuleInit();
  });

  afterAll(() => {
    if (previous === undefined) {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIALS_ENCRYPTION_KEY = previous;
    }
  });

  it('encrypts and decrypts with aes-256-gcm', () => {
    const plain = 'sk-or-v1-super-secret';
    const encrypted = service.encrypt(plain);

    expect(encrypted.startsWith(ENC_PREFIX)).toBe(true);
    expect(encrypted).not.toContain(plain);
    expect(service.decrypt(encrypted)).toBe(plain);
  });

  it('does not double-encrypt', () => {
    const once = service.encrypt('hello');
    const twice = service.encrypt(once);
    expect(twice).toBe(once);
  });

  it('encrypts only sensitive fields', () => {
    const encrypted = service.encryptSensitiveFields({
      apiKey: 'secret-key',
      provider: 'openrouter',
      siteUrl: 'https://example.com',
    });

    expect(encrypted?.provider).toBe('openrouter');
    expect(encrypted?.siteUrl).toBe('https://example.com');
    expect(encrypted?.apiKey?.startsWith(ENC_PREFIX)).toBe(true);
    expect(service.decryptSensitiveFields(encrypted)?.apiKey).toBe(
      'secret-key',
    );
  });

  it('masks sensitive fields for list responses', () => {
    const masked = service.maskSensitiveFields({
      apiKey: 'enc:v1:abcd',
      provider: 'openrouter',
    });

    expect(masked?.apiKey).toBe('********');
    expect(masked?.provider).toBe('openrouter');
  });
});
