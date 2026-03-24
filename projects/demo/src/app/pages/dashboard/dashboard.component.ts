import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CognitoAuthService, SKIP_COGNITO_BEARER } from 'ngx-cognito-auth';

interface ApiResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  isJson: boolean;
  durationMs: number;
}

@Component({
  standalone: true,
  imports: [JsonPipe, FormsModule],
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

    .expiry-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .countdown {
      font-size: 1.6rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;

      &.warning { color: #f59e0b; }
      &.danger  { color: #ef4444; }
      &.ok      { color: var(--color-success); }
      &.expired { color: #ef4444; font-size: 1rem; }
    }

    .expiry-abs {
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }

    .refresh-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .refresh-status {
      font-size: 0.85rem;
      padding: 0.3rem 0.75rem;
      border-radius: var(--radius);

      &.success {
        background: color-mix(in srgb, var(--color-success) 15%, transparent);
        color: var(--color-success);
        border: 1px solid color-mix(in srgb, var(--color-success) 40%, transparent);
      }

      &.error {
        background: color-mix(in srgb, #ef4444 15%, transparent);
        color: #ef4444;
        border: 1px solid color-mix(in srgb, #ef4444 40%, transparent);
      }
    }

    .api-tester {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      .api-url-row {
        display: flex;
        gap: 0.5rem;
        align-items: stretch;

        select {
          padding: 0.45rem 0.6rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          color: var(--color-text);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }

        input[type="url"], input[type="text"] {
          flex: 1;
          padding: 0.45rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          color: var(--color-text);
          font-size: 0.85rem;
          font-family: monospace;

          &:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
        }
      }

      .api-options {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        font-size: 0.875rem;
        flex-wrap: wrap;

        label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          cursor: pointer;
          user-select: none;
        }
      }

      textarea {
        width: 100%;
        min-height: 80px;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.8rem;
        font-family: monospace;
        resize: vertical;
        box-sizing: border-box;

        &:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
      }
    }

    .api-response {
      margin-top: 0.25rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      overflow: hidden;

      .api-response-meta {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.5rem 1rem;
        background: var(--color-bg);
        border-bottom: 1px solid var(--color-border);
        font-size: 0.8rem;

        .status-badge {
          font-weight: 700;
          font-size: 0.85rem;
          padding: 0.1rem 0.5rem;
          border-radius: 4px;

          &.ok   { background: color-mix(in srgb, var(--color-success) 20%, transparent); color: var(--color-success); }
          &.warn { background: color-mix(in srgb, #f59e0b 20%, transparent); color: #d97706; }
          &.err  { background: color-mix(in srgb, #ef4444 20%, transparent); color: #ef4444; }
        }

        .duration { color: var(--color-text-muted); }
      }

      pre.api-response-body {
        margin: 0;
        padding: 1rem;
        font-size: 0.75rem;
        background: #1e1e2e;
        color: #cdd6f4;
        overflow-x: auto;
        max-height: 400px;
        overflow-y: auto;
      }
    }
  `],
  template: `
    <h1>Dashboard</h1>

    <div class="welcome">
      <p>Willkommen, <strong>{{ auth.user()?.name ?? auth.user()?.email ?? 'Nutzer' }}</strong>!</p>
    </div>

    <!-- Token Expiry Timer -->
    <div class="card">
      <div class="card-header">⏱ Token-Ablauf</div>
      <div class="card-body">
        <div class="expiry-row">
          @if (tokenExpired()) {
            <span class="countdown expired">Token abgelaufen</span>
          } @else if (countdownText()) {
            <span class="countdown" [class]="countdownClass()">{{ countdownText() }}</span>
            <span class="expiry-abs">Ablauf: {{ expiryDateText() }}</span>
          } @else {
            <span class="expiry-abs">Kein Token vorhanden</span>
          }
        </div>
      </div>
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

    <!-- Debug: Token Refresh -->
    <div class="card">
      <div class="card-header">🛠 Debug: Token Refresh</div>
      <div class="card-body">
        <div class="refresh-row">
          <button (click)="triggerRefresh()" [disabled]="refreshing()">
            {{ refreshing() ? 'Wird verlängert…' : 'Token jetzt verlängern' }}
          </button>
          @if (refreshStatus() === 'success') {
            <span class="refresh-status success">✓ Token erfolgreich verlängert</span>
          } @else if (refreshStatus() === 'error') {
            <span class="refresh-status error">✗ Fehler: {{ refreshError() }}</span>
          }
        </div>
      </div>
    </div>

    <!-- Debug: API Request Tester -->
    <div class="card">
      <div class="card-header">🌐 Debug: API Request</div>
      <div class="card-body">
        <div class="api-tester">
          <div class="api-url-row">
            <select [(ngModel)]="apiMethod">
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <input type="text" [(ngModel)]="apiUrl" placeholder="https://api.example.com/endpoint" />
            <button (click)="sendRequest()" [disabled]="apiLoading() || !apiUrl.trim()">
              {{ apiLoading() ? 'Lädt…' : 'Senden' }}
            </button>
          </div>

          <div class="api-options">
            <label>
              <input type="checkbox" [(ngModel)]="apiUseBearer" />
              Authorization: Bearer Token senden
            </label>
          </div>

          @if (apiMethod === 'POST') {
            <textarea [(ngModel)]="apiBody" placeholder='Request Body (JSON), z.B. {"key": "value"}'></textarea>
          }

          @if (apiResult()) {
            <div class="api-response">
              <div class="api-response-meta">
                <span class="status-badge" [class]="apiStatusClass()">
                  {{ apiResult()!.status }}
                </span>
                <span class="duration">{{ apiResult()!.durationMs }} ms</span>
                @if (apiResult()!.headers['content-type']) {
                  <span class="duration">{{ apiResult()!.headers['content-type'] }}</span>
                }
              </div>
              <pre class="api-response-body">{{ apiResult()!.body }}</pre>
            </div>
          }

          @if (apiError()) {
            <div class="refresh-status error">✗ {{ apiError() }}</div>
          }
        </div>
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
export class DashboardComponent implements OnDestroy {
  protected readonly auth = inject(CognitoAuthService);
  protected copied = false;

  // --- Token expiry timer ---
  private readonly _now = signal(Date.now());
  private readonly _intervalId: ReturnType<typeof setInterval>;

  private readonly tokenExp = computed<number | null>(() => {
    const token = this.auth.accessToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload['exp'] === 'number' ? payload['exp'] * 1000 : null;
    } catch {
      return null;
    }
  });

  protected readonly tokenExpired = computed(() => {
    const exp = this.tokenExp();
    return exp !== null && this._now() >= exp;
  });

  protected readonly countdownText = computed<string | null>(() => {
    const exp = this.tokenExp();
    if (exp === null) return null;
    const diff = Math.max(0, exp - this._now());
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  });

  protected readonly countdownClass = computed<string>(() => {
    const exp = this.tokenExp();
    if (exp === null) return '';
    const diff = exp - this._now();
    if (diff < 60_000) return 'danger';
    if (diff < 300_000) return 'warning';
    return 'ok';
  });

  protected readonly expiryDateText = computed<string>(() => {
    const exp = this.tokenExp();
    if (exp === null) return '';
    return new Date(exp).toLocaleString('de-DE');
  });

  // --- API Tester ---
  private readonly http = inject(HttpClient);

  protected apiMethod: 'GET' | 'POST' = 'GET';
  protected apiUrl = '';
  protected apiBody = '';
  protected apiUseBearer = true;

  protected readonly apiLoading = signal(false);
  protected readonly apiResult = signal<ApiResult | null>(null);
  protected readonly apiError = signal<string>('');

  protected readonly apiStatusClass = computed(() => {
    const s = this.apiResult()?.status ?? 0;
    if (s >= 200 && s < 300) return 'ok';
    if (s >= 300 && s < 500) return 'warn';
    return 'err';
  });

  async sendRequest(): Promise<void> {
    const url = this.apiUrl.trim();
    if (!url) return;

    this.apiLoading.set(true);
    this.apiResult.set(null);
    this.apiError.set('');

    const context = this.apiUseBearer
      ? new HttpContext()
      : new HttpContext().set(SKIP_COGNITO_BEARER, true);

    const options = {
      observe: 'response' as const,
      responseType: 'text' as const,
      context,
      headers: this.apiMethod === 'POST'
        ? new HttpHeaders({ 'Content-Type': 'application/json' })
        : new HttpHeaders(),
    };

    const t0 = performance.now();
    try {
      const req = this.apiMethod === 'POST'
        ? this.http.post(url, this.apiBody || null, options)
        : this.http.get(url, options);
      const res = await firstValueFrom(req);

      const raw = res.body ?? '';
      let body = raw;
      let isJson = false;
      try { body = JSON.stringify(JSON.parse(raw), null, 2); isJson = true; } catch { /* raw */ }

      const headers: Record<string, string> = {};
      res.headers.keys().forEach(k => { headers[k] = res.headers.get(k) ?? ''; });

      this.apiResult.set({
        status: res.status,

        headers,
        body,
        isJson,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (err: unknown) {
      const httpErr = err as { status?: number; error?: string; message?: string };
      if (httpErr?.status) {
        let body = httpErr.error ?? '';
        try { body = JSON.stringify(JSON.parse(body), null, 2); } catch { /* raw */ }
        this.apiResult.set({
          status: httpErr.status,
  
          headers: {},
          body,
          isJson: false,
          durationMs: Math.round(performance.now() - t0),
        });
      } else {
        this.apiError.set(httpErr?.message ?? String(err));
      }
    } finally {
      this.apiLoading.set(false);
    }
  }

  // --- Token refresh debug ---
  protected readonly refreshing = signal(false);
  protected readonly refreshStatus = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly refreshError = signal<string>('');

  constructor() {
    this._intervalId = setInterval(() => this._now.set(Date.now()), 1000);

    // Reset refresh status when token changes (after successful refresh)
    effect(() => {
      this.auth.accessToken(); // track
      if (this.refreshStatus() === 'success') {
        setTimeout(() => this.refreshStatus.set('idle'), 4000);
      }
    });
  }

  ngOnDestroy(): void {
    clearInterval(this._intervalId);
  }

  async triggerRefresh(): Promise<void> {
    this.refreshing.set(true);
    this.refreshStatus.set('idle');
    this.refreshError.set('');
    try {
      await this.auth.refreshTokens();
      this.refreshStatus.set('success');
    } catch (err) {
      this.refreshError.set(err instanceof Error ? err.message : String(err));
      this.refreshStatus.set('error');
    } finally {
      this.refreshing.set(false);
    }
  }

  copyToken(): void {
    const token = this.auth.getToken();
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}
