import { Component } from '@angular/core';

/**
 * The OAuth callback component.
 *
 * The `cognitoCallbackResolver` handles the actual token exchange before this
 * component is rendered, so this component just shows a loading indicator.
 * The resolver navigates to `postLoginRoute` on success, meaning users only
 * see this component briefly (or not at all on fast connections).
 */
@Component({
  standalone: true,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      gap: 1rem;
      color: var(--color-text-muted);

      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid var(--color-border);
        border-top-color: var(--color-accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      h2 {
        font-size: 1.1rem;
        font-weight: 500;
        margin: 0;
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
  template: `
    <div class="callback-container">
      <div class="spinner"></div>
      <h2>Anmeldung wird abgeschlossen…</h2>
    </div>
  `,
})
export class CallbackComponent {}
