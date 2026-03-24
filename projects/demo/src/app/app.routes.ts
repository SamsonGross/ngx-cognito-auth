import { Routes } from '@angular/router';
import { cognitoAuthGuard, cognitoCallbackResolver } from 'ngx-cognito-auth';

export const routes: Routes = [
  {
    // Public landing page — no authentication required.
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    // OAuth 2.0 callback — the resolver exchanges the auth code for tokens
    // and navigates to postLoginRoute on success.
    path: 'callback',
    resolve: { _: cognitoCallbackResolver },
    loadComponent: () =>
      import('./pages/callback/callback.component').then(
        (m) => m.CallbackComponent
      ),
  },
  {
    // Private dashboard — protected by the auth guard.
    // Unauthenticated users are redirected to postLogoutRoute (configured as '/').
    path: 'dashboard',
    canActivate: [cognitoAuthGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    // Catch-all: redirect unknown paths back to the public home page.
    path: '**',
    redirectTo: '',
  },
];
