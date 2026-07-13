export class UpdateNodeConfigCredentialsDto {
  openRouterApiKey: string;
  model: string;
  spreadsheetId?: string;
}

/** Node config từ FE editor (Approach C) — topic + shared credentials */
export class UpdateNodeConfigDto {
  topic?: string;
  credentials: UpdateNodeConfigCredentialsDto;
}
