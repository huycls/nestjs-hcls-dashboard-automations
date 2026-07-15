import type { CredentialType } from './schemas/user-credential.schema';

export type UserCredentialItem = {
  id: string;
  ownerId: string;
  type: CredentialType;
  label: string;
  n8nCredentialId?: string;
  /** WordPress / api-key payload — chỉ trả cho owner */
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

export type UpsertApiKeyCredentialDto = {
  label: string;
  apiKey: string;
  /** Nếu có — update credential hiện có thay vì tạo mới */
  existingId?: string;
  provider?: string;
};
