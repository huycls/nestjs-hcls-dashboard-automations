import type { UserRole } from './schemas/user.schema';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};
