import type { NodeTypeId } from '../data';

export class UpsertNodeCredentialDto {
  nodeTypeId: NodeTypeId;
  credentialId: string;
  config?: Record<string, string>;
}
