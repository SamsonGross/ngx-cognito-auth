import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Resolve,
  ResolveFn,
  RouterStateSnapshot,
} from '@angular/router';
import { CognitoAuthService } from '../services/cognito-auth.service';

/**
 * Functional resolver for the OAuth callback route.
 * Extracts `code` and `state` query parameters, then calls
 * `CognitoAuthService.handleCallback()` which exchanges the code for tokens
 * and navigates to the post-login route.
 *
 * Usage in routes:
 * ```ts
 * {
 *   path: 'callback',
 *   resolve: { _: cognitoCallbackResolver },
 *   component: CallbackComponent
 * }
 * ```
 */
export const cognitoCallbackResolver: ResolveFn<void> = async (
  route: ActivatedRouteSnapshot
): Promise<void> => {
  const authService = inject(CognitoAuthService);

  const code = route.queryParamMap.get('code');
  const state = route.queryParamMap.get('state');

  if (!code) {
    throw new Error(
      '[ngx-cognito-auth] Callback route is missing the "code" query parameter. ' +
      'Ensure the /callback path matches the redirectUri configured in your Cognito App Client.'
    );
  }

  if (!state) {
    throw new Error(
      '[ngx-cognito-auth] Callback route is missing the "state" query parameter. ' +
      'This may indicate a broken OAuth flow or a misconfigured Cognito App Client.'
    );
  }

  console.debug('[ngx-cognito-auth] Handling OAuth callback with code and state:', { code, state });

  await authService.handleCallback(code, state);
};

/**
 * Class-based resolver wrapping `cognitoCallbackResolver` for NgModule-based apps.
 */
@Injectable()
export class CognitoCallbackResolver implements Resolve<void> {
  resolve(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Promise<void> {
    return cognitoCallbackResolver(
      route,
      _state
    ) as Promise<void>;
  }
}
