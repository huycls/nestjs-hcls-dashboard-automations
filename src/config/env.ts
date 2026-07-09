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
