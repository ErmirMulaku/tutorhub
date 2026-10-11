import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Validates a task's raw `input` object against its DTO class, the same way
 * the global `ValidationPipe` validates a normal request body — needed here
 * because `input`'s shape depends on `task`, so it can't be declared as a
 * fixed DTO on the controller method.
 */
export async function validateTaskInput<T extends object>(
  dtoClass: new () => T,
  raw: unknown,
): Promise<T> {
  const instance = plainToInstance(dtoClass, raw);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new BadRequestException(messages);
  }
  return instance;
}
