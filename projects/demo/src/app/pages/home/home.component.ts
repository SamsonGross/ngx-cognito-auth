import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CognitoAuthService } from 'ngx-cognito-auth';

/**
 * Public landing page — accessible without authentication.
 *
 * Shows a brief introduction to the library and a "Sign in" button
 * that initiates the Cognito Hosted UI OAuth flow.
 * If the user is already authenticated, a shortcut to the dashboard is shown instead.
 */
@Component({
  standalone: true,
  imports: [RouterLink],
  styles: [`
    .hero {
      max-width: 600px;
      margin: 5rem auto 0;
      text-align: center;

      .icon {
        font-size: 3.5rem;
        margin-bottom: 1.25rem;
      }

      h1 {
        font-size: 2rem;
        color: var(--color-primary);
        margin: 0 0 0.75rem;
      }

      .subtitle {
        font-size: 1.05rem;
        color: var(--color-text-muted);
        margin: 0 0 2.5rem;
        line-height: 1.6;
      }
    }

    .cta-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;

      button, a.btn-primary {
        min-width: 200px;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
      }

      .hint {
        font-size: 0.8rem;
        color: var(--color-text-muted);
      }
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-top: 3rem;

      .feature {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        padding: 1.25rem 1rem;
        text-align: center;

        .feature-icon { font-size: 1.75rem; margin-bottom: 0.5rem; }
        .feature-title {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--color-primary);
          margin-bottom: 0.25rem;
        }
        .feature-desc {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          line-height: 1.4;
        }
      }
    }
  `],
  template: `
    <div class="hero">
      <div class="icon">🔐</div>
      <h1>ngx-cognito-auth</h1>
      <p class="subtitle">
        A lightweight Angular library for AWS Cognito authentication
        using the OAuth 2.0 Authorization Code flow with PKCE.
      </p>

      <div class="cta-group">
        <!-- Show dashboard link when already authenticated, login button otherwise -->
        @if (auth.isAuthenticated()) {
          <a class="btn-primary" routerLink="/dashboard">Go to Dashboard →</a>
          <span class="hint">You are already signed in.</span>
        } @else {
          <button (click)="login()">Sign in with Cognito</button>
          <span class="hint">
            You will be redirected to the AWS Cognito Hosted UI.
          </span>
        }
      </div>

      <!-- Feature highlights -->
      <div class="feature-grid">
        <div class="feature">
          <div class="feature-icon">🛡️</div>
          <div class="feature-title">PKCE Flow</div>
          <div class="feature-desc">Secure Authorization Code + PKCE — no client secret needed.</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🔄</div>
          <div class="feature-title">Token Refresh</div>
          <div class="feature-desc">Automatic silent refresh keeps sessions alive seamlessly.</div>
        </div>
        <div class="feature">
          <div class="feature-icon">⚡</div>
          <div class="feature-title">Signal-based</div>
          <div class="feature-desc">Reactive Angular signals for auth state and user claims.</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🔌</div>
          <div class="feature-title">HTTP Interceptor</div>
          <div class="feature-desc">Automatically attaches Bearer tokens to outgoing requests.</div>
        </div>
      </div>
    </div>
  `,
})
export class HomeComponent {
  protected readonly auth = inject(CognitoAuthService);

  /** Initiates the Cognito Hosted UI login redirect. */
  login(): void {
    this.auth.login();
  }
}
