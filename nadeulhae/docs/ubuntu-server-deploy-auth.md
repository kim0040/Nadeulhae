# Nadeulhae Ubuntu Server Auth Deployment Guide

This document is for manual server rollout. It is intentionally written so you can move secrets by hand instead of copying them from git.

## 1. Scope

Use this when you are ready to pull the latest code on the Ubuntu server and apply the new auth/dashboard changes safely.

Project app directory:

```bash
/path/to/Nadeulhae/nadeulhae
```

Adjust the path to your actual server location.

## 2. Before you touch the server

Confirm these first on your local machine:

1. Local `npm run lint` passes.
2. Local `npm run build` passes.
3. Local `npm run test:auth -- --base-url=http://127.0.0.1:3000` passes while the app is running.
4. You have the production values for all required env vars ready outside git.

## 3. Server prerequisites

Install the base packages:

```bash
sudo apt update
sudo apt install -y curl git build-essential ca-certificates nginx
```

Install a current Node.js LTS release. `next@16` is safest on Node 20+.

Example with NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 4. Pull the latest code

Move to the repository root and update the working copy:

```bash
cd /path/to/Nadeulhae
git pull origin <your-branch-or-main>
cd /path/to/Nadeulhae/nadeulhae
```

Do not create or edit secrets inside tracked files.

## 5. Install dependencies

```bash
cd /path/to/Nadeulhae/nadeulhae
npm install
```

## 6. Create or update `.env.local` manually

Create the file yourself on the server. Do not rely on git for this file.

```bash
cd /path/to/Nadeulhae/nadeulhae
nano .env.local
```

Recommended variables:

```dotenv
APP_BASE_URL=https://your-domain.example

DB_HOST=...
DB_PORT=4000
DB_USER=...
DB_PASSWORD=...
DB_NAME=nadeulhae
DB_CA_PATH=/etc/ssl/certs/ca-certificates.crt
DB_POOL_LIMIT=10

TRUST_PROXY_HEADERS=true
AUTH_COOKIE_NAME=nadeulhae_auth
AUTH_SESSION_DAYS=30
AUTH_SESSION_REFRESH_WINDOW_HOURS=72
AUTH_MAX_SESSIONS_PER_USER=5
AUTH_PEPPER=very-long-random-secret

KMA_API_KEY=...
APIHUB_KEY=...
AIRKOREA_API_KEY=...
```

Notes:

- `DB_CA_PATH` on Ubuntu is usually `/etc/ssl/certs/ca-certificates.crt`, not the macOS path.
- `APP_BASE_URL` must match the real production URL exactly.
- `TRUST_PROXY_HEADERS=true` should only be used when Nginx is in front and overwrites the proxy IP headers.
- `AUTH_PEPPER` must be a long random secret and must never be committed.
- In production, secure cookies require HTTPS. Do not deploy auth over plain HTTP.

## 7. Initialize or update the auth schema

Run this after the env file is present:

```bash
cd /path/to/Nadeulhae/nadeulhae
npm run db:auth:init
```

This creates or updates the auth tables if they do not exist.

## 8. Build before restart

```bash
cd /path/to/Nadeulhae/nadeulhae
npm run lint
npm run build
```

If either command fails, stop here and fix that first.

## 9. Start or restart the app process

If you already use a process manager, restart that service.

Example systemd unit:

```ini
[Unit]
Description=Nadeulhae Next.js
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/Nadeulhae/nadeulhae
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

If you use systemd:

```bash
sudo systemctl daemon-reload
sudo systemctl restart nadeulhae
sudo systemctl status nadeulhae --no-pager
```

## 10. Reverse proxy with Nginx

Use Nginx in front of Next.js so the site is served over HTTPS.

Minimal site example:

```nginx
server {
    listen 80;
    server_name your-domain.example;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.example;

    ssl_certificate /etc/letsencrypt/live/your-domain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.example/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 11. Post-deploy verification order

Run these in order after restart:

1. Open the home page and confirm it loads.
2. Open `/login` and `/signup`.
3. Register a fresh test account.
4. Confirm dashboard entry appears in the navbar after login.
5. Refresh the browser and confirm the session is still alive.
6. Open the dashboard and edit profile fields.
7. Log out and confirm the dashboard entry returns to login.
8. Log back in.
9. Test account deletion with a disposable account only.

Optional CLI smoke test from the server:

```bash
cd /path/to/Nadeulhae/nadeulhae
npm run test:auth -- --base-url=http://127.0.0.1:3000
```

Run this only while the app is already running locally on port `3000`.

## 12. Session behavior

Current auth behavior:

- Login is stored in an `HttpOnly` cookie.
- Default session lifetime is `30` days.
- Active sessions are capped per user with old sessions removed first.
- If a session is close to expiry, authenticated requests refresh the cookie and DB expiry again.
- IP-based controls trust proxy headers only when `TRUST_PROXY_HEADERS=true`.
- Cookies are `secure` in production, so HTTPS is required.

## 13. Security checks before going live

Confirm all of the following:

1. `.env.local` exists only on the server and is not tracked by git.
2. No DB password, auth pepper, or API key is hardcoded in the source tree.
3. `APP_BASE_URL` is set to the real public domain.
4. HTTPS is enabled before production login testing.
5. `npm run db:auth:init` completed successfully against the right database.
6. A disposable account can register, log in, update profile, log out, log back in, and delete itself cleanly.

## 14. Rollback

If the new deploy fails:

1. Stop the service.
2. Return the codebase to the previous known-good commit on the server.
3. Reinstall dependencies only if `package-lock.json` changed between versions.
4. Start the previous release again.
5. Do not delete the production database unless you are intentionally removing user data.

## 15. Important reminder

Do not commit `.env.local`. Move secrets manually. Review the env file once more before restarting the production service.
