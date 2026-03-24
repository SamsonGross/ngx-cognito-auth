import { Component, inject } from '@angular/core';
import { CognitoAuthService } from 'ngx-cognito-auth';

@Component({
  standalone: true,
  styles: [`
    .login-card {
      max-width: 420px;
      margin: 4rem auto;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 2.5rem;
      text-align: center;

      .logo {
        font-size: 3rem;
        margin-bottom: 1rem;
      }

      h1 {
        margin: 0 0 0.5rem;
        font-size: 1.6rem;
        color: var(--color-primary);
      }

      p {
        color: var(--color-text-muted);
        margin: 0 0 2rem;
        font-size: 0.95rem;
      }

      button {
        width: 100%;
        padding: 0.75rem;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      .info {
        margin-top: 1.5rem;
        font-size: 0.8rem;
        color: var(--color-text-muted);
        line-height: 1.5;
      }
    }
  `],
  template: `
    <div class="login-card">
      <div class="logo">🔐</div>
      <h1>Anmelden</h1>
      <p>Melde dich mit deinem AWS Cognito Account an.</p>

      <button (click)="login()">
        Mit Cognito anmelden
      </button>

      <p class="info">
        Du wirst zum AWS Cognito Hosted UI weitergeleitet.<br />
        Nach der Anmeldung kehrst du automatisch zurück.
      </p>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(CognitoAuthService);

  login(): void {
    this.auth.login();
  }
}
