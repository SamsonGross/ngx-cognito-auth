import {
  Injectable,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CognitoAuthConfig } from '../interfaces/cognito-auth-config.interface';
import { CognitoUser } from '../interfaces/cognito-user.interface';
import { COGNITO_AUTH_CONFIG } from '../tokens/cognito-auth-config.token';

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

// ---------------------------------------------------------------------------
// PKCE helpers (module-level, tree-shakeable)
// ---------------------------------------------------------------------------

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    return JSON.parse(atob(padded)) as T;
  } catch {
    return null;
  }
}

function buildAuthorizeUrl(
  config: CognitoAuthConfig,
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: config.scopes.join(' '),
    redirect_uri: config.redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://${config.domain}/login?${params.toString()}`;
}

function buildLogoutUrl(config: CognitoAuthConfig): string {
  const base = new URL(config.redirectUri);
  const logoutUri = `${base.protocol}//${base.host}${config.postLogoutRoute ?? '/'}`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: logoutUri,
  });
  return `https://${config.domain}/logout?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CognitoAuthService {
  private readonly config = inject(COGNITO_AUTH_CONFIG);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  private readonly prefix: string;
  private readonly _accessToken = signal<string | null>(null);
  private readonly _idToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(null);

  /** In-flight refresh promise shared across all concurrent callers. */
  private _refreshPromise: Promise<void> | null = null;

  /** Read-only signal for the raw access token (Bearer token). */
  readonly accessToken: Signal<string | null> = this._accessToken.asReadonly();

  /** Read-only signal for the decoded ID token claims. */
  readonly user = computed<CognitoUser | null>(() => {
    const token = this._idToken();
    return token ? decodeJwtPayload<CognitoUser>(token) : null;
  });

  /**
   * True when the user has an active session.
   * Returns true if an access token is present, or if a refresh token is
   * available (the interceptor will refresh transparently on the next request).
   * Returns false only when both tokens are absent.
   */
  readonly isAuthenticated = computed(
    () => this._accessToken() !== null || this._refreshToken() !== null
  );

  constructor() {
    this.prefix = this.config.storageKeyPrefix ?? 'cog_auth';
  }

  /**
   * Called on app initialization: reads persisted tokens from storage,
   * validates expiry, and refreshes silently if needed.
   *
   * Races against a 5-second timeout so a slow or unreachable Cognito
   * endpoint never blocks Angular's bootstrap indefinitely. On timeout
   * the local session is cleared and the guard redirects to login.
   */
  async initialize(): Promise<void> {
    try {
      await Promise.race([
        this._runInitialize(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('[ngx-cognito-auth] Session restore timed out after 5 s.')),
            5_000
          )
        ),
      ]);
    } catch {
      this.clearStorage();
    }
  }

  private async _runInitialize(): Promise<void> {
    const access = sessionStorage.getItem(this.storageKey('access_token'));
    const id = sessionStorage.getItem(this.storageKey('id_token'));
    const refresh = localStorage.getItem(this.storageKey('refresh_token'));

    if (access && id) {
      const payload = decodeJwtPayload<{ exp: number }>(access);
      const isExpired = payload?.exp != null
        ? Date.now() / 1000 > payload.exp
        : true;

      if (!isExpired) {
        this._accessToken.set(access);
        this._idToken.set(id);
        if (refresh) this._refreshToken.set(refresh);
        return;
      }
    }

    if (refresh) {
      this._refreshToken.set(refresh);
      await this.refreshTokens();
    }
  }

  /**
   * Initiates the PKCE authorization code flow.
   * Stores verifier + state nonce and redirects to Cognito hosted UI.
   *
   * @param returnUrl Optional URL to redirect to after successful login.
   */
  async login(returnUrl?: string): Promise<void> {

    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateState();

    sessionStorage.setItem(this.storageKey('pkce_verifier'), verifier);
    sessionStorage.setItem(this.storageKey('pkce_state'), state);
    if (returnUrl) {
      sessionStorage.setItem(this.storageKey('return_url'), returnUrl);
    }

    window.location.href = buildAuthorizeUrl(this.config, challenge, state);
  }

  /**
   * Processes the OAuth callback: validates state, exchanges code for tokens,
   * persists tokens, and navigates to the post-login route.
   *
   * @param code Authorization code from Cognito.
   * @param state State parameter returned by Cognito (CSRF protection).
   */
  async handleCallback(code: string, state: string): Promise<void> {
    const storedState = sessionStorage.getItem(this.storageKey('pkce_state'));
    const verifier = sessionStorage.getItem(this.storageKey('pkce_verifier'));

    if (!verifier || !storedState) {
      throw new Error(
        '[ngx-cognito-auth] Missing PKCE state. The login flow may have been interrupted.'
      );
    }

    if (state !== storedState) {
      throw new Error(
        '[ngx-cognito-auth] State parameter mismatch. Possible CSRF attack detected.'
      );
    }

    // Always remove PKCE state — even if the token exchange fails — so that
    // a subsequent login attempt starts with a clean slate.
    try {
      const tokens = await this.exchangeCodeForTokens(code, verifier);
      this.storeTokens(tokens);
    } finally {
      sessionStorage.removeItem(this.storageKey('pkce_verifier'));
      sessionStorage.removeItem(this.storageKey('pkce_state'));
    }

    const returnUrl = sessionStorage.getItem(this.storageKey('return_url'));
    sessionStorage.removeItem(this.storageKey('return_url'));

    const destination = returnUrl ?? this.config.postLoginRoute ?? '/dashboard';
    await this.router.navigateByUrl(destination);
  }

  /**
   * Signs the user out locally and redirects to Cognito's global logout endpoint.
   */
  logout(): void {
    this.clearStorage();
    this._accessToken.set(null);
    this._idToken.set(null);
    this._refreshToken.set(null);

    window.location.href = buildLogoutUrl(this.config);
  }

  /** Returns the current access token (Bearer token) or null. */
  getToken(): string | null {
    return this._accessToken();
  }

  /** Returns the decoded user object from the ID token or null. */
  getUser(): CognitoUser | null {
    return this.user();
  }

  /**
   * Silently refreshes the access and ID tokens using the stored refresh token.
   * Concurrent calls are deduplicated — all callers share the same in-flight
   * request and receive the result once it resolves.
   * Throws if no refresh token is available.
   */
  refreshTokens(): Promise<void> {
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = this._executeRefresh().finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  }

  private async _executeRefresh(): Promise<void> {
    const refresh = this._refreshToken();
    if (!refresh) {
      throw new Error('[ngx-cognito-auth] No refresh token available for silent refresh.');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: refresh,
    });

    const tokens = await firstValueFrom(
      this.http.post<TokenResponse>(
        `https://${this.config.domain}/oauth2/token`,
        body.toString(),
        {
          headers: new HttpHeaders({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }
      )
    );

    this._accessToken.set(tokens.access_token);
    this._idToken.set(tokens.id_token);
    sessionStorage.setItem(this.storageKey('access_token'), tokens.access_token);
    sessionStorage.setItem(this.storageKey('id_token'), tokens.id_token);

    // Cognito may rotate the refresh token on each use — persist the new one if returned.
    if (tokens.refresh_token) {
      this._refreshToken.set(tokens.refresh_token);
      localStorage.setItem(this.storageKey('refresh_token'), tokens.refresh_token);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async exchangeCodeForTokens(
    code: string,
    verifier: string
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code,
      redirect_uri: this.config.redirectUri,
      code_verifier: verifier,
    });

    return firstValueFrom(
      this.http.post<TokenResponse>(
        `https://${this.config.domain}/oauth2/token`,
        body.toString(),
        {
          headers: new HttpHeaders({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }
      )
    );
  }

  private storeTokens(tokens: TokenResponse): void {
    this._accessToken.set(tokens.access_token);
    this._idToken.set(tokens.id_token);
    sessionStorage.setItem(this.storageKey('access_token'), tokens.access_token);
    sessionStorage.setItem(this.storageKey('id_token'), tokens.id_token);

    if (tokens.refresh_token) {
      this._refreshToken.set(tokens.refresh_token);
      localStorage.setItem(this.storageKey('refresh_token'), tokens.refresh_token);
    }
  }

  private clearStorage(): void {
    ['access_token', 'id_token', 'pkce_verifier', 'pkce_state', 'return_url'].forEach(
      (key) => sessionStorage.removeItem(this.storageKey(key))
    );
    localStorage.removeItem(this.storageKey('refresh_token'));
  }

  private storageKey(name: string): string {
    return `${this.prefix}_${name}`;
  }
}
