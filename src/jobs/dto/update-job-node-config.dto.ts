/**
 * FE vẫn gửi shape Approach C — BE upsert secrets vào user_credentials,
 * job chỉ giữ credentialId + settings không-secret.
 */
export class UpdateJobNodeConfigCredentialsDto {
  openRouterApiKey?: string;
  model?: string;
  spreadsheetId?: string;
  /** Optional explicit refs (nếu FE chọn từ vault) */
  apiKeyCredentialId?: string;
  googleCredentialId?: string;
  wordpressCredentialId?: string;
}

export class UpdateJobNodeConfigDto {
  topic?: string;
  name?: string;
  credentials: UpdateJobNodeConfigCredentialsDto;
}
