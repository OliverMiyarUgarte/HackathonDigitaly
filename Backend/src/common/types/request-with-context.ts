import type { Request } from 'express';
import type { AuthenticatedUser } from './authenticated-user';

export interface RequestWithContext extends Request {
  correlationId: string;
  user?: AuthenticatedUser;
}
