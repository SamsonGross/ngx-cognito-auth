import * as i0 from '@angular/core';
import { InjectionToken, Signal, EnvironmentProviders, ModuleWithProviders } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, CanActivateFn, Resolve, ResolveFn } from '@angular/router';
import { HttpInterceptorFn, HttpFeature, HttpFeatureKind } from '@angular/common/http';

interface CognitoAuthConfig {
    /** Cognito User Pool ID, e.g. "us-east-1_AbCdEfGhI" */
    userPoolId: string;
    /** App client ID (must have hosted UI enabled, no client secret) */
    clientId: string;
    /** Cognito hosted UI domain, e.g. "myapp.auth.us-east-1.amazoncognito.com" */
    domain: string;
    /** Full redirect URI registered in the app client */
    redirectUri: string;
    /** OAuth scopes, e.g. ["openid", "email", "profile"] */
    scopes: string[];
    /** Where to navigate after successful login. Default: "/dashboard" */
    postLoginRoute?: string;
    /** Where to navigate after logout. Default: "/" */
    postLogoutRoute?: string;
    /** Storage key prefix. Default: "cog_auth" */
    storageKeyPrefix?: string;
}

interface CognitoUser {
    /** Cognito unique user ID */
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    phone_number?: string;
    phone_number_verified?: boolean;
    preferred_username?: string;
    /** Raw decoded ID token claims (allows custom Cognito attributes) */
    [claim: string]: unknown;
}

declare const COGNITO_AUTH_CONFIG: InjectionToken<CognitoAuthConfig>;

declare class CognitoAuthService {
    private readonly config;
    private readonly router;
    private readonly http;
    private readonly prefix;
    private readonly _accessToken;
    private readonly _idToken;
    private readonly _refreshToken;
    /** Read-only signal for the raw access token (Bearer token). */
    readonly accessToken: Signal<string | null>;
    /** Read-only signal for the decoded ID token claims. */
    readonly user: Signal<CognitoUser | null>;
    /** True when a valid access token is present. */
    readonly isAuthenticated: Signal<boolean>;
    constructor();
    /**
     * Called on app initialization: reads persisted tokens from storage,
     * validates expiry, and refreshes silently if needed.
     */
    initialize(): Promise<void>;
    /**
     * Initiates the PKCE authorization code flow.
     * Stores verifier + state nonce and redirects to Cognito hosted UI.
     *
     * @param returnUrl Optional URL to redirect to after successful login.
     */
    login(returnUrl?: string): Promise<void>;
    /**
     * Processes the OAuth callback: validates state, exchanges code for tokens,
     * persists tokens, and navigates to the post-login route.
     *
     * @param code Authorization code from Cognito.
     * @param state State parameter returned by Cognito (CSRF protection).
     */
    handleCallback(code: string, state: string): Promise<void>;
    /**
     * Signs the user out locally and redirects to Cognito's global logout endpoint.
     */
    logout(): void;
    /** Returns the current access token (Bearer token) or null. */
    getToken(): string | null;
    /** Returns the decoded user object from the ID token or null. */
    getUser(): CognitoUser | null;
    /**
     * Silently refreshes the access and ID tokens using the stored refresh token.
     * Throws if no refresh token is available.
     */
    refreshTokens(): Promise<void>;
    private exchangeCodeForTokens;
    private storeTokens;
    private clearStorage;
    private storageKey;
    static ɵfac: i0.ɵɵFactoryDeclaration<CognitoAuthService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<CognitoAuthService>;
}

/**
 * Functional route guard that redirects unauthenticated users to the Cognito
 * hosted UI login page, preserving the requested URL as the post-login target.
 *
 * Usage in routes:
 * ```ts
 * { path: 'dashboard', canActivate: [cognitoAuthGuard], component: DashboardComponent }
 * ```
 */
declare const cognitoAuthGuard: CanActivateFn;
/**
 * Class-based guard wrapping `cognitoAuthGuard` for NgModule-based apps.
 *
 * Usage:
 * ```ts
 * { path: 'dashboard', canActivate: [CognitoAuthGuard], component: DashboardComponent }
 * ```
 */
declare class CognitoAuthGuard implements CanActivate {
    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean;
    static ɵfac: i0.ɵɵFactoryDeclaration<CognitoAuthGuard, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<CognitoAuthGuard>;
}

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
declare const cognitoCallbackResolver: ResolveFn<void>;
/**
 * Class-based resolver wrapping `cognitoCallbackResolver` for NgModule-based apps.
 */
declare class CognitoCallbackResolver implements Resolve<void> {
    resolve(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<CognitoCallbackResolver, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<CognitoCallbackResolver>;
}

/**
 * Functional HTTP interceptor that attaches a `Authorization: Bearer <token>`
 * header to every outgoing request when the user is authenticated.
 *
 * Requests to the Cognito token endpoint itself are skipped to prevent
 * infinite loops during the token exchange and silent refresh flows.
 *
 * Add this interceptor via `provideHttpClient(withCognitoInterceptor())`.
 */
declare const cognitoBearerInterceptor: HttpInterceptorFn;

/**
 * Returns the HTTP interceptor feature for Cognito Bearer token attachment.
 *
 * Pass this to `provideHttpClient()`:
 * ```ts
 * provideHttpClient(withCognitoInterceptor())
 * ```
 */
declare function withCognitoInterceptor(): HttpFeature<HttpFeatureKind.Interceptors>;
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
declare function provideCognitoAuth(config: CognitoAuthConfig): EnvironmentProviders;

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
declare class CognitoAuthModule {
    static forRoot(config: CognitoAuthConfig): ModuleWithProviders<CognitoAuthModule>;
    static ɵfac: i0.ɵɵFactoryDeclaration<CognitoAuthModule, never>;
    static ɵmod: i0.ɵɵNgModuleDeclaration<CognitoAuthModule, never, never, never>;
    static ɵinj: i0.ɵɵInjectorDeclaration<CognitoAuthModule>;
}

export { COGNITO_AUTH_CONFIG, CognitoAuthGuard, CognitoAuthModule, CognitoAuthService, CognitoCallbackResolver, cognitoAuthGuard, cognitoBearerInterceptor, cognitoCallbackResolver, provideCognitoAuth, withCognitoInterceptor };
export type { CognitoAuthConfig, CognitoUser };
//# sourceMappingURL=ngx-cognito-auth.d.ts.map
