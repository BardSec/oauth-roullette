# Email Roulette

A Microsoft Graph-powered web app. Sign in with your Microsoft 365 account, spin the wheel, and discover a random email from your junk folder.

---

## How it works

| Layer | Technology |
|---|---|
| Auth | MSAL Node (Authorization Code flow) |
| Backend | Node.js + Express |
| Graph API | `GET /me/mailFolders/JunkEmail/messages` |
| Frontend | Vanilla HTML / CSS / Canvas |

The spin endpoint:
1. Fetches the total item count for your Junk Email folder.
2. Picks a random `$skip` offset — no full folder download needed.
3. Returns one message with only the fields needed for display.

---

## Azure AD app registration

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**.
2. Give it a name (e.g. *Email Roulette*).
3. Set **Supported account types** to *Accounts in this organizational directory only* (or multi-tenant if you need it).
4. Add a **Redirect URI**: `Web` → `http://localhost:3000/auth/callback`.
5. After creation, note the **Application (client) ID** and **Directory (tenant) ID**.
6. Go to **Certificates & secrets** → **New client secret**. Copy the secret **value** immediately.
7. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated** → add:
   - `Mail.Read`
   - `User.Read`
8. Click **Grant admin consent** (or ask your admin to do so).

---

## Local setup

```bash
cd email-roulette

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and fill in TENANT_ID, CLIENT_ID, CLIENT_SECRET

# Start the server
npm start
# or for auto-restart on file changes:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Docker deployment

```bash
cd email-roulette

# Configure environment (same as local setup)
cp .env.example .env
# Edit .env and fill in TENANT_ID, CLIENT_ID, CLIENT_SECRET

# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

The image is built from a minimal `node:22-alpine` base, runs as a non-root user, and mounts the root filesystem read-only.

To expose on a different host port, set `PORT` in `.env` (e.g. `PORT=8080`) — the Compose file maps `${PORT}:3000` automatically.

---

## Local setup

```bash
cd email-roulette

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and fill in TENANT_ID, CLIENT_ID, CLIENT_SECRET

# Start the server
npm start
# or for auto-restart on file changes:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project structure

```
email-roulette/
├── public/
│   ├── index.html      # Single-page shell
│   ├── style.css       # Dark-theme styles + wheel animation
│   └── app.js          # Canvas wheel drawing, spin logic, email rendering
├── src/
│   ├── server.js       # Express app, routes (/auth/*, /api/*)
│   ├── auth.js         # MSAL configuration and token helpers
│   └── graph.js        # Microsoft Graph call (random junk email)
├── .env.example        # Environment variable template
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Environment variables

| Variable | Description |
|---|---|
| `TENANT_ID` | Your Azure AD tenant ID (or `common`) |
| `CLIENT_ID` | Application (client) ID from the app registration |
| `CLIENT_SECRET` | Client secret value |
| `REDIRECT_URI` | Must match the redirect URI registered in Azure AD |
| `SESSION_SECRET` | Random string used to sign the Express session cookie |
| `PORT` | Port to listen on (default: `3000`) |

---

## Production notes

- Set `cookie: { secure: true }` in the session config when running behind HTTPS.
- Store `SESSION_SECRET` and `CLIENT_SECRET` in a secrets manager, not in `.env`.
- The `$skip` approach for random selection works well for folders up to a few thousand items. For very large junk folders the Graph API caps `$skip` at 999 for some endpoints — handle that by capping `randomSkip` at `Math.min(totalItems - 1, 999)` in `graph.js` if needed.
