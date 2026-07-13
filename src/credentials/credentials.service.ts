import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import type {
  CreateCredentialDto,
  UpdateCredentialDto,
  UserCredentialItem,
} from './credentials.types';
import {
  CREDENTIAL_TYPES,
  UserCredential,
  UserCredentialDocument,
  type CredentialType,
} from './schemas/user-credential.schema';

@Injectable()
export class CredentialsService {
  constructor(
    @InjectModel(UserCredential.name)
    private readonly credentialModel: Model<UserCredentialDocument>,
  ) {}

  async findAllByUser(userId: string): Promise<UserCredentialItem[]> {
    const docs = await this.credentialModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .exec();

    return docs.map(toItem);
  }

  async findAllByUserAndType(
    userId: string,
    type: CredentialType,
  ): Promise<UserCredentialItem[]> {
    const docs = await this.credentialModel
      .find({ userId, type })
      .sort({ updatedAt: -1 })
      .exec();

    return docs.map(toItem);
  }

  async findOneForUser(
    userId: string,
    id: string,
  ): Promise<UserCredentialItem> {
    const doc = await this.findEntityForUser(userId, id);
    return toItem(doc);
  }

  /** Resolve nhiều credential ids thuộc user — throw nếu thiếu / không thuộc user */
  async resolveForUser(
    userId: string,
    ids: string[],
  ): Promise<Map<string, UserCredentialItem>> {
    const uniqueIds = [...new Set(ids.filter((id) => id?.trim()))];
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const docs = await this.credentialModel
      .find({ userId, id: { $in: uniqueIds } })
      .exec();

    const map = new Map(docs.map((doc) => [doc.id, toItem(doc)]));

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
    userId: string,
    dto: CreateCredentialDto,
  ): Promise<UserCredentialItem> {
    this.assertType(dto.type);
    this.validatePayload(dto.type, dto);

    const doc = await this.credentialModel.create({
      id: `cred-${randomUUID()}`,
      userId,
      type: dto.type,
      label: dto.label.trim(),
      n8nCredentialId: dto.n8nCredentialId?.trim() || undefined,
      data: dto.data,
    });

    return toItem(doc);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCredentialDto,
  ): Promise<UserCredentialItem> {
    const doc = await this.findEntityForUser(userId, id);

    if (dto.label !== undefined) {
      doc.label = dto.label.trim();
    }
    if (dto.n8nCredentialId !== undefined) {
      doc.n8nCredentialId = dto.n8nCredentialId.trim() || undefined;
    }
    if (dto.data !== undefined) {
      doc.data = dto.data;
      doc.markModified('data');
    }

    this.validatePayload(doc.type, {
      n8nCredentialId: doc.n8nCredentialId,
      data: doc.data,
    });

    await doc.save();
    return toItem(doc);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findEntityForUser(userId, id);
    await this.credentialModel.deleteOne({ id, userId }).exec();
  }

  private async findEntityForUser(
    userId: string,
    id: string,
  ): Promise<UserCredentialDocument> {
    const doc = await this.credentialModel.findOne({ id, userId }).exec();

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
    if (type === 'google-oauth' || type === 'api-key') {
      if (!dto.n8nCredentialId?.trim()) {
        throw new BadRequestException(
          `${type} requires n8nCredentialId`,
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

function toItem(doc: UserCredentialDocument): UserCredentialItem {
  return {
    id: doc.id,
    userId: doc.userId,
    type: doc.type,
    label: doc.label,
    n8nCredentialId: doc.n8nCredentialId,
    data: doc.data,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
