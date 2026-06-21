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
  const app = await NestFactory.create(AppModule);

  // Allow the dashboard (separate origin in dev) to call REST + connect via Socket.IO.
  app.enableCors({ origin: true });

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

  // gRPC microservice (SPEC §9), reusing the same service layer.
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

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
