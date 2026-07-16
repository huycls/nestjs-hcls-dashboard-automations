import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import { CryptoService } from '../crypto/crypto.service';
import type {
  CreateCredentialDto,
  UpdateCredentialDto,
  UpsertApiKeyCredentialDto,
  UserCredentialItem,
} from './credentials.types';
import {
  CREDENTIAL_TYPES,
  UserCredential,
  UserCredentialDocument,
  type CredentialType,
} from './schemas/user-credential.schema';

type ToItemMode = 'decrypt' | 'mask';

@Injectable()
export class CredentialsService implements OnModuleInit {
  constructor(
    @InjectModel(UserCredential.name)
    private readonly credentialModel: Model<UserCredentialDocument>,
    private readonly cryptoService: CryptoService,
  ) {}

  /** Migrate legacy `userId` → `ownerId` */
  async onModuleInit() {
    await this.credentialModel
      .updateMany(
        { userId: { $exists: true }, ownerId: { $exists: false } },
        { $rename: { userId: 'ownerId' } },
      )
      .exec();
  }

  async findAllByUser(ownerId: string): Promise<UserCredentialItem[]> {
    const docs = await this.credentialModel
      .find({ ownerId })
      .sort({ updatedAt: -1 })
      .exec();

    // List: mask secrets — không trả plaintext / ciphertext
    return docs.map((doc) => this.toItem(doc, 'mask'));
  }

  async findAllByUserAndType(
    ownerId: string,
    type: CredentialType,
  ): Promise<UserCredentialItem[]> {
    const docs = await this.credentialModel
      .find({ ownerId, type })
      .sort({ updatedAt: -1 })
      .exec();

    return docs.map((doc) => this.toItem(doc, 'mask'));
  }

  async findOneForUser(
    ownerId: string,
    id: string,
  ): Promise<UserCredentialItem> {
    const doc = await this.findEntityForUser(ownerId, id);
    // Owner xem/chi tiết: decrypt để fill form
    return this.toItem(doc, 'decrypt');
  }

  /**
   * Resolve nhiều credential ids thuộc owner — decrypt secrets
   * (dùng khi dispatch → n8n hoặc hydrate editor).
   */
  async resolveForUser(
    ownerId: string,
    ids: string[],
  ): Promise<Map<string, UserCredentialItem>> {
    const uniqueIds = [...new Set(ids.filter((id) => id?.trim()))];
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const docs = await this.credentialModel
      .find({ ownerId, id: { $in: uniqueIds } })
      .exec();

    const map = new Map(
      docs.map((doc) => [doc.id, this.toItem(doc, 'decrypt')]),
    );

    for (const id of uniqueIds) {
      if (!map.has(id)) {
        throw new NotFoundException(
          `Credential ${id} not found for this user`,
        );
      }
    }

    return map;
  }

  async create(
    ownerId: string,
    dto: CreateCredentialDto,
  ): Promise<UserCredentialItem> {
    this.assertType(dto.type);
    this.validatePayload(dto.type, dto);

    const doc = await this.credentialModel.create({
      id: `cred-${randomUUID()}`,
      ownerId,
      type: dto.type,
      label: dto.label.trim(),
      n8nCredentialId: dto.n8nCredentialId?.trim() || undefined,
      data: this.cryptoService.encryptSensitiveFields(dto.data),
    });

    return this.toItem(doc, 'decrypt');
  }

  async update(
    ownerId: string,
    id: string,
    dto: UpdateCredentialDto,
  ): Promise<UserCredentialItem> {
    const doc = await this.findEntityForUser(ownerId, id);

    if (dto.label !== undefined) {
      doc.label = dto.label.trim();
    }
    if (dto.n8nCredentialId !== undefined) {
      doc.n8nCredentialId = dto.n8nCredentialId.trim() || undefined;
    }
    if (dto.data !== undefined) {
      // Merge plaintext (hoặc masked) từ client — encrypt trước khi ghi
      const merged = {
        ...(doc.data ?? {}),
        ...this.stripMaskedPlaceholders(dto.data),
      };
      doc.data = this.cryptoService.encryptSensitiveFields(merged);
      doc.markModified('data');
    }

    // Validate trên bản decrypt (tránh false-negative vì ciphertext)
    this.validatePayload(doc.type, {
      n8nCredentialId: doc.n8nCredentialId,
      data: this.cryptoService.decryptSensitiveFields(doc.data),
    });

    await doc.save();
    return this.toItem(doc, 'decrypt');
  }

  /**
   * Upsert OpenRouter/API key vào vault (encrypted at rest).
   * Job chỉ lưu `credentialId`.
   */
  async upsertApiKey(
    ownerId: string,
    dto: UpsertApiKeyCredentialDto,
  ): Promise<UserCredentialItem> {
    const apiKey = dto.apiKey?.trim();
    if (!apiKey) {
      throw new BadRequestException('apiKey is required');
    }

    // Bỏ qua nếu FE gửi lại masked placeholder
    if (apiKey === '********' || this.cryptoService.isEncrypted(apiKey)) {
      if (dto.existingId?.trim()) {
        return this.findOneForUser(ownerId, dto.existingId.trim());
      }
      throw new BadRequestException('apiKey is required');
    }

    const data: Record<string, string> = {
      apiKey,
      ...(dto.provider
        ? { provider: dto.provider }
        : { provider: 'openrouter' }),
    };

    if (dto.existingId?.trim()) {
      try {
        return await this.update(ownerId, dto.existingId.trim(), {
          label: dto.label.trim(),
          data,
        });
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    return this.create(ownerId, {
      type: 'api-key',
      label: dto.label.trim() || 'API Key',
      data,
    });
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.findEntityForUser(ownerId, id);
    await this.credentialModel.deleteOne({ id, ownerId }).exec();
  }

  private toItem(
    doc: UserCredentialDocument,
    mode: ToItemMode,
  ): UserCredentialItem {
    const data =
      mode === 'decrypt'
        ? this.cryptoService.decryptSensitiveFields(doc.data)
        : this.cryptoService.maskSensitiveFields(doc.data);

    return {
      id: doc.id,
      ownerId: doc.ownerId,
      type: doc.type,
      label: doc.label,
      n8nCredentialId: doc.n8nCredentialId,
      data,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /** Không ghi đè secret đã encrypt bằng placeholder từ FE list/mask */
  private stripMaskedPlaceholders(
    data: Record<string, string>,
  ): Record<string, string> {
    const next: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === '********') continue;
      next[key] = value;
    }

    return next;
  }

  private async findEntityForUser(
    ownerId: string,
    id: string,
  ): Promise<UserCredentialDocument> {
    const doc = await this.credentialModel.findOne({ id, ownerId }).exec();

    if (!doc) {
      throw new NotFoundException(`Credential ${id} not found`);
    }

    return doc;
  }

  private assertType(type: string): asserts type is CredentialType {
    if (!CREDENTIAL_TYPES.includes(type as CredentialType)) {
      throw new BadRequestException(`Invalid credential type: ${type}`);
    }
  }

  private validatePayload(
    type: CredentialType,
    dto: {
      n8nCredentialId?: string;
      data?: Record<string, string>;
    },
  ) {
    if (type === 'google-oauth') {
      if (!dto.n8nCredentialId?.trim()) {
        throw new BadRequestException(
          'google-oauth requires n8nCredentialId',
        );
      }
      return;
    }

    if (type === 'api-key') {
      const hasN8n = Boolean(dto.n8nCredentialId?.trim());
      const hasApiKey = Boolean(dto.data?.apiKey?.trim());
      if (!hasN8n && !hasApiKey) {
        throw new BadRequestException(
          'api-key requires n8nCredentialId or data.apiKey',
        );
      }
      return;
    }

    if (type === 'wordpress') {
      const siteUrl = dto.data?.siteUrl?.trim();
      if (!siteUrl) {
        throw new BadRequestException(
          'wordpress credential requires data.siteUrl',
        );
      }
    }
  }
}
