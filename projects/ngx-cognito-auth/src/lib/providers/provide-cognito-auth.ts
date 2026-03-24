import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { withInterceptors, HttpFeature, HttpFeatureKind } from '@angular/common/http';
import { CognitoAuthConfig } from '../interfaces/cognito-auth-config.interface';
import { COGNITO_AUTH_CONFIG } from '../tokens/cognito-auth-config.token';
import { CognitoAuthService } from '../services/cognito-auth.service';
import { CognitoAuthGuard } from '../guards/cognito-auth.guard';
import { CognitoCallbackResolver } from '../resolvers/cognito-callback.resolver';
import { cognitoBearerInterceptor } from '../interceptors/cognito-bearer.interceptor';

/**
 * Returns the HTTP interceptor feature for Cognito Bearer token attachment.
 *
 * Pass this to `provideHttpClient()`:
 * ```ts
 * provideHttpClient(withCognitoInterceptor())
 * ```
 */
export function withCognitoInterceptor(): HttpFeature<HttpFeatureKind.Interceptors> {
  return withInterceptors([cognitoBearerInterceptor]);
}

/**
 * Registers all ngx-cognito-auth providers for standalone Angular applications.
 *
 * Recommended usage in `app.config.ts`:
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideRouter(routes),
 *     provideHttpClient(withCognitoInterceptor()),
 *     provideCognitoAuth({
 *       userPoolId: 'us-east-1_XXXXXXXXX',
 *       clientId: 'YOUR_CLIENT_ID',
 *       domain: 'your-domain.auth.us-east-1.amazoncognito.com',
 *       redirectUri: 'http://localhost:4200/callback',
 *       scopes: ['openid', 'email', 'profile'],
 *     }),
 *   ],
 * };
 * ```
 */
export function provideCognitoAuth(config: CognitoAuthConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: COGNITO_AUTH_CONFIG, useValue: config },
    CognitoAuthService,
    CognitoAuthGuard,
    CognitoCallbackResolver,
    provideAppInitializer(() => {
      const authService = inject(CognitoAuthService);
      return authService.initialize();
    }),
  ]);
}
