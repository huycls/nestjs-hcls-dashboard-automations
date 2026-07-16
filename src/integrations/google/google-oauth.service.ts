import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { getCorsOrigins } from '../../config/cors';
import {
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleOAuthScopes,
  getGoogleRedirectUri,
} from '../../config/env';
import { CredentialsService } from '../../credentials/credentials.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

type GoogleOAuthStatePayload = {
  purpose: 'google-oauth';
  sub: string;
  returnUrl: string;
  nonce: string;
};

export type GoogleIntegrationStatus = {
  connected: boolean;
  email: string | null;
  spreadsheetId: string | null;
  status: 'connected' | 'disconnected' | 'expired' | 'revoked';
  credentialId?: string;
};

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly credentialsService: CredentialsService,
  ) {}

  async getAuthUrl(ownerId: string, returnUrl: string) {
    this.assertConfigured();
    const safeReturnUrl = this.sanitizeReturnUrl(returnUrl);

    const state = await this.jwtService.signAsync(
      {
        purpose: 'google-oauth',
        sub: ownerId,
        returnUrl: safeReturnUrl,
        nonce: randomBytes(8).toString('hex'),
      } satisfies GoogleOAuthStatePayload,
      { expiresIn: '10m' },
    );

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set('client_id', getGoogleClientId());
    url.searchParams.set('redirect_uri', getGoogleRedirectUri());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', getGoogleOAuthScopes().join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);

    return { authUrl: url.toString() };
  }

  async handleCallback(code: string | undefined, state: string | undefined) {
    this.assertConfigured();

    if (!code?.trim() || !state?.trim()) {
      throw new BadRequestException('code and state are required');
    }

    const payload = await this.verifyState(state.trim());
    const tokens = await this.exchangeCode(code.trim());
    const profile = await this.fetchUserInfo(tokens.access_token);

    await this.credentialsService.upsertGoogleOAuth(payload.sub, {
      label: `Google · ${profile.email}`,
      email: profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : undefined,
      scope: tokens.scope,
      tokenType: tokens.token_type,
    });

    return this.buildFrontendRedirect(payload.returnUrl, 'connected');
  }

  async getStatus(ownerId: string): Promise<GoogleIntegrationStatus> {
    const cred = await this.findPrimaryGoogleCredential(ownerId);
    if (!cred) {
      return {
        connected: false,
        email: null,
        spreadsheetId: null,
        status: 'disconnected',
      };
    }

    const email = cred.data?.email?.trim() || null;
    const spreadsheetId = cred.data?.spreadsheetId?.trim() || null;
    const hasTokens = Boolean(
      cred.data?.accessToken?.trim() || cred.data?.refreshToken?.trim(),
    );

    if (!hasTokens && !cred.n8nCredentialId) {
      return {
        connected: false,
        email,
        spreadsheetId,
        status: 'disconnected',
        credentialId: cred.id,
      };
    }

    return {
      connected: true,
      email,
      spreadsheetId,
      status: 'connected',
      credentialId: cred.id,
    };
  }

  async updateSpreadsheetId(ownerId: string, spreadsheetIdRaw: string) {
    const spreadsheetId = spreadsheetIdRaw?.trim();
    if (!spreadsheetId) {
      throw new BadRequestException('spreadsheetId is required');
    }

    const cred = await this.findPrimaryGoogleCredential(ownerId);
    if (!cred) {
      throw new BadRequestException(
        'Google is not connected. Sign in with Google first.',
      );
    }

    await this.credentialsService.update(ownerId, cred.id, {
      data: {
        ...(cred.data ?? {}),
        spreadsheetId,
      },
    });

    return this.getStatus(ownerId);
  }

  async disconnect(ownerId: string): Promise<GoogleIntegrationStatus> {
    const list = await this.credentialsService.findDecryptedByUserAndType(
      ownerId,
      'google-oauth',
    );

    for (const cred of list) {
      const token =
        cred.data?.refreshToken?.trim() || cred.data?.accessToken?.trim();
      if (token) {
        await this.revokeToken(token).catch((error) => {
          this.logger.warn(
            `Google revoke failed for ${cred.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      }
      await this.credentialsService.remove(ownerId, cred.id);
    }

    return {
      connected: false,
      email: null,
      spreadsheetId: null,
      status: 'disconnected',
    };
  }

  buildFrontendRedirect(
    returnUrl: string,
    result: 'connected' | 'error',
  ): string {
    const url = new URL(this.sanitizeReturnUrl(returnUrl));
    url.searchParams.set('google', result);
    return url.toString();
  }

  private async findPrimaryGoogleCredential(ownerId: string) {
    const list = await this.credentialsService.findDecryptedByUserAndType(
      ownerId,
      'google-oauth',
    );
    return list[0] ?? null;
  }

  private async verifyState(state: string): Promise<GoogleOAuthStatePayload> {
    try {
      const payload = await this.jwtService.verifyAsync<GoogleOAuthStatePayload>(
        state,
      );
      if (payload.purpose !== 'google-oauth' || !payload.sub) {
        throw new BadRequestException('Invalid OAuth state');
      }
      payload.returnUrl = this.sanitizeReturnUrl(payload.returnUrl);
      return payload;
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
  }

  private sanitizeReturnUrl(returnUrl: string): string {
    const fallback = this.defaultFrontendOrigin();
    const raw = returnUrl?.trim() || fallback;

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return fallback;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return fallback;
    }

    const allowed = this.allowedFrontendOrigins();
    if (allowed !== '*' && !allowed.includes(parsed.origin)) {
      this.logger.warn(
        `Blocked OAuth returnUrl origin ${parsed.origin}; falling back to ${fallback}`,
      );
      return fallback;
    }

    return parsed.toString();
  }

  private allowedFrontendOrigins(): string[] | '*' {
    const origins = getCorsOrigins();
    if (origins === '*') return '*';
    return Array.isArray(origins) ? origins : [origins];
  }

  private defaultFrontendOrigin(): string {
    const origins = this.allowedFrontendOrigins();
    if (origins === '*') return 'http://localhost:3000/';
    return `${origins[0]?.replace(/\/$/, '') || 'http://localhost:3000'}/`;
  }

  private assertConfigured() {
    try {
      getGoogleClientId();
      getGoogleClientSecret();
      getGoogleRedirectUri();
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error
          ? error.message
          : 'Google OAuth is not configured',
      );
    }
  }

  private async exchangeCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  }> {
    const body = new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getGoogleRedirectUri(),
      grant_type: 'authorization_code',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const payload = (await response.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
    } | null;

    if (!response.ok || !payload?.access_token) {
      this.logger.warn(
        `Google token exchange failed: ${payload?.error_description ?? payload?.error ?? response.status}`,
      );
      throw new BadRequestException(
        payload?.error_description ??
          payload?.error ??
          'Failed to exchange Google authorization code',
      );
    }

    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_in: payload.expires_in,
      scope: payload.scope,
      token_type: payload.token_type,
    };
  }

  private async fetchUserInfo(accessToken: string): Promise<{ email: string }> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const payload = (await response.json().catch(() => null)) as {
      email?: string;
      error?: { message?: string };
    } | null;

    if (!response.ok || !payload?.email) {
      throw new BadRequestException(
        payload?.error?.message ?? 'Failed to fetch Google user profile',
      );
    }

    return { email: payload.email };
  }

  private async revokeToken(token: string) {
    const url = new URL(GOOGLE_REVOKE_URL);
    url.searchParams.set('token', token);
    await fetch(url, { method: 'POST' });
  }
}

/** Stable hash helper — reserved for future device binding */
export function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
