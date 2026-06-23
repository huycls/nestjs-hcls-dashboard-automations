import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function getCorsOrigins(): string | string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

  if (raw === '*') {
    return '*';
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getHttpCorsOptions(): CorsOptions {
  const origin = getCorsOrigins();

  return {
    origin,
    credentials: origin !== '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-n8n-callback-secret',
    ],
  };
}

export function getSocketCorsOptions() {
  const origin = getCorsOrigins();

  return {
    origin,
    credentials: origin !== '*',
  };
}
