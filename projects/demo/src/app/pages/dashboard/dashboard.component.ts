import { Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { CognitoAuthService } from 'ngx-cognito-auth';

@Component({
  standalone: true,
  imports: [JsonPipe],
  styles: [`
    h1 { margin-top: 0; color: var(--color-primary); }

    .welcome {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-left: 4px solid var(--color-success);
      border-radius: var(--radius);
      padding: 1rem 1.5rem;
      margin-bottom: 1.5rem;

      p { margin: 0; font-size: 0.95rem; }
      strong { color: var(--color-primary); }
    }

    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      margin-bottom: 1.5rem;
      overflow: hidden;

      .card-header {
        padding: 0.75rem 1.25rem;
        background: var(--color-primary);
        color: white;
        font-weight: 600;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .card-body {
        padding: 1.25rem;
      }
    }

    .token-display {
      margin: 0;
      font-size: 0.75rem;
      background: #1e1e2e;
      color: #cdd6f4;
    }

    .copy-btn {
      margin-top: 0.75rem;
      font-size: 0.8rem;
      padding: 0.3rem 0.8rem;
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);

      &:hover { background: var(--color-bg); }
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;

      button { min-width: 120px; }
    }

    .meta-grid {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.4rem 1.5rem;
      font-size: 0.9rem;

      .label {
        color: var(--color-text-muted);
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding-top: 0.1rem;
      }

      .value { word-break: break-all; }
    }
  `],
  template: `
    <h1>Dashboard</h1>

    <div class="welcome">
      <p>Willkommen, <strong>{{ auth.user()?.name ?? auth.user()?.email ?? 'Nutzer' }}</strong>!</p>
    </div>

    <!-- Bearer Token -->
    <div class="card">
      <div class="card-header">🔑 Bearer Token (Access Token)</div>
      <div class="card-body">
        <pre class="token-display">{{ auth.accessToken() }}</pre>
        <button class="copy-btn" (click)="copyToken()">
          {{ copied ? '✓ Kopiert' : 'In Zwischenablage kopieren' }}
        </button>
      </div>
    </div>

    <!-- User Info -->
    <div class="card">
      <div class="card-header">👤 Nutzerdaten (ID Token Claims)</div>
      <div class="card-body">
        <div class="meta-grid">
          <span class="label">Sub</span>
          <span class="value">{{ auth.user()?.sub }}</span>

          <span class="label">E-Mail</span>
          <span class="value">{{ auth.user()?.email }}</span>

          @if (auth.user()?.name) {
            <span class="label">Name</span>
            <span class="value">{{ auth.user()?.name }}</span>
          }

          @if (auth.user()?.given_name) {
            <span class="label">Vorname</span>
            <span class="value">{{ auth.user()?.given_name }}</span>
          }

          @if (auth.user()?.family_name) {
            <span class="label">Nachname</span>
            <span class="value">{{ auth.user()?.family_name }}</span>
          }
        </div>
      </div>
    </div>

    <!-- Raw Claims -->
    <div class="card">
      <div class="card-header">🧾 Alle Claims (raw JSON)</div>
      <div class="card-body">
        <pre>{{ auth.user() | json }}</pre>
      </div>
    </div>

    <div class="actions">
      <button class="btn-danger" (click)="auth.logout()">Logout</button>
    </div>
  `,
})
export class DashboardComponent {
  protected readonly auth = inject(CognitoAuthService);
  protected copied = false;

  copyToken(): void {
    const token = this.auth.getToken();
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}
