# ngx-cognito-auth

[![npm version](https://img.shields.io/npm/v/ngx-cognito-auth.svg)](https://www.npmjs.com/package/ngx-cognito-auth)
[![npm downloads](https://img.shields.io/npm/dm/ngx-cognito-auth.svg)](https://www.npmjs.com/package/ngx-cognito-auth)
[![license](https://img.shields.io/npm/l/ngx-cognito-auth.svg)](https://github.com/SamsonGross/ngx-cognito-auth/blob/main/LICENSE)

Angular library for AWS Cognito authentication using the OAuth 2.0 Authorization Code flow with PKCE.

- Zero AWS SDK dependency — communicates directly with the Cognito hosted UI and token endpoint
- Works with standalone Angular apps (`provideHttpClient`) and classic NgModule apps
- Signals-based reactive state (`isAuthenticated`, `user`, `accessToken`)
- Automatic silent token refresh with deduplication of concurrent calls
- HTTP interceptor with pre-emptive and reactive 401 handling

**Requires Angular 21+**

---

## Installation

```bash
npm install ngx-cognito-auth
```

---

## Setup

### 1. Configure the Cognito App Client

In the AWS Console, make sure your App Client has:

- Hosted UI enabled
- No client secret (public client)
- Your redirect URI added under **Allowed callback URLs**
- Your logout URI added under **Allowed sign-out URLs**

### 2. Register providers (standalone app)

In `app.config.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideCognitoAuth, withCognitoInterceptor } from 'ngx-cognito-auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withCognitoInterceptor()),
    provideCognitoAuth({
      userPoolId:  'us-east-1_XXXXXXXXX',
      clientId:    'YOUR_CLIENT_ID',
      domain:      'your-domain.auth.us-east-1.amazoncognito.com',
      redirectUri: 'https://yourapp.com/callback',
      scopes:      ['openid', 'email', 'profile'],
    }),
  ],
};
```

### 3. Register providers (NgModule app)

```ts
import { CognitoAuthModule } from 'ngx-cognito-auth';

@NgModule({
  imports: [
    CognitoAuthModule.forRoot({
      userPoolId:  'us-east-1_XXXXXXXXX',
      clientId:    'YOUR_CLIENT_ID',
      domain:      'your-domain.auth.us-east-1.amazoncognito.com',
      redirectUri: 'https://yourapp.com/callback',
      scopes:      ['openid', 'email', 'profile'],
    }),
  ],
})
export class AppModule {}
```

### 4. Add the callback route

```ts
import { CognitoCallbackResolver } from 'ngx-cognito-auth';

export const routes: Routes = [
  {
    path: 'callback',
    resolve: { auth: CognitoCallbackResolver },
    component: CallbackComponent, // or any placeholder component
  },
];
```

### 5. Protect routes

```ts
import { cognitoAuthGuard } from 'ngx-cognito-auth';

{ path: 'dashboard', canActivate: [cognitoAuthGuard], component: DashboardComponent }
```

---

## Configuration

| Option | Type | Required | Description |
|---|---|---|---|
| `userPoolId` | `string` | yes | Cognito User Pool ID, e.g. `us-east-1_AbCdEfGhI` |
| `clientId` | `string` | yes | App Client ID (no client secret) |
| `domain` | `string` | yes | Cognito hosted UI domain, e.g. `myapp.auth.us-east-1.amazoncognito.com` |
| `redirectUri` | `string` | yes | Full callback URI registered in the App Client |
| `scopes` | `string[]` | yes | OAuth scopes, e.g. `['openid', 'email', 'profile']` |
| `postLoginRoute` | `string` | no | Route to navigate to after login. Default: `/dashboard` |
| `postLogoutRoute` | `string` | no | Route to navigate to after logout. Default: `/` |
| `storageKeyPrefix` | `string` | no | Prefix for storage keys. Default: `cog_auth` |

---

## API

### `CognitoAuthService`

Inject this service wherever you need to interact with the auth state.

```ts
import { CognitoAuthService } from 'ngx-cognito-auth';

@Component({ ... })
export class AppComponent {
  private auth = inject(CognitoAuthService);

  isLoggedIn = this.auth.isAuthenticated; // Signal<boolean>
  user        = this.auth.user;           // Signal<CognitoUser | null>
  token       = this.auth.accessToken;    // Signal<string | null>

  login()  { this.auth.login(); }
  logout() { this.auth.logout(); }
}
```

#### Signals

| Signal | Type | Description |
|---|---|---|
| `isAuthenticated` | `Signal<boolean>` | `true` if an access or refresh token is present |
| `user` | `Signal<CognitoUser \| null>` | Decoded ID token claims |
| `accessToken` | `Signal<string \| null>` | Raw Bearer token |

#### Methods

| Method | Description |
|---|---|
| `login(returnUrl?)` | Starts the PKCE flow and redirects to Cognito |
| `logout()` | Clears local state and redirects to Cognito global logout |
| `refreshTokens()` | Silently refreshes tokens; concurrent calls are deduplicated |
| `getToken()` | Returns the current access token or `null` |
| `getUser()` | Returns the decoded `CognitoUser` or `null` |

### `cognitoAuthGuard` / `CognitoAuthGuard`

Redirects unauthenticated users to login, preserving the requested URL as the post-login target.

```ts
// Functional (standalone apps)
{ path: 'secure', canActivate: [cognitoAuthGuard], component: SecureComponent }

// Class-based (NgModule apps)
{ path: 'secure', canActivate: [CognitoAuthGuard], component: SecureComponent }
```

### `cognitoBearerInterceptor` / `withCognitoInterceptor()`

Automatically attaches `Authorization: Bearer <token>` to outgoing HTTP requests.

- Skips requests to Cognito's own `/oauth2/` endpoint
- Performs a pre-emptive refresh if the local token is expired before sending
- Retries once after a server-side 401
- Redirects to login if the refresh itself fails

To skip token injection for a specific request:

```ts
import { SKIP_COGNITO_BEARER } from 'ngx-cognito-auth';

this.http.get('/api/public', {
  context: new HttpContext().set(SKIP_COGNITO_BEARER, true),
});
```

---

## Token Storage

| Token | Storage | Notes |
|---|---|---|
| Access token | `sessionStorage` | Cleared on tab close |
| ID token | `sessionStorage` | Cleared on tab close |
| Refresh token | `localStorage` | Persists across sessions |

Storage keys use the `storageKeyPrefix` option as prefix (default: `cog_auth`).

---

## License

MIT
