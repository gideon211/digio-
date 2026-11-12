import 'reflect-metadata';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
      bodyLimit: 1_048_576,
    }),
    {
      bufferLogs: true,
      // Paystack signs the raw bytes; keep them before JSON parsing.
      rawBody: true,
    },
  );

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(compress, { global: true, encodings: ['gzip', 'deflate'] });

  // Fastify rejects `content-type: application/json` with a zero-length body.
  // A POST with nothing to say (cancel, for instance) is still a valid request,
  // so an empty payload is read as `{}`. Everything else goes through Fastify's
  // own parser, which keeps its prototype-poisoning guards.
  const fastify = app.getHttpAdapter().getInstance();
  const parseJson = fastify.getDefaultJsonParser('error', 'error');
  app.useBodyParser('application/json', { bodyLimit: 1_048_576 }, (request, body, done) => {
    if (!body || body.length === 0) {
      done(null, {});
      return;
    }
    parseJson(request as Parameters<typeof parseJson>[0], body.toString(), done);
  });

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
    .addTag('rentals', 'Rental availability by date range')
    .addTag('enquiries', 'Corporate, events, jets and yachts')
    .addTag('bookings', 'Quote → booking')
    .addTag('payments', 'Paystack deposits and webhooks')
    .addTag('catalog', 'Zones, vehicle classes, extras')
    .addTag('tracking', 'Live trip tracking, driver pings and nearby cars')
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
