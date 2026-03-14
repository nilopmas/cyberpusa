import { z } from 'zod';

export const userRole = z.enum(['owner', 'admin', 'editor', 'viewer']);
export type UserRole = z.infer<typeof userRole>;

export const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface SessionInfo {
  token: string;
  expiresAt: string;
  user: AuthUser;
}
