import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { COGNITO_AUTH_CONFIG } from '../tokens/cognito-auth-config.token';
import { CognitoAuthService } from '../services/cognito-auth.service';

/**
 * Functional HTTP interceptor that attaches a `Authorization: Bearer <token>`
 * header to every outgoing request when the user is authenticated.
 *
 * Requests to the Cognito token endpoint itself are skipped to prevent
 * infinite loops during the token exchange and silent refresh flows.
 *
 * Add this interceptor via `provideHttpClient(withCognitoInterceptor())`.
 */
export const cognitoBearerInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(COGNITO_AUTH_CONFIG);

  // Skip the Cognito token endpoint to avoid attaching an (absent) token to
  // the very request that fetches the token.
  if (req.url.includes(`${config.domain}/oauth2/`)) {
    return next(req);
  }

  const authService = inject(CognitoAuthService);
  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
  );
};
