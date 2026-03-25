import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, from, switchMap, catchError, throwError } from 'rxjs';
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

/**
 * Internal marker: prevents infinite retry loops when a reactive 401 triggers
 * a token refresh and the retried request also returns 401.
 */
const COGNITO_RETRY_ATTEMPTED = new HttpContextToken<boolean>(() => false);

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

/** Returns true only for auth errors that warrant a re-login (not network failures). */
function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  return status === 400 || status === 401;
}

/**
 * Functional HTTP interceptor that attaches a `Authorization: Bearer <token>`
 * header to every outgoing request when the user is authenticated.
 *
 * Behaviour:
 * - Skips Cognito token endpoint requests (prevents loops).
 * - Respects `SKIP_COGNITO_BEARER` context token for public endpoints.
 * - Pre-emptive refresh: if the local token is expired, refreshes before sending.
 * - Reactive 401 handling: if the server returns 401, refreshes once and retries.
 * - On auth failure (400/401 from Cognito), redirects to login preserving the current URL.
 * - Network/server errors (5xx, timeout) are propagated unchanged.
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

  /**
   * Refresh tokens then retry `originalReq` with the fresh access token.
   * On auth failure redirects to login; on other errors propagates the error.
   */
  const refreshAndRetry = (originalReq: typeof req) =>
    from(authService.refreshTokens()).pipe(
      switchMap(() => {
        const fresh = authService.getToken();
        return next(
          fresh
            ? originalReq.clone({ setHeaders: { Authorization: `Bearer ${fresh}` } })
            : originalReq
        );
      }),
      catchError((err) => {
        if (isAuthError(err)) {
          authService.login(window.location.pathname + window.location.search);
          return EMPTY;
        }
        return throwError(() => err);
      })
    );

  // Pre-emptive refresh: local token is already expired before sending.
  if (isJwtExpired(token)) {
    return refreshAndRetry(req);
  }

  // Send with valid token and handle a reactive 401 from the server
  // (e.g. token revoked server-side before local expiry).
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((err) => {
      if (
        (err as { status?: number }).status === 401 &&
        !req.context.get(COGNITO_RETRY_ATTEMPTED)
      ) {
        // Mark the shared context so the retried request won't loop.
        req.context.set(COGNITO_RETRY_ATTEMPTED, true);
        return refreshAndRetry(req);
      }
      return throwError(() => err);
    })
  );
};
