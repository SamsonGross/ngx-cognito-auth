import * as i0 from '@angular/core';
import { InjectionToken, inject, signal, computed, Injectable, makeEnvironmentProviders, provideAppInitializer, NgModule } from '@angular/core';
import { HttpClient, HttpHeaders, withInterceptors } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

const COGNITO_AUTH_CONFIG = new InjectionToken('COGNITO_AUTH_CONFIG');

// ---------------------------------------------------------------------------
// PKCE helpers (module-level, tree-shakeable)
// ---------------------------------------------------------------------------
function base64UrlEncode(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array.buffer);
}
async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(digest);
}
function generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return base64UrlEncode(array.buffer);
}
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
        return JSON.parse(atob(padded));
    }
    catch {
        return null;
    }
}
function buildAuthorizeUrl(config, codeChallenge, state) {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });
    return `https://${config.domain}/oauth2/authorize?${params.toString()}`;
}
function buildLogoutUrl(config) {
    const params = new URLSearchParams({
        client_id: config.clientId,
        logout_uri: config.redirectUri.replace('/callback', config.postLogoutRoute ?? '/'),
    });
    return `https://${config.domain}/logout?${params.toString()}`;
}
// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
class CognitoAuthService {
    constructor() {
        this.config = inject(COGNITO_AUTH_CONFIG);
        this.router = inject(Router);
        this.http = inject(HttpClient);
        this._accessToken = signal(null, ...(ngDevMode ? [{ debugName: "_accessToken" }] : /* istanbul ignore next */ []));
        this._idToken = signal(null, ...(ngDevMode ? [{ debugName: "_idToken" }] : /* istanbul ignore next */ []));
        this._refreshToken = signal(null, ...(ngDevMode ? [{ debugName: "_refreshToken" }] : /* istanbul ignore next */ []));
        /** Read-only signal for the raw access token (Bearer token). */
        this.accessToken = this._accessToken.asReadonly();
        /** Read-only signal for the decoded ID token claims. */
        this.user = computed(() => {
            const token = this._idToken();
            return token ? decodeJwtPayload(token) : null;
        }, ...(ngDevMode ? [{ debugName: "user" }] : /* istanbul ignore next */ []));
        /** True when a valid access token is present. */
        this.isAuthenticated = computed(() => this._accessToken() !== null, ...(ngDevMode ? [{ debugName: "isAuthenticated" }] : /* istanbul ignore next */ []));
        this.prefix = this.config.storageKeyPrefix ?? 'cog_auth';
    }
    /**
     * Called on app initialization: reads persisted tokens from storage,
     * validates expiry, and refreshes silently if needed.
     */
    async initialize() {
        const access = sessionStorage.getItem(this.storageKey('access_token'));
        const id = sessionStorage.getItem(this.storageKey('id_token'));
        const refresh = localStorage.getItem(this.storageKey('refresh_token'));
        if (access && id) {
            const payload = decodeJwtPayload(access);
            const isExpired = payload?.exp != null
                ? Date.now() / 1000 > payload.exp
                : true;
            if (!isExpired) {
                this._accessToken.set(access);
                this._idToken.set(id);
                if (refresh)
                    this._refreshToken.set(refresh);
                return;
            }
        }
        if (refresh) {
            this._refreshToken.set(refresh);
            try {
                await this.refreshTokens();
            }
            catch {
                this.clearStorage();
            }
        }
    }
    /**
     * Initiates the PKCE authorization code flow.
     * Stores verifier + state nonce and redirects to Cognito hosted UI.
     *
     * @param returnUrl Optional URL to redirect to after successful login.
     */
    async login(returnUrl) {
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
    async handleCallback(code, state) {
        const storedState = sessionStorage.getItem(this.storageKey('pkce_state'));
        const verifier = sessionStorage.getItem(this.storageKey('pkce_verifier'));
        if (!verifier || !storedState) {
            throw new Error('[ngx-cognito-auth] Missing PKCE state. The login flow may have been interrupted.');
        }
        if (state !== storedState) {
            throw new Error('[ngx-cognito-auth] State parameter mismatch. Possible CSRF attack detected.');
        }
        const tokens = await this.exchangeCodeForTokens(code, verifier);
        this.storeTokens(tokens);
        sessionStorage.removeItem(this.storageKey('pkce_verifier'));
        sessionStorage.removeItem(this.storageKey('pkce_state'));
        const returnUrl = sessionStorage.getItem(this.storageKey('return_url'));
        sessionStorage.removeItem(this.storageKey('return_url'));
        const destination = returnUrl ?? this.config.postLoginRoute ?? '/dashboard';
        await this.router.navigateByUrl(destination);
    }
    /**
     * Signs the user out locally and redirects to Cognito's global logout endpoint.
     */
    logout() {
        this.clearStorage();
        this._accessToken.set(null);
        this._idToken.set(null);
        this._refreshToken.set(null);
        window.location.href = buildLogoutUrl(this.config);
    }
    /** Returns the current access token (Bearer token) or null. */
    getToken() {
        return this._accessToken();
    }
    /** Returns the decoded user object from the ID token or null. */
    getUser() {
        return this.user();
    }
    /**
     * Silently refreshes the access and ID tokens using the stored refresh token.
     * Throws if no refresh token is available.
     */
    async refreshTokens() {
        const refresh = this._refreshToken();
        if (!refresh) {
            throw new Error('[ngx-cognito-auth] No refresh token available for silent refresh.');
        }
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.config.clientId,
            refresh_token: refresh,
        });
        const tokens = await firstValueFrom(this.http.post(`https://${this.config.domain}/oauth2/token`, body.toString(), {
            headers: new HttpHeaders({
                'Content-Type': 'application/x-www-form-urlencoded',
            }),
        }));
        this._accessToken.set(tokens.access_token);
        this._idToken.set(tokens.id_token);
        sessionStorage.setItem(this.storageKey('access_token'), tokens.access_token);
        sessionStorage.setItem(this.storageKey('id_token'), tokens.id_token);
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    async exchangeCodeForTokens(code, verifier) {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            code,
            redirect_uri: this.config.redirectUri,
            code_verifier: verifier,
        });
        return firstValueFrom(this.http.post(`https://${this.config.domain}/oauth2/token`, body.toString(), {
            headers: new HttpHeaders({
                'Content-Type': 'application/x-www-form-urlencoded',
            }),
        }));
    }
    storeTokens(tokens) {
        this._accessToken.set(tokens.access_token);
        this._idToken.set(tokens.id_token);
        sessionStorage.setItem(this.storageKey('access_token'), tokens.access_token);
        sessionStorage.setItem(this.storageKey('id_token'), tokens.id_token);
        if (tokens.refresh_token) {
            this._refreshToken.set(tokens.refresh_token);
            localStorage.setItem(this.storageKey('refresh_token'), tokens.refresh_token);
        }
    }
    clearStorage() {
        ['access_token', 'id_token', 'pkce_verifier', 'pkce_state', 'return_url'].forEach((key) => sessionStorage.removeItem(this.storageKey(key)));
        localStorage.removeItem(this.storageKey('refresh_token'));
    }
    storageKey(name) {
        return `${this.prefix}_${name}`;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthService, deps: [], target: i0.ɵɵFactoryTarget.Injectable }); }
    static { this.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthService }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthService, decorators: [{
            type: Injectable
        }], ctorParameters: () => [] });

/**
 * Functional route guard that redirects unauthenticated users to the Cognito
 * hosted UI login page, preserving the requested URL as the post-login target.
 *
 * Usage in routes:
 * ```ts
 * { path: 'dashboard', canActivate: [cognitoAuthGuard], component: DashboardComponent }
 * ```
 */
const cognitoAuthGuard = (_route, state) => {
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
class CognitoAuthGuard {
    canActivate(route, state) {
        return cognitoAuthGuard(route, state);
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthGuard, deps: [], target: i0.ɵɵFactoryTarget.Injectable }); }
    static { this.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthGuard }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthGuard, decorators: [{
            type: Injectable
        }] });

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
const cognitoCallbackResolver = async (route) => {
    const authService = inject(CognitoAuthService);
    const code = route.queryParamMap.get('code');
    const state = route.queryParamMap.get('state') ?? '';
    if (!code) {
        throw new Error('[ngx-cognito-auth] Callback route is missing the "code" query parameter. ' +
            'Ensure the /callback path matches the redirectUri configured in your Cognito App Client.');
    }
    await authService.handleCallback(code, state);
};
/**
 * Class-based resolver wrapping `cognitoCallbackResolver` for NgModule-based apps.
 */
class CognitoCallbackResolver {
    resolve(route, _state) {
        return cognitoCallbackResolver(route, _state);
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoCallbackResolver, deps: [], target: i0.ɵɵFactoryTarget.Injectable }); }
    static { this.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoCallbackResolver }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoCallbackResolver, decorators: [{
            type: Injectable
        }] });

/**
 * Functional HTTP interceptor that attaches a `Authorization: Bearer <token>`
 * header to every outgoing request when the user is authenticated.
 *
 * Requests to the Cognito token endpoint itself are skipped to prevent
 * infinite loops during the token exchange and silent refresh flows.
 *
 * Add this interceptor via `provideHttpClient(withCognitoInterceptor())`.
 */
const cognitoBearerInterceptor = (req, next) => {
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
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/**
 * Returns the HTTP interceptor feature for Cognito Bearer token attachment.
 *
 * Pass this to `provideHttpClient()`:
 * ```ts
 * provideHttpClient(withCognitoInterceptor())
 * ```
 */
function withCognitoInterceptor() {
    return withInterceptors([cognitoBearerInterceptor]);
}
/**
 * Registers all ngx-cognito-auth providers for standalone Angular applications.
 *
 * Recommended usage in `app.config.ts`:
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideRouter(routes),
 *     provideHttpClient(withCognitoInterceptor()),
 *     provideCognitoAuth({
 *       userPoolId: 'us-east-1_XXXXXXXXX',
 *       clientId: 'YOUR_CLIENT_ID',
 *       domain: 'your-domain.auth.us-east-1.amazoncognito.com',
 *       redirectUri: 'http://localhost:4200/callback',
 *       scopes: ['openid', 'email', 'profile'],
 *     }),
 *   ],
 * };
 * ```
 */
function provideCognitoAuth(config) {
    return makeEnvironmentProviders([
        { provide: COGNITO_AUTH_CONFIG, useValue: config },
        CognitoAuthService,
        CognitoAuthGuard,
        CognitoCallbackResolver,
        provideAppInitializer(() => {
            const authService = inject(CognitoAuthService);
            return authService.initialize();
        }),
    ]);
}

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
class CognitoAuthModule {
    static forRoot(config) {
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
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthModule, deps: [], target: i0.ɵɵFactoryTarget.NgModule }); }
    static { this.ɵmod = i0.ɵɵngDeclareNgModule({ minVersion: "14.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthModule }); }
    static { this.ɵinj = i0.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthModule }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.5", ngImport: i0, type: CognitoAuthModule, decorators: [{
            type: NgModule,
            args: [{}]
        }] });

// Interfaces

/**
 * Generated bundle index. Do not edit.
 */

export { COGNITO_AUTH_CONFIG, CognitoAuthGuard, CognitoAuthModule, CognitoAuthService, CognitoCallbackResolver, cognitoAuthGuard, cognitoBearerInterceptor, cognitoCallbackResolver, provideCognitoAuth, withCognitoInterceptor };
//# sourceMappingURL=ngx-cognito-auth.mjs.map
