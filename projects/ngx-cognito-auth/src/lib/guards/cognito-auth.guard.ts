import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateFn,
  RouterStateSnapshot,
} from '@angular/router';
import { CognitoAuthService } from '../services/cognito-auth.service';

/**
 * Functional route guard that redirects unauthenticated users to the Cognito
 * hosted UI login page, preserving the requested URL as the post-login target.
 *
 * Usage in routes:
 * ```ts
 * { path: 'dashboard', canActivate: [cognitoAuthGuard], component: DashboardComponent }
 * ```
 */
export const cognitoAuthGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => {
  const authService = inject(CognitoAuthService);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Preserve the requested URL so the user lands there after login
  authService.login(state.url);
  return false;
};

/**
 * Class-based guard wrapping `cognitoAuthGuard` for NgModule-based apps.
 *
 * Usage:
 * ```ts
 * { path: 'dashboard', canActivate: [CognitoAuthGuard], component: DashboardComponent }
 * ```
 */
@Injectable()
export class CognitoAuthGuard implements CanActivate {
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    return cognitoAuthGuard(route, state) as boolean;
  }
}
