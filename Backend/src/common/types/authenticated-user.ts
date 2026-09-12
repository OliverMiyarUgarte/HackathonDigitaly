import type { UserRole } from '@telemed/service-contracts';

export interface AuthenticatedUser {
  sub: string;
  role: UserRole;
}
