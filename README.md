# ngx-cognito-auth

Angular 21+ library for AWS Cognito authentication using the **OAuth 2.0 Authorization Code flow with PKCE**. No client secret required — safe for browser-based SPAs.

## Features

- PKCE-secured login flow (no client secret)
- Silent token refresh via refresh token
- Automatic Bearer token injection on every HTTP request
- Automatic pre-request token refresh when access token is expired
- Route guard that redirects unauthenticated users to Cognito
- Callback resolver that handles the OAuth redirect
- Angular Signals-based reactive state (`accessToken`, `user`, `isAuthenticated`)
- Token storage: access + ID token in `sessionStorage`, refresh token in `localStorage`

---

## Requirements

| Dependency        | Version     |
| ----------------- | ----------- |
| `@angular/core`   | `>= 21.0.0` |
| `@angular/common` | `>= 21.0.0` |
| `@angular/router` | `>= 21.0.0` |
| `rxjs`            | `>= 7.0.0`  |

---

## Installation

```bash
npm install ngx-cognito-auth
```

---

## AWS Cognito Setup

### 1. Create a User Pool

1. Open the [AWS Console](https://console.aws.amazon.com/cognito) and navigate to **Cognito → User Pools**
2. Click **Create user pool**
3. Configure sign-in options (e.g. email, username)
4. Under **Password policy**, choose your requirements
5. Under **Multi-factor authentication**, configure as needed
6. Under **User account recovery**, enable email recovery if desired
7. Complete the wizard and note down the **User Pool ID** (e.g. `eu-central-1_AbCdEfGhI`)

### 2. Create an App Client

1. Inside your User Pool, go to **App integration → App clients → Create app client**
2. Set **App client name** (e.g. `my-angular-app`)
3. **Client type**: select **Public client** — leave **Generate a client secret** unchecked (SPAs cannot safely store a secret)
4. Under **Authentication flows**, enable `ALLOW_USER_SRP_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH`
5. Note down the **Client ID**

### 3. Configure the Hosted UI

1. In **App integration**, go to your app client → **Hosted UI**
2. Under **Allowed callback URLs**, add your redirect URI, e.g.:
   - `http://localhost:4200/callback` (development)
   - `https://your-production-domain.com/callback` (production)
3. Under **Allowed sign-out URLs**, add:
   - `http://localhost:4200/` (development)
   - `https://your-production-domain.com/` (production)
4. Under **OAuth 2.0 grant types**, enable **Authorization code grant**
5. Under **OpenID Connect scopes**, select: `openid`, `email`, `profile`
6. Under **Domain**, either use a Cognito-managed domain or your own custom domain. Note the full domain, e.g.:
   `eu-central-1zfcbvs02q.auth.eu-central-1.amazoncognito.com`

> **Important:** The redirect URI registered in Cognito must exactly match the `redirectUri` in your Angular config, including protocol and path.

---

## Configuration

### Environment Variables (`.env`)

Create a `.env` file in the project root. This file is **not committed to version control** — add it to `.gitignore`.

```dotenv
COGNITO_USER_POOL_ID=eu-central-1_AbCdEfGhI
COGNITO_CLIENT_ID=47skdqidmdot9sj7i1d9kuo0c0
COGNITO_DOMAIN=eu-central-1abcdefghi.auth.eu-central-1.amazoncognito.com
COGNITO_REDIRECT_URI=http://localhost:4200/callback
```

The `scripts/set-env.js` script reads this file and writes `projects/demo/src/app/environments/environment.ts` automatically before every `npm start` and `npm run build:demo` (via `prestart` / `prebuild:demo` hooks).

Run it manually at any time:

```bash
node scripts/set-env.js
```

### `CognitoAuthConfig` Reference

| Field              | Type       | Required | Default        | Description                                                        |
| ------------------ | ---------- | -------- | -------------- | ------------------------------------------------------------------ |
| `userPoolId`       | `string`   | ✅       | —              | User Pool ID, e.g. `eu-central-1_AbCdEfGhI`                        |
| `clientId`         | `string`   | ✅       | —              | App client ID (no secret)                                          |
| `domain`           | `string`   | ✅       | —              | Hosted UI domain, e.g. `myapp.auth.eu-central-1.amazoncognito.com` |
| `redirectUri`      | `string`   | ✅       | —              | Full callback URI registered in Cognito                            |
| `scopes`           | `string[]` | ✅       | —              | OAuth scopes, e.g. `['openid', 'email', 'profile']`                |
| `postLoginRoute`   | `string`   | —        | `'/dashboard'` | App route to navigate to after login                               |
| `postLogoutRoute`  | `string`   | —        | `'/'`          | App route for Cognito's `logout_uri` after logout                  |
| `storageKeyPrefix` | `string`   | —        | `'cog_auth'`   | Prefix for all `sessionStorage` / `localStorage` keys              |

---

## Setup

### Standalone App (`app.config.ts`)

```typescript
import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient } from "@angular/common/http";
import { provideCognitoAuth, withCognitoInterceptor } from "ngx-cognito-auth";
import { routes } from "./app.routes";
import { environment } from "./environments/environment";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withCognitoInterceptor()), // registers the Bearer interceptor
    provideCognitoAuth(environment.cognito), // registers service, guard, resolver + initializer
  ],
};
```

### NgModule App (`app.module.ts`)

```typescript
import { NgModule } from "@angular/core";
import { HttpClientModule } from "@angular/common/http";
import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { CognitoAuthModule, cognitoBearerInterceptor } from "ngx-cognito-auth";
import { environment } from "../environments/environment";

@NgModule({
  imports: [HttpClientModule, CognitoAuthModule.forRoot(environment.cognito)],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useValue: cognitoBearerInterceptor,
      multi: true,
    },
  ],
})
export class AppModule {}
```

---

## Routing

### Protect routes with the guard

```typescript
// app.routes.ts
import { Routes } from "@angular/router";
import { cognitoAuthGuard, cognitoCallbackResolver } from "ngx-cognito-auth";

export const routes: Routes = [
  {
    path: "callback",
    component: CallbackComponent,
    resolve: { auth: cognitoCallbackResolver }, // handles the OAuth redirect
  },
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [cognitoAuthGuard], // redirects to Cognito if not authenticated
  },
  {
    path: "**",
    redirectTo: "dashboard",
  },
];
```

### Callback component

The resolver handles everything — the component itself needs no logic:

```typescript
@Component({
  standalone: true,
  template: `<p>Signing in…</p>`,
})
export class CallbackComponent {}
```

---

## Using `CognitoAuthService`

Inject the service anywhere in your app:

```typescript
import { Component, inject } from '@angular/core';
import { CognitoAuthService } from 'ngx-cognito-auth';

@Component({ ... })
export class MyComponent {
  private readonly auth = inject(CognitoAuthService);
}
```

### Signals

| Signal                   | Type                  | Description                                                                          |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------ |
| `auth.accessToken()`     | `string \| null`      | Raw JWT access token (Bearer value)                                                  |
| `auth.user()`            | `CognitoUser \| null` | Decoded ID token claims                                                              |
| `auth.isAuthenticated()` | `boolean`             | `true` when an access token or refresh token is present (user has an active session) |

```html
@if (auth.isAuthenticated()) {
<p>Welcome, {{ auth.user()?.name }}!</p>
} @else {
<button (click)="auth.login()">Sign in</button>
}
```

### Methods

#### `login(returnUrl?: string): Promise<void>`

Redirects to the Cognito hosted UI. Optionally pass a `returnUrl` to redirect back after login.

```typescript
await this.auth.login("/dashboard");
```

#### `logout(): void`

Clears local tokens and redirects to Cognito's global logout endpoint.

```typescript
this.auth.logout();
```

#### `getToken(): string | null`

Returns the current raw access token synchronously.

```typescript
const bearer = this.auth.getToken();
```

#### `getUser(): CognitoUser | null`

Returns the decoded ID token claims synchronously.

```typescript
const user = this.auth.getUser();
```

#### `refreshTokens(): Promise<void>`

Silently refreshes the access and ID tokens using the stored refresh token. Throws if no refresh token is available.

```typescript
try {
  await this.auth.refreshTokens();
} catch (e) {
  // refresh token expired or missing — re-login required
  this.auth.login();
}
```

### `CognitoUser` interface

| Claim                | Type      | Description                    |
| -------------------- | --------- | ------------------------------ |
| `sub`                | `string`  | Unique user identifier         |
| `email`              | `string`  | Email address                  |
| `email_verified`     | `boolean` | Whether the email was verified |
| `name`               | `string`  | Full name                      |
| `given_name`         | `string`  | First name                     |
| `family_name`        | `string`  | Last name                      |
| `picture`            | `string`  | Profile picture URL            |
| `phone_number`       | `string`  | Phone number                   |
| `preferred_username` | `string`  | Preferred username             |
| `[claim: string]`    | `unknown` | Any custom Cognito attribute   |

---

## HTTP Interceptor

`withCognitoInterceptor()` registers a functional interceptor that:

1. Skips the Cognito `/oauth2/` token endpoint (to prevent loops)
2. Skips requests that set `SKIP_COGNITO_BEARER` in their context
3. Attaches `Authorization: Bearer <token>` to all other requests
4. **Automatically refreshes an expired token before the request** — no manual handling required

### Skip Bearer injection for a specific request

```typescript
import { HttpContext } from "@angular/common/http";
import { SKIP_COGNITO_BEARER } from "ngx-cognito-auth";

this.http.get("/api/public", {
  context: new HttpContext().set(SKIP_COGNITO_BEARER, true),
});
```

---

## Token Storage

The library uses no cookies. All state is stored in the browser's Web Storage APIs.

The storage key prefix defaults to `cog_auth` and is configurable via `storageKeyPrefix` in `CognitoAuthConfig`.

### `sessionStorage` keys

Cleared automatically when the browser tab or window is closed.

| Key                      | Content                               | Set when                       | Cleared when          |
| ------------------------ | ------------------------------------- | ------------------------------ | --------------------- |
| `{prefix}_access_token`  | Raw JWT access token (Bearer value)   | Login callback / token refresh | Tab closes · Logout   |
| `{prefix}_id_token`      | Raw JWT ID token (user claims)        | Login callback / token refresh | Tab closes · Logout   |
| `{prefix}_pkce_verifier` | Code verifier for auth flow (32-byte) | `login()` is called            | Callback is processed |
| `{prefix}_pkce_state`    | OAuth state nonce (CSRF protection)   | `login()` is called            | Callback is processed |
| `{prefix}_return_url`    | App URL to redirect to after login    | `login(returnUrl)` is called   | Callback is processed |

### `localStorage` keys

Persists across tabs and browser restarts.

| Key                      | Content               | Set when                   | Cleared when |
| ------------------------ | --------------------- | -------------------------- | ------------ |
| `{prefix}_refresh_token` | Cognito refresh token | Login callback (if issued) | Logout       |

### Notes

- **`sessionStorage`** is tab-scoped — opening the app in a new tab requires a silent refresh (handled automatically by `initialize()`)
- **`localStorage`** is shared across all tabs of the same origin — the refresh token enables silent re-authentication on the next visit without a full login redirect
- The access and ID tokens are JWTs and can be decoded client-side; they contain the claims listed in the `CognitoUser` interface
- The refresh token is opaque — it cannot be decoded and is only valid against the Cognito token endpoint

---

## Development

```bash
# Install dependencies
npm install

# Copy .env.example to .env and fill in your Cognito values
cp .env.example .env

# Start the demo app (automatically runs set-env.js first)
npm start

# Build the library
npm run build:lib

# Build the demo app
npm run build:demo

# Run tests
npm test
```

---

## License

MIT
