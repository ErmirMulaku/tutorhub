import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DomainExceptionFilter } from './common/domain-exception.filter.js';
import { MetricsService } from './monitoring/metrics.service.js';
import { createRequestMetrics } from './monitoring/request-metrics.js';

const PROTO_PATH = fileURLToPath(new URL('../../../proto/booking.proto', import.meta.url));

async function bootstrap(): Promise<void> {
  // `rawBody: true` preserves the unparsed request body so the Stripe webhook
  // controller can verify the event signature against the exact bytes sent.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Allow the browser apps (separate origins) to call REST + connect via Socket.IO.
  // In production, pin this to the deployed front-end origins via CORS_ORIGINS
  // (comma-separated); reflecting any origin would let any site call the API
  // with a user's cookies/token.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '');
  app.enableCors({ origin: corsOrigins.length > 0 ? corsOrigins : true, credentials: true });

  // Record request metrics + structured access logs for every HTTP request.
  app.use(createRequestMetrics(app.get(MetricsService)));

  // Validate and strip every inbound payload (SPEC §7: validate all input).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Map transport-agnostic domain errors to HTTP / GraphQL shapes.
  app.useGlobalFilters(new DomainExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TutorHub API')
    .setDescription('REST API for the TutorHub tutoring marketplace.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  // gRPC microservice (SPEC §9), reusing the same service layer. It binds a
  // *second* port, which serverless hosts like Cloud Run cannot expose (exactly
  // one port per container), so it is opt-out via GRPC_ENABLED=false there.
  if (process.env.GRPC_ENABLED !== 'false') {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: 'tutorhub.v1',
        protoPath: PROTO_PATH,
        url: process.env.GRPC_URL ?? '0.0.0.0:50051',
        loader: { longs: Number, enums: String, defaults: true, oneofs: true },
      },
    });
    await app.startAllMicroservices();
  }

  // Cloud Run injects PORT (8080) and requires binding on 0.0.0.0.
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
