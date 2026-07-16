import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { GoogleIntegrationsController } from './google/google.controller';
import { GoogleOAuthService } from './google/google-oauth.service';

@Module({
  imports: [AuthModule, CredentialsModule],
  controllers: [GoogleIntegrationsController],
  providers: [GoogleOAuthService],
  exports: [GoogleOAuthService],
})
export class IntegrationsModule {}
