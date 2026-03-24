import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CognitoAuthService } from 'ngx-cognito-auth';
import { environment } from './environments/environment';

/**
 * Root application shell.
 *
 * Renders a top navigation bar that adapts to the current auth state:
 * - Unauthenticated: shows a "Sign in" link pointing to the public home page.
 * - Authenticated: shows a "Signed in" badge, a Dashboard link, and a Logout button.
 *
 * The <router-outlet> below the nav hosts all routed page components.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  styles: [`
    /* ── Config popup ─────────────────────────────────────────── */
    .config-fab {
      position: fixed;
      bottom: 1.25rem;
      right: 1.25rem;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
    }

    .config-toggle {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 50%;
      background: var(--color-primary);
      color: var(--color-accent);
      border: none;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      padding: 0;
      cursor: pointer;
      transition: opacity 0.15s;

      &:hover { opacity: 0.85; }
    }

    .config-panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      width: 340px;
      overflow: hidden;
      animation: slide-up 0.15s ease;
    }

    @keyframes slide-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .config-header {
      background: var(--color-primary);
      color: white;
      padding: 0.6rem 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .config-body {
      padding: 0.75rem 1rem;
    }

    .config-row {
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 0.25rem 0.75rem;
      padding: 0.35rem 0;
      border-bottom: 1px solid var(--color-border);
      font-size: 0.8rem;

      &:last-child { border-bottom: none; }
    }

    .config-key {
      color: var(--color-text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 0.72rem;
      padding-top: 0.1rem;
    }

    .config-value {
      color: var(--color-text);
      word-break: break-all;
      font-family: 'Courier New', monospace;
      font-size: 0.78rem;
    }

    /* ── Nav ──────────────────────────────────────────────────── */
    nav {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1.5rem;
      background: var(--color-primary);
      color: white;
      box-shadow: var(--shadow);

      .brand {
        font-weight: 700;
        font-size: 1.1rem;
        color: var(--color-accent);
        margin-right: auto;
        text-decoration: none;
      }

      a {
        color: rgba(255,255,255,0.85);
        font-size: 0.9rem;

        &:hover { color: white; text-decoration: none; }
      }

      /* Small pill shown when the user is authenticated */
      .badge {
        background: var(--color-success);
        color: white;
        font-size: 0.7rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-weight: 600;
      }
    }

    main {
      max-width: 900px;
      margin: 2rem auto;
      padding: 0 1.5rem;
    }
  `],
  template: `
    <nav>
      <!-- Brand link always navigates to the public home page -->
      <a class="brand" routerLink="/">ngx-cognito-auth</a>

      @if (auth.isAuthenticated()) {
        <!-- Authenticated state: badge + dashboard link + logout -->
        <span class="badge">Signed in</span>
        <a routerLink="/dashboard">Dashboard</a>
        <button class="btn-secondary" (click)="auth.logout()">Sign out</button>
      } @else {
        <!-- Unauthenticated state: link back to the public home / sign-in page -->
        <a routerLink="/">Sign in</a>
      }
    </nav>

    <main>
      <router-outlet />
    </main>

    <!-- Config popup (bottom-right) -->
    <div class="config-fab">
      @if (configOpen()) {
        <div class="config-panel">
          <div class="config-header">⚙️ Active Configuration</div>
          <div class="config-body">
            <div class="config-row">
              <span class="config-key">User Pool ID</span>
              <span class="config-value">{{ cfg.userPoolId }}</span>
            </div>
            <div class="config-row">
              <span class="config-key">Client ID</span>
              <span class="config-value">{{ cfg.clientId }}</span>
            </div>
            <div class="config-row">
              <span class="config-key">Domain</span>
              <span class="config-value">{{ cfg.domain }}</span>
            </div>
            <div class="config-row">
              <span class="config-key">Redirect URI</span>
              <span class="config-value">{{ cfg.redirectUri }}</span>
            </div>
            <div class="config-row">
              <span class="config-key">Scopes</span>
              <span class="config-value">{{ cfg.scopes.join(', ') }}</span>
            </div>
            <div class="config-row">
              <span class="config-key">Post-login Route</span>
              <span class="config-value">{{ cfg.postLoginRoute }}</span>
            </div>
            <div class="config-row">
              <span class="config-key">Post-logout Route</span>
              <span class="config-value">{{ cfg.postLogoutRoute }}</span>
            </div>
            <div class="config-row">
              <span class="config-key">Storage Prefix</span>
              <span class="config-value">{{ cfg.storageKeyPrefix }}</span>
            </div>
          </div>
        </div>
      }
      <button class="config-toggle" (click)="configOpen.set(!configOpen())" title="Toggle configuration">
        {{ configOpen() ? '✕' : '⚙️' }}
      </button>
    </div>
  `,
})
export class AppComponent {
  protected readonly auth = inject(CognitoAuthService);
  protected readonly cfg = environment.cognito;
  protected readonly configOpen = signal(false);
}
