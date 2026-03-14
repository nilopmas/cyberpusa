// Domain modules — public contract
export { contentPublicRoutes, contentAdminRoutes } from './content/routes';
export { ContentService } from './content/service';
export {
  collectionSchema,
  entrySchema,
  contentStatus,
  type Collection,
  type Entry,
  type ContentStatus,
} from './content/schema';
export { authRoutes } from './auth/routes';
export { AuthService } from './auth/service';
export { requireAuth, requireRole, type AuthVariables } from './auth/middleware';
export { loginBody, userRole, type AuthUser, type SessionInfo, type UserRole } from './auth/schema';
export { adminPages } from './admin/pages';
