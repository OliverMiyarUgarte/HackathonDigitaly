import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user';
import type { RequestWithContext } from '../types/request-with-context';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    if (!request.user) {
      throw new UnauthorizedException({
        errorCode: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }
    return request.user;
  },
);
