import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
      bodyLimit: 1_048_576,
    }),
    { bufferLogs: true },
  );

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(compress, { global: true, encodings: ['gzip', 'deflate'] });

  const configuredOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const isProduction = config.get<string>('NODE_ENV') === 'production';

  app.enableCors({
    // Empty allow-list means "reflect origin" — acceptable for local development,
    // enforced by CORS_ORIGINS in every deployed environment.
    origin: configuredOrigins.length > 0 ? configuredOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Digio API')
    .setDescription(
      'Booking API for chauffeur transfers, chauffeur day hire and self-drive rentals. ' +
        'Prices are server-owned: clients receive a signed quote token, never a price.',
    )
    .setVersion('0.1.0')
    .addTag('quotes', 'Server-resolved pricing')
    .addTag('bookings', 'Quote → booking')
    .addTag('catalog', 'Zones, vehicle classes, extras')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: false });

  const port = config.get<number>('PORT') ?? 4000;
  const host = config.get<string>('HOST') ?? '0.0.0.0';

  await app.listen({ port, host });
  logger.log(`Digio API listening on http://${host}:${port}/v1`);
  logger.log(`OpenAPI docs at http://localhost:${port}/docs`);
  logger.log(`Mode: ${isProduction ? 'production' : 'development'}`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start Digio API', error);
  process.exit(1);
});
