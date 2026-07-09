import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';

function getAdminSeedConfig() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim() || 'Admin';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }

  return { email, password, name };
}

async function seedAdminUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  const config = getAdminSeedConfig();

  const user = await authService.upsertAdmin(config);

  console.log('Admin user ready:');
  console.log(JSON.stringify(user, null, 2));

  await app.close();
}

seedAdminUser().catch((error) => {
  console.error(error);
  process.exit(1);
});
