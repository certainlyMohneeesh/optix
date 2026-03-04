# OPTIX — Production Deployment Guide (DigitalOcean)

> Complete step-by-step guide to deploy the OPTIX option chain dashboard (Next.js 16 + Bun WebSocket server) on a DigitalOcean Droplet with Nginx, SSL, and a custom domain.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Create and harden the Droplet](#2-create-and-harden-the-droplet)
3. [Install Bun, Node.js & PM2](#3-install-bun-nodejs--pm2)
4. [Clone and configure the app](#4-clone-and-configure-the-app)
5. [Build and run with PM2](#5-build-and-run-with-pm2)
6. [Nginx — reverse proxy setup](#6-nginx--reverse-proxy-setup)
7. [Custom domain — DNS configuration](#7-custom-domain--dns-configuration)
8. [SSL with Let's Encrypt (HTTPS)](#8-ssl-with-lets-encrypt-https)
9. [Firewall rules (UFW)](#9-firewall-rules-ufw)
10. [Environment secrets management](#10-environment-secrets-management)
11. [Upstox OAuth callback URL update](#11-upstox-oauth-callback-url-update)
12. [WebSocket over HTTPS (wss://)](#12-websocket-over-https-wss)
13. [Monitoring and logs](#13-monitoring-and-logs)
14. [Daily maintenance & token refresh](#14-daily-maintenance--token-refresh)
15. [Updating the app](#15-updating-the-app)

---

## 1. Architecture Overview

```
Browser
  │
  ├─ HTTPS (443) ──► Nginx ──► Next.js app  (localhost:3000)
  │
  └─ WSS   (443) ──► Nginx ──► WS Server    (localhost:8765)
                                    │
                                    └─► Upstox/Zerodha Market Feed
```

- **Next.js app** — serves the UI and REST API routes (`/api/*`)
- **WS proxy server** — standalone Bun process that bridges the broker's live market feed to the browser
- **Nginx** — single entry point on port 443; routes normal HTTP to Next.js and `/ws` path to the WS server; handles SSL termination
- **PM2** — keeps both processes alive, restarts on crash, starts on reboot

---

## 2. Create and Harden the Droplet

### 2a. Create the Droplet

1. Log in to [DigitalOcean](https://cloud.digitalocean.com)
2. Click **Create → Droplets**
3. Choose:
   - **Image**: Ubuntu 24.04 LTS (x64)
   - **Size**: Basic, 2 vCPU / 4 GB RAM (minimum; 2 GB works but may OOM during builds)
   - **Datacenter**: closest to your users (Mumbai `blr1` for India)
   - **Authentication**: **SSH Key** (add your public key — never use password auth)
   - **Hostname**: `optix-prod` (or your preference)
4. Click **Create Droplet** and note the IPv4 address (e.g. `167.71.x.x`)

### 2b. First login

```bash
ssh root@YOUR_DROPLET_IP
```

### 2c. Create a non-root user (never run apps as root)

```bash
# Create user 'deploy' with sudo privileges
adduser deploy
usermod -aG sudo deploy

# Copy your SSH key to the new user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2d. Harden SSH — disable root login and password auth

```bash
nano /etc/ssh/sshd_config
```

Find and change these lines (or add them if missing):

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```

Restart SSH:

```bash
systemctl restart sshd
```

> ⚠️ **Before logging out**, open a NEW terminal and verify `ssh deploy@YOUR_DROPLET_IP` works. Only then close the root session.

### 2e. Install Fail2Ban (protects against brute-force)

```bash
apt update && apt install -y fail2ban

# Create a local override config
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 5
bantime  = 3600
findtime = 600
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

---

## 3. Install Bun, Node.js & PM2

Log in as the `deploy` user from here:

```bash
ssh deploy@YOUR_DROPLET_IP
```

### 3a. System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip nginx certbot python3-certbot-nginx
```

### 3b. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash

# Add to current session
source ~/.bashrc
# Or if you use zsh:
source ~/.zshrc

# Verify
bun --version
```

### 3c. Install Node.js 20 LTS (needed for some Next.js internals)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # should be v20.x
npm --version
```

### 3d. Install PM2 globally

```bash
sudo npm install -g pm2

# Verify
pm2 --version
```

---

## 4. Clone and Configure the App

### 4a. Clone the repository

```bash
# Create a dedicated directory
sudo mkdir -p /var/www/optix
sudo chown deploy:deploy /var/www/optix

cd /var/www/optix
git clone YOUR_REPO_URL .
# e.g. git clone https://github.com/yourname/option-chain.git .
```

> If repo is private, use a [GitHub Deploy Key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) or a Personal Access Token.

### 4b. Install app dependencies

```bash
cd /var/www/optix

# Main app
bun install

# WS server
cd ws-server
bun install
cd ..
```

### 4c. Create the production environment file

```bash
nano /var/www/optix/.env.local
```

Paste and fill in all values:

```env
# ─── Upstox ───────────────────────────────────────────────────────────────────
UPSTOX_CLIENT_ID=your_upstox_client_id
UPSTOX_CLIENT_SECRET=your_upstox_client_secret
# Important: update this to your production domain after DNS is set up
UPSTOX_REDIRECT_URI=https://your-domain.com/api/auth/upstox/callback

# Leave blank — token is injected dynamically via OAuth cookie + POST /token
UPSTOX_ACCESS_TOKEN=

# ─── Zerodha (if used) ────────────────────────────────────────────────────────
ZERODHA_API_KEY=your_zerodha_api_key
ZERODHA_API_SECRET=your_zerodha_api_secret
ZERODHA_ACCESS_TOKEN=

# ─── WebSocket Server ─────────────────────────────────────────────────────────
WS_PORT=8765
# Use wss:// in production (Nginx terminates SSL and proxies to ws://)
NEXT_PUBLIC_WS_SERVER_URL=wss://your-domain.com/ws

# Shared secret between Next.js and ws-server
# Generate a strong random secret:
# openssl rand -hex 32
WS_INTERNAL_SECRET=your_64_char_hex_secret_here

# ─── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# ─── Next.js ──────────────────────────────────────────────────────────────────
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
```

**Secure the file so only the deploy user can read it:**

```bash
chmod 600 /var/www/optix/.env.local
```

### 4d. Create the WS server environment file

The ws-server runs as a separate process and reads its own env. The easiest approach is to symlink the same file:

```bash
ln -s /var/www/optix/.env.local /var/www/optix/ws-server/.env.local
# Or create a separate, minimal one:
cat > /var/www/optix/ws-server/.env << 'EOF'
WS_PORT=8765
BROKER=upstox
WS_INTERNAL_SECRET=your_64_char_hex_secret_here
UPSTOX_ACCESS_TOKEN=
EOF
chmod 600 /var/www/optix/ws-server/.env
```

---

## 5. Build and Run with PM2

### 5a. Build the Next.js app

```bash
cd /var/www/optix
bun run build
```

This generates the `.next/` production build. Takes ~1–2 min on a 2 vCPU droplet.

### 5b. Create PM2 ecosystem file

```bash
nano /var/www/optix/ecosystem.config.js
```

```js
module.exports = {
  apps: [
    {
      name: 'optix-web',
      script: 'bun',
      args: 'run start',
      cwd: '/var/www/optix',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/optix/web-error.log',
      out_file: '/var/log/optix/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'optix-ws',
      script: 'bun',
      args: 'run ws-server/index.ts',
      cwd: '/var/www/optix',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/optix/ws-error.log',
      out_file: '/var/log/optix/ws-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
```

### 5c. Create log directory and start PM2

```bash
sudo mkdir -p /var/log/optix
sudo chown deploy:deploy /var/log/optix

cd /var/www/optix
pm2 start ecosystem.config.js

# Check both processes are running
pm2 status
```

Expected output:
```
┌─────┬──────────────┬─────────┬──────┬───────────┬──────────┐
│ id  │ name         │ mode    │ ↺    │ status    │ cpu      │
├─────┼──────────────┼─────────┼──────┼───────────┼──────────┤
│ 0   │ optix-web    │ fork    │ 0    │ online    │ 0%       │
│ 1   │ optix-ws     │ fork    │ 0    │ online    │ 0%       │
└─────┴──────────────┴─────────┴──────┴───────────┴──────────┘
```

### 5d. Save PM2 process list and enable auto-start on reboot

```bash
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy

# PM2 will print a command — run it with sudo, e.g.:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u deploy --hp /home/deploy
```

---

## 6. Nginx — Reverse Proxy Setup

Nginx sits in front of everything, handles SSL, and routes:
- `https://your-domain.com` → Next.js on port 3000
- `wss://your-domain.com/ws` → WS server on port 8765

### 6a. Create Nginx site config

```bash
sudo nano /etc/nginx/sites-available/optix
```

Paste this initial HTTP-only config (SSL will be added by Certbot in a later step):

```nginx
# /etc/nginx/sites-available/optix

# Rate limiting — protect login/API endpoints
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ── WebSocket proxy (/ws path → WS server port 8765) ─────────────────────
    location /ws {
        proxy_pass http://127.0.0.1:8765;
        proxy_http_version 1.1;

        # Required for WebSocket upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Keep WS connections alive for longer
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 10s;
    }

    # ── Rate-limit OAuth endpoints ────────────────────────────────────────────
    location /api/auth/ {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Internal WS token push endpoint — only allow from localhost ──────────
    location /token {
        # Block all external access to ws-server's /token endpoint
        allow 127.0.0.1;
        deny all;
        proxy_pass http://127.0.0.1:8765;
    }

    # ── All other requests → Next.js ─────────────────────────────────────────
    location / {
        limit_req zone=api_limit burst=40 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
    }
}
```

### 6b. Enable the site and test config

```bash
sudo ln -s /etc/nginx/sites-available/optix /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test config syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 7. Custom Domain — DNS Configuration

### 7a. Point your domain to the Droplet

Log in to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.) and add these DNS records:

| Type  | Host              | Value                | TTL  |
|-------|-------------------|----------------------|------|
| A     | `@` (root domain) | `YOUR_DROPLET_IP`    | 3600 |
| A     | `www`             | `YOUR_DROPLET_IP`    | 3600 |

If you use **Cloudflare** as your nameserver:
- Set the proxy status to **DNS only** (grey cloud) initially — turn on proxy (orange cloud) only after SSL is working
- Cloudflare proxying works fine with this setup once SSL is configured

### 7b. Verify DNS propagation

DNS changes can take 5–30 min (up to 48h worst case). Check with:

```bash
# From your local machine
dig your-domain.com +short
# Should return your Droplet IP

# Or use a web tool:
# https://dnschecker.org
```

---

## 8. SSL with Let's Encrypt (HTTPS)

Once DNS is pointing to your Droplet IP, obtain a free SSL certificate:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  --redirect
```

Certbot will:
1. Verify domain ownership (HTTP challenge via Nginx)
2. Issue the certificate
3. **Automatically update** your Nginx config to add HTTPS with `listen 443 ssl`
4. Set up a redirect from HTTP → HTTPS

Check the updated config:

```bash
sudo cat /etc/nginx/sites-available/optix
```

You should now see `listen 443 ssl` blocks and `ssl_certificate` paths added.

### 8a. Verify auto-renewal

Certbot installs a systemd timer for renewal (certificates expire every 90 days):

```bash
sudo systemctl status certbot.timer

# Test renewal (dry run — doesn't actually renew)
sudo certbot renew --dry-run
```

### 8b. Verify HTTPS is working

```bash
curl -I https://your-domain.com
# Should return HTTP/2 200 (or 307 redirect to Next.js)
```

---

## 9. Firewall Rules (UFW)

Only allow the ports that should be publicly accessible. **Never expose port 8765 or 3000 directly** — only Nginx on 80/443 should be public:

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (critical — do this first or you'll lock yourself out)
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS (Nginx)
sudo ufw allow 'Nginx Full'

# Verify rules
sudo ufw status verbose
```

Expected output:
```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW IN    Anywhere
Nginx Full                 ALLOW IN    Anywhere
```

Ports 3000 and 8765 are **NOT** in this list — they are only accessible from localhost (Nginx proxies to them internally). ✅

---

## 10. Environment Secrets Management

### Never commit secrets to git

Ensure `.env.local` and `ws-server/.env` are in `.gitignore`:

```bash
grep ".env" /var/www/optix/.gitignore
# Should show: .env.local, .env*.local, ws-server/.env
```

If not already:

```bash
echo ".env.local" >> /var/www/optix/.gitignore
echo "ws-server/.env" >> /var/www/optix/.gitignore
```

### Generate a strong WS_INTERNAL_SECRET

```bash
openssl rand -hex 32
# e.g.: a3f8d2c1b4e5f6789012345678901234567890abcdef1234567890abcdef1234
```

Use this as `WS_INTERNAL_SECRET` in both `.env.local` and `ws-server/.env`.

### File permissions checklist

```bash
# Only deploy user can read secrets
chmod 600 /var/www/optix/.env.local
chmod 600 /var/www/optix/ws-server/.env

# App directory readable by deploy user only for writes
chmod 755 /var/www/optix
```

---

## 11. Upstox OAuth Callback URL Update

After deploying, you **must** update the Redirect URI in the Upstox Developer Portal:

1. Log in to [developer.upstox.com](https://developer.upstox.com)
2. Go to **My Apps → Your App → Edit**
3. Change **Redirect URI** to: `https://your-domain.com/api/auth/upstox/callback`
4. Save

Also update your `.env.local`:

```bash
nano /var/www/optix/.env.local
# Change:
UPSTOX_REDIRECT_URI=https://your-domain.com/api/auth/upstox/callback
```

Restart the Next.js app to pick up the env change:

```bash
pm2 restart optix-web
```

---

## 12. WebSocket over HTTPS (wss://)

In production, the browser requires WebSocket connections to use `wss://` (encrypted) when the page is served over HTTPS. The setup above handles this automatically:

```
Browser → wss://your-domain.com/ws
               ↓
          Nginx (SSL termination)
               ↓
          ws://127.0.0.1:8765  (WS server, unencrypted on localhost)
```

Verify the env var in `.env.local` uses `wss://`:

```
NEXT_PUBLIC_WS_SERVER_URL=wss://your-domain.com/ws
```

This is already set as a `NEXT_PUBLIC_` variable so Next.js builds it into the client bundle. After changing it, **rebuild and restart**:

```bash
cd /var/www/optix
bun run build
pm2 restart optix-web
```

### Test WebSocket from browser DevTools

Open your site, then in DevTools → Network → WS tab, you should see a connection to `wss://your-domain.com/ws` with status `101 Switching Protocols`.

---

## 13. Monitoring and Logs

### PM2 live logs

```bash
# Both processes
pm2 logs

# Only Next.js
pm2 logs optix-web

# Only WS server
pm2 logs optix-ws

# Last 100 lines
pm2 logs --lines 100
```

### PM2 process monitor (CPU/RAM)

```bash
pm2 monit
```

### Nginx access and error logs

```bash
# Live access log
sudo tail -f /var/log/nginx/access.log

# Live error log
sudo tail -f /var/log/nginx/error.log
```

### App-specific logs

```bash
tail -f /var/log/optix/web-out.log
tail -f /var/log/optix/web-error.log
tail -f /var/log/optix/ws-out.log
tail -f /var/log/optix/ws-error.log
```

### Check all services are running

```bash
pm2 status
sudo systemctl status nginx
sudo ufw status
sudo systemctl status fail2ban
```

---

## 14. Daily Maintenance & Token Refresh

### Upstox token (automatic)

Upstox tokens expire at midnight IST daily. The OAuth flow is already automated:
- User clicks **Login** → redirected to Upstox → callback sets `upstox_access_token` cookie + pushes token to WS server
- No manual action needed — the UI provides the login button whenever the token expires

### Zerodha token (manual daily)

Zerodha tokens must be generated fresh each day:

1. Visit `https://your-domain.com/api/auth/zerodha/login` each morning
2. Complete Zerodha TOTP login
3. Token is automatically pushed to the WS server

Or set up a cron-based reminder:

```bash
crontab -e
# Add:
0 8 * * 1-5 echo "Zerodha token refresh needed" | mail -s "OPTIX: Refresh Zerodha token" your@email.com
```

### Log rotation

PM2 handles log rotation but add a logrotate rule for safety:

```bash
sudo nano /etc/logrotate.d/optix
```

```
/var/log/optix/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 15. Updating the App

When you push new code, here is the update procedure:

```bash
cd /var/www/optix

# Pull latest code
git pull origin main

# Install any new dependencies
bun install

# Rebuild Next.js
bun run build

# Zero-downtime restart (PM2 keeps old process alive until new one is ready)
pm2 reload optix-web

# Restart WS server (brief interruption — clients auto-reconnect in 5s)
pm2 restart optix-ws

# Verify both are up
pm2 status
```

### Rollback if something breaks

```bash
# Check recent PM2 logs for errors
pm2 logs optix-web --lines 50

# Roll back to previous git commit
git log --oneline -5
git stash         # or git reset --hard <commit>
bun run build
pm2 reload optix-web
```

---

## Quick Reference — Useful Commands

```bash
# === PM2 ===
pm2 status                        # Show all processes
pm2 restart optix-web             # Restart Next.js
pm2 restart optix-ws              # Restart WS server
pm2 restart all                   # Restart everything
pm2 reload optix-web              # Zero-downtime reload
pm2 logs                          # Stream all logs
pm2 monit                         # CPU/RAM dashboard

# === Nginx ===
sudo nginx -t                     # Test config syntax
sudo systemctl reload nginx       # Reload config (no downtime)
sudo systemctl restart nginx      # Full restart

# === SSL ===
sudo certbot renew --dry-run      # Test certificate renewal
sudo certbot certificates         # List certificates and expiry dates

# === Firewall ===
sudo ufw status verbose           # Show all rules
sudo ufw allow PORT               # Open a port

# === Server health ===
htop                              # CPU/RAM usage
df -h                             # Disk usage
free -h                           # Memory usage
```

---

## Security Checklist

Before going live, verify each item:

- [ ] Root SSH login disabled (`PermitRootLogin no`)
- [ ] Password SSH auth disabled (`PasswordAuthentication no`)
- [ ] All access via SSH key only
- [ ] `deploy` user has no password in sudoers (or strong password required)
- [ ] Fail2Ban running and monitoring SSH
- [ ] UFW enabled — only ports 22, 80, 443 open externally
- [ ] Ports 3000 and 8765 **not** open in UFW (internal only)
- [ ] `.env.local` has `chmod 600`
- [ ] `WS_INTERNAL_SECRET` is a 64-char random hex (not from this doc)
- [ ] Upstox redirect URI updated in developer portal to `https://` URL
- [ ] SSL certificate valid (`sudo certbot certificates`)
- [ ] `NEXT_PUBLIC_WS_SERVER_URL` uses `wss://` in production `.env.local`
- [ ] Log rotation configured
- [ ] PM2 startup on reboot configured (`pm2 startup`)

---

*Last updated: March 2026 — OPTIX v1.0*
