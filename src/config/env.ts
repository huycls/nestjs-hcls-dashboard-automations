/** BullMQ chỉ bật khi có Redis — tránh ECONNREFUSED lúc dev local */
export function isQueueEnabled() {
  return process.env.QUEUE_ENABLED === 'true';
}

export function getMongoConnectionString(): string {
  const uri = process.env.MONGODB_CONNECTION_STRING?.trim();

  if (!uri) {
    throw new Error('MONGODB_CONNECTION_STRING is required');
  }

  return uri;
}

export function getJwtAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET?.trim();

  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is required');
  }

  return secret;
}

export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET?.trim();

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is required');
  }

  return secret;
}

export function getJwtAccessExpiresIn(): string {
  return process.env.JWT_ACCESS_EXPIRES_IN?.trim() || '15m';
}

export function getJwtRefreshExpiresIn(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN?.trim() || '7d';
}

/**
 * AES-256-GCM key cho secrets trong `user_credentials`.
 * Format: 64 hex chars (32 bytes) hoặc base64 32-byte.
 */
export function getCredentialsEncryptionKey(): string {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();

  if (!key) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY is required (32-byte key as 64 hex chars)',
    );
  }

  return key;
}

export function getGoogleClientId(): string {
  const value = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!value) {
    throw new Error('GOOGLE_CLIENT_ID is required for Google OAuth');
  }
  return value;
}

export function getGoogleClientSecret(): string {
  const value = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!value) {
    throw new Error('GOOGLE_CLIENT_SECRET is required for Google OAuth');
  }
  return value;
}

/** Nest callback URL — phải khớp Google Cloud Console redirect URI */
export function getGoogleRedirectUri(): string {
  const value = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (value) return value;

  const appUrl = (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 5000}`)
    .replace(/\/$/, '');
  return `${appUrl}/api/integrations/google/callback`;
}

export function getGoogleOAuthScopes(): string[] {
  const raw = process.env.GOOGLE_OAUTH_SCOPES?.trim();
  if (raw) {
    return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  }

  return [
    'openid',
    'email',
    'https://www.googleapis.com/auth/spreadsheets',
  ];
}
