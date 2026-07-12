import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import {
  UserCredential,
  UserCredentialSchema,
} from './schemas/user-credential.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: UserCredential.name, schema: UserCredentialSchema },
    ]),
  ],
  controllers: [CredentialsController],
  providers: [CredentialsService],
  exports: [CredentialsService],
})
export class CredentialsModule {}
