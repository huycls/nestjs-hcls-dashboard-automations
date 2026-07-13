import type { CredentialType } from './schemas/user-credential.schema';

export type UserCredentialItem = {
  id: string;
  userId: string;
  type: CredentialType;
  label: string;
  n8nCredentialId?: string;
  /** WordPress auth — không trả appPassword đầy đủ ra list nếu cần mask; hiện trả đủ cho owner */
  data?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type CreateCredentialDto = {
  type: CredentialType;
  label: string;
  n8nCredentialId?: string;
  data?: Record<string, string>;
};

export type UpdateCredentialDto = {
  label?: string;
  n8nCredentialId?: string;
  data?: Record<string, string>;
};
