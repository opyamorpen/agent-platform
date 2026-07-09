export interface Auth {
  ensureAuthenticated(): Promise<void>;
  getAccessTokenOrThrow(): string;
  clearAuthentication(): Promise<void>;
}

export { AuthService } from './service.js';

export type {
  AuthServiceDependencies,
  AuthServiceOptions
} from './service.js';
