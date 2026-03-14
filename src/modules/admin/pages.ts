import { Hono } from 'hono';
import type { Env } from '../../core/config/env';
import type { AuthVariables } from '../auth/middleware';
import { requireAuth, requireRole } from '../auth/middleware';

export const adminPages = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/** Public login page — no auth required. */
adminPages.get('/login', (c) => {
  return c.html(loginPageHtml());
});

/** Dashboard — requires auth, any role. */
adminPages.get('/dashboard', requireAuth(), requireRole('owner', 'admin', 'editor', 'viewer'), (c) => {
  const user = c.get('authUser');
  return c.html(dashboardPageHtml(user.email, user.role));
});

// ── HTML templates ───────────────────────────────────────────

function loginPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cyberpusa — Login</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto; padding: 0 16px; }
    h1 { font-size: 1.5rem; }
    label { display: block; margin-top: 12px; font-weight: 600; }
    input { width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; }
    button { margin-top: 16px; padding: 10px 20px; cursor: pointer; }
    #error { color: red; margin-top: 12px; }
    #result { color: green; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>Cyberpusa Admin Login</h1>
  <form id="loginForm">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required>
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required minlength="8">
    <button type="submit">Sign In</button>
  </form>
  <div id="error"></div>
  <div id="result"></div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      document.getElementById('error').textContent = '';
      document.getElementById('result').textContent = '';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const body = await res.json();
        if (body.success) {
          localStorage.setItem('token', body.data.token);
          document.getElementById('result').textContent = 'Login successful! Redirecting...';
          setTimeout(() => { window.location.href = '/admin/dashboard'; }, 500);
        } else {
          document.getElementById('error').textContent = body.error?.message || 'Login failed';
        }
      } catch (err) {
        document.getElementById('error').textContent = 'Network error';
      }
    });
  </script>
</body>
</html>`;
}

function dashboardPageHtml(email: string, role: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cyberpusa — Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 16px; }
    h1 { font-size: 1.5rem; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .label { font-weight: 600; color: #666; }
    button { margin-top: 16px; padding: 8px 16px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Cyberpusa Admin Dashboard</h1>
  <div class="card">
    <p><span class="label">Authenticated as:</span> ${escapeHtml(email)}</p>
    <p><span class="label">Role:</span> ${escapeHtml(role)}</p>
    <p><span class="label">Status:</span> Active session</p>
  </div>
  <p style="margin-top:24px;color:#888;">
    <!-- TODO: replace this placeholder with real admin UI controls -->
    This is a placeholder dashboard. Full admin control plane coming in Phase 3.
  </p>
  <button onclick="localStorage.removeItem('token'); window.location.href='/admin/login';">Logout</button>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
