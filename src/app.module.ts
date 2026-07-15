import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AutomationsModule } from './automations/automations.module';
import { getMongoConnectionString, isQueueEnabled } from './config/env';
import { CredentialsModule } from './credentials/credentials.module';
import { CryptoModule } from './crypto/crypto.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    MongooseModule.forRoot(getMongoConnectionString()),
    ...(isQueueEnabled()
      ? [
          BullModule.forRoot({
            connection: {
              host: process.env.REDIS_HOST ?? 'localhost',
              port: Number(process.env.REDIS_PORT ?? 6379),
              password: process.env.REDIS_PASSWORD || undefined,
            },
          }),
        ]
      : []),
    CryptoModule,
    AuthModule,
    CredentialsModule,
    AutomationsModule,
    JobsModule.register(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
