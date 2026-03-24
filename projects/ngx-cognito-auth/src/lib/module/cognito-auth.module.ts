import {
  inject,
  ModuleWithProviders,
  NgModule,
  provideAppInitializer,
} from '@angular/core';
import { CognitoAuthConfig } from '../interfaces/cognito-auth-config.interface';
import { COGNITO_AUTH_CONFIG } from '../tokens/cognito-auth-config.token';
import { CognitoAuthService } from '../services/cognito-auth.service';
import { CognitoAuthGuard } from '../guards/cognito-auth.guard';
import { CognitoCallbackResolver } from '../resolvers/cognito-callback.resolver';

/**
 * NgModule-based entry point for apps that do not use standalone bootstrapping.
 *
 * Usage in `AppModule`:
 * ```ts
 * @NgModule({
 *   imports: [
 *     CognitoAuthModule.forRoot({
 *       userPoolId: 'us-east-1_XXXXXXXXX',
 *       clientId: 'YOUR_CLIENT_ID',
 *       domain: 'your-domain.auth.us-east-1.amazoncognito.com',
 *       redirectUri: 'http://localhost:4200/callback',
 *       scopes: ['openid', 'email', 'profile'],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * Note: Register the Bearer interceptor separately via `withCognitoInterceptor()`:
 * ```ts
 * provideHttpClient(withCognitoInterceptor())
 * ```
 */
@NgModule({})
export class CognitoAuthModule {
  static forRoot(
    config: CognitoAuthConfig
  ): ModuleWithProviders<CognitoAuthModule> {
    return {
      ngModule: CognitoAuthModule,
      providers: [
        { provide: COGNITO_AUTH_CONFIG, useValue: config },
        CognitoAuthService,
        CognitoAuthGuard,
        CognitoCallbackResolver,
        provideAppInitializer(() => {
          const authService = inject(CognitoAuthService);
          return authService.initialize();
        }),
      ],
    };
  }
}
