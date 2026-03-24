import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CognitoAuthService } from 'ngx-cognito-auth';

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
  `,
})
export class AppComponent {
  protected readonly auth = inject(CognitoAuthService);
}
