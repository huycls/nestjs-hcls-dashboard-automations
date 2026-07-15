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
