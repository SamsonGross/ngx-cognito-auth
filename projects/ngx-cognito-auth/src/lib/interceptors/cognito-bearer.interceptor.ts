import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { COGNITO_AUTH_CONFIG } from '../tokens/cognito-auth-config.token';
import { CognitoAuthService } from '../services/cognito-auth.service';

/**
 * Set this context token to `true` on a request to skip automatic Bearer
 * token injection by the interceptor.
 *
 * ```ts
 * http.get('/api/public', {
 *   context: new HttpContext().set(SKIP_COGNITO_BEARER, true),
 * });
 * ```
 */
export const SKIP_COGNITO_BEARER = new HttpContextToken<boolean>(() => false);

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return typeof payload['exp'] === 'number'
      ? Date.now() / 1000 > payload['exp']
      : true;
  } catch {
    return true;
  }
}

/**
 * Functional HTTP interceptor that attaches a `Authorization: Bearer <token>`
 * header to every outgoing request when the user is authenticated.
 *
 * If the stored access token is expired, a silent refresh is attempted first.
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

  // Allow callers to explicitly opt out of Bearer injection.
  if (req.context.get(SKIP_COGNITO_BEARER)) {
    return next(req);
  }

  const authService = inject(CognitoAuthService);
  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  // Token expired → silently refresh before forwarding the request.
  if (isJwtExpired(token)) {
    return from(authService.refreshTokens()).pipe(
      switchMap(() => {
        const fresh = authService.getToken();
        return next(
          fresh
            ? req.clone({ setHeaders: { Authorization: `Bearer ${fresh}` } })
            : req
        );
      })
    );
  }

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
  );
};
