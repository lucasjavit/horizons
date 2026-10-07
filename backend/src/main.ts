import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { LIMITE_DO_CORPO } from './limite-do-corpo';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  // O lote de ingestao (JOB-50) nao cabe nos 100 KB do padrao. Ver
  // `limite-do-corpo.ts` para os numeros medidos.
  app.useBodyParser('json', { limit: LIMITE_DO_CORPO });
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3333);
}
void bootstrap();
