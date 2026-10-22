import { ValidationPipe } from '@nestjs/common';

/**
 * The one global ValidationPipe (SPEC §7: validate all input). Production
 * (`main.ts`) and every e2e test use this factory, so tests can't run a looser
 * configuration than the deployed API.
 *
 * That mattered: most e2e suites used to omit `forbidNonWhitelisted`, which let
 * `TimeOffInput` ship with undecorated date fields — accepted in tests,
 * rejected by every real request.
 *
 * - `whitelist` strips properties without a class-validator decorator;
 * - `forbidNonWhitelisted` rejects the request instead of silently stripping;
 * - `transform` turns payloads into DTO instances (and scalars into types).
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
}
