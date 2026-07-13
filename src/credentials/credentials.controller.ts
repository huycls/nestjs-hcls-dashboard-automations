import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserDocument } from '../auth/schemas/user.schema';
import { CredentialsService } from './credentials.service';
import type {
  CreateCredentialDto,
  UpdateCredentialDto,
} from './credentials.types';
import type { CredentialType } from './schemas/user-credential.schema';

@Controller('credentials')
@UseGuards(JwtAuthGuard)
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Get()
  findAll(
    @CurrentUser() user: UserDocument,
    @Query('type') type?: CredentialType,
  ) {
    const userId = user._id.toString();
    if (type) {
      return this.credentialsService.findAllByUserAndType(userId, type);
    }
    return this.credentialsService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.credentialsService.findOneForUser(user._id.toString(), id);
  }

  @Post()
  create(
    @CurrentUser() user: UserDocument,
    @Body() body: CreateCredentialDto,
  ) {
    return this.credentialsService.create(user._id.toString(), body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() body: UpdateCredentialDto,
  ) {
    return this.credentialsService.update(user._id.toString(), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.credentialsService
      .remove(user._id.toString(), id)
      .then(() => ({ ok: true }));
  }
}
