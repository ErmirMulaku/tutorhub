import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Principal, RequestWithPrincipal } from './principal.js';

/** Injects the {@link Principal} attached by {@link PrincipalGuard}. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = context.switchToHttp().getRequest<RequestWithPrincipal>().principal;
    if (principal === undefined) {
      throw new UnauthorizedException();
    }
    return principal;
  },
);
