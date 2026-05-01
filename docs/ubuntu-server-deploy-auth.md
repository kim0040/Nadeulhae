# Nadeulhae Ubuntu Server Deployment Guide

This guide covers a complete production deployment on Ubuntu 22.04/24.04 LTS with PM2 process manager, Nginx reverse proxy, and Let's Encrypt SSL.

---

## 1. Prerequisites

**Local machine checklist:**
```bash
cd nadeulhae
npm run lint         # must pass
npm run build        # must pass
npm run test:auth -- --base-url=http://127.0.0.1:3000   # must pass with app running
```

**Server machine:**
- Ubuntu 22.04 or 24.04 LTS (fresh install recommended)
- A registered domain pointed to the server IP
- SSH access with sudo privileges

---

## 2. Server Initial Setup

### 2.1 Install base packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ca-certificates nginx ufw
```

### 2.2 Install Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should print v22.x.x
npm -v
```

### 2.3 Install PM2 globally

```bash
sudo npm install -g pm2
pm2 startup systemd   # enable PM2 on boot
```

### 2.4 Configure firewall

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'   # ports 80 + 443
sudo ufw enable
sudo ufw status
```

---

## 3. Clone and Configure the Project

### 3.1 Clone the repository

```bash
git clone https://github.com/kim0040/Nadeulhae.git /opt/Nadeulhae
cd /opt/Nadeulhae/nadeulhae
```

### 3.2 Install dependencies

```bash
npm install
```

### 3.3 Create `.env.local`

Add `NEXT_PUBLIC_*` variables prefixed with `NEXT_PUBLIC_` to make them available client-side.

Create the file manually — never commit secrets:

```bash
cd /opt/Nadeulhae/nadeulhae
nano .env.local
```

**Required variables — copy, fill in, and save:**

```dotenv
NEXT_PUBLIC_API_URL=/api/weather
NEXT_PUBLIC_MOCK_MODE=false

# ---- Database (TiDB / MySQL 8) ----
DB_HOST=your-tidb-host
DB_PORT=4000
DB_USER=your-tidb-user
DB_PASSWORD=your-tidb-password
DB_NAME=nadeulhae
DB_CA_PATH=/etc/ssl/certs/ca-certificates.crt
DB_POOL_LIMIT=10

# ---- Weather / Air APIs ----
KMA_API_KEY=your-kma-api-key
AIRKOREA_API_KEY=your-airkorea-api-key
AIRKOREA_DAILY_LIMIT=500
APIHUB_KEY=your-apihub-key

# ---- Jeonju default grid coordinates (KMA NX/NY) ----
KMA_NX=63
KMA_NY=89
AIRKOREA_STATION_NAME=송천동
JEONJU_AREA_CODE=11B20201
MID_TERM_LAND_AREA_CODE=11F10000
MID_TERM_TEMP_AREA_CODE=11F10201
TM_X=180750
TM_Y=358250
JEONJU_STN_ID=146
NIER_STATION_NAME=전북권

# ---- 범용 LLM (대시보드 채팅, 날씨 브리핑, 단어장 생성 등) ----
GENERAL_LLM_API_KEY=your-general-llm-api-key
GENERAL_LLM_BASE_URL=https://nano-gpt.com/api/v1
GENERAL_LLM_MODEL=deepseek/deepseek-v4-flash
GENERAL_LLM_FALLBACK_MODEL=deepseek/deepseek-v4-pro

# ---- 나들 실험실 LLM (실험실 AI 채팅, 웹검색) ----
LAB_LLM_API_KEY=your-lab-llm-api-key
LAB_LLM_BASE_URL=https://nano-gpt.com/api/v1

# ---- 웹 검색 ----
TAVILY_API_KEY=your-tavily-api-key
TAVILY_BASE_URL=https://api.tavily.com

# ---- 하위 호환 (이전 설정) ----
# NANOGPT_API_KEY=
# NANOGPT_BASE_URL=

# ---- Security ----
AUTH_PEPPER=generate-a-long-random-secret-here
DATA_PROTECTION_KEY=generate-another-long-random-secret-here
ALWAYS_SECURE_COOKIES=true

# ---- Session ----
AUTH_COOKIE_NAME=nadeulhae_auth
AUTH_SESSION_DAYS=30
AUTH_SESSION_REFRESH_WINDOW_HOURS=72
AUTH_MAX_SESSIONS_PER_USER=5

# ---- Server ----
APP_BASE_URL=https://your-domain.example
TRUST_PROXY_HEADERS=true
```

> **Generate strong secrets:** `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

### 3.4 Initialize database schemas

Run all schema init scripts against the production database:

```bash
npm run db:auth:init
npm run db:forecast-grid:init
```

### 3.5 Verify database connectivity

```bash
npm run db:forecast-grid:verify
```

---

## 4. Build and Deploy

### 4.1 Build

```bash
npm run lint
npm run build
```

If either fails, stop and fix before proceeding.

### 4.2 Start with PM2

```bash
NODE_ENV=production pm2 start npm --name nadeulhae -- run start
pm2 save
```

### 4.3 Verify the app is running

```bash
pm2 status
pm2 logs nadeulhae --lines 20
curl -s http://127.0.0.1:3000 | head -20
```

---

## 5. Nginx Reverse Proxy + SSL

### 5.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 5.2 Create Nginx config

```bash
sudo nano /etc/nginx/sites-available/nadeulhae
```

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name your-domain.example;
    return 301 https://$host$request_uri;
}

# HTTPS + WebSocket support
server {
    listen 443 ssl http2;
    server_name your-domain.example;

    ssl_certificate /etc/letsencrypt/live/your-domain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.example/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=20r/m;

    # Static asset caching
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # WebSocket upgrade (for code share)
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 86400s;
    }

    # API routes
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 300s;

        location /api/auth {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://127.0.0.1:3000;
        }

        location /api/ {
            limit_req zone=api burst=10 nodelay;
            proxy_pass http://127.0.0.1:3000;
        }
    }

    # All other requests
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

### 5.3 Enable the site and obtain SSL

```bash
sudo ln -sf /etc/nginx/sites-available/nadeulhae /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo certbot --nginx -d your-domain.example
sudo systemctl reload nginx
```

---

## 6. Post-Deploy Verification

Run these in order:

| # | Test | Expected |
|---|------|----------|
| 1 | Open `https://your-domain.example` | Home page loads with weather score |
| 2 | Open `/login`, `/signup` | Forms render |
| 3 | Register a test account | Redirected to home |
| 4 | Navbar shows logged-in state | Dashboard link visible |
| 5 | Refresh browser | Session persists |
| 6 | Edit profile at `/account` | Changes saved |
| 7 | Log out, log back in | Works both ways |
| 8 | Register another account, delete it | Deletion cascades cleanly |

### CLI smoke test

```bash
cd /opt/Nadeulhae/nadeulhae
npm run test:auth -- --base-url=https://your-domain.example
```

---

## 7. Logging and Monitoring

### 7.1 PM2 logs

```bash
pm2 logs nadeulhae --lines 100
pm2 monit                       # live dashboard
```

### 7.2 Log rotation (prevent disk fill)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### 7.3 Nginx access/error logs

```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 8. Routine Maintenance

### Update code

```bash
cd /opt/Nadeulhae
git pull origin main
cd nadeulhae
npm install
npm run lint
npm run build
pm2 restart nadeulhae
pm2 logs nadeulhae --lines 20
```

### SSL cert renewal

Certbot auto-renews. Verify:

```bash
sudo certbot renew --dry-run
```

### Database backup (manual snapshot)

```bash
# If using TiDB Cloud, use the console to create a backup snapshot.
# For self-hosted MySQL:
mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME > nadeulhae_$(date +%Y%m%d).sql
```

---

## 9. Rollback

If the new deploy fails:

1. `pm2 stop nadeulhae`
2. `cd /opt/Nadeulhae && git checkout <previous-known-good-commit>`
3. `cd nadeulhae && npm install` (only if `package-lock.json` changed)
4. `pm2 start nadeulhae`
5. Verify with the checklist in section 6
6. Do not delete the production database

---

## 10. Security Checklist Before Going Live

- [ ] `.env.local` exists only on the server — never committed to git
- [ ] No secrets hardcoded in source code
- [ ] `APP_BASE_URL` is set to the real domain
- [ ] HTTPS is fully working (green lock in browser)
- [ ] `ALWAYS_SECURE_COOKIES=true` is set
- [ ] `AUTH_PEPPER` and `DATA_PROTECTION_KEY` are strong random values and differ
- [ ] `npm run db:auth:init` ran successfully against production DB
- [ ] `npm run db:forecast-grid:init` ran successfully
- [ ] A test account can register → login → update profile → logout → login → delete cleanly
- [ ] WebSocket at `/ws` works (code share page loads)
