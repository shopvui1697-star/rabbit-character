# Running Rabbit V2 with Docker

This guide walks you through building and running the app with Docker Compose.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose v2)
- **Chrome or Edge** for voice features (Web Speech API)

Verify Docker is installed:

```bash
docker --version
docker compose version
```

## Quick Start

From the project root:

```bash
cd rabbit-character
docker compose up --build
```

When both containers are healthy, open:

**http://localhost:8080**

Login credentials: **Honda** / **1234**

Stop the app:

```bash
docker compose down
```

## What Gets Started

| Service   | Container        | Port (host) | Role                                      |
|-----------|------------------|-------------|-------------------------------------------|
| frontend  | `rabbit-frontend`| 8080        | Nginx serves the React PWA                |
| backend   | `rabbit-backend` | (internal)  | Express API (`/api/login`, `/api/movies`) |

The frontend proxies `/api/*` requests to the backend inside the Docker network. You only need to open port **8080** in your browser.

## Common Commands

### Run in background

```bash
docker compose up --build -d
```

### View logs

```bash
docker compose logs -f
```

Logs for one service:

```bash
docker compose logs -f frontend
docker compose logs -f backend
```

### Rebuild after code changes

```bash
docker compose up --build
```

Or rebuild a single service:

```bash
docker compose build frontend
docker compose up -d
```

### Stop and remove containers

```bash
docker compose down
```

Remove built images as well:

```bash
docker compose down --rmi local
```

### Check container health

```bash
docker compose ps
```

Backend health endpoint (from inside the network):

```bash
docker compose exec backend node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>r.json()).then(console.log)"
```

## Architecture

```
Browser (localhost:8080)
        │
        ▼
┌───────────────────┐
│  frontend (nginx) │
│  - static files   │
│  - /api → proxy   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  backend (node)   │
│  Express :3001    │
└───────────────────┘
```

## Local Development (without Docker)

Docker is optional. For day-to-day development with hot reload:

```bash
# Terminal 1
cd backend && npm install && npm run dev

# Terminal 2
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to the backend on port 3001.

## Troubleshooting

### Port 8080 already in use

Edit `docker-compose.yml` and change the host port:

```yaml
ports:
  - "3000:80"   # use http://localhost:3000 instead
```

Then restart:

```bash
docker compose down
docker compose up --build
```

### Build fails on frontend (TypeScript errors)

Run the build locally first to see errors:

```bash
cd frontend
npm install
npm run build
```

Fix any TypeScript issues, then rebuild Docker.

### API requests fail in browser

1. Confirm both containers are running: `docker compose ps`
2. Check backend logs: `docker compose logs backend`
3. Test health: `curl http://localhost:8080/api/health`

Expected response:

```json
{"status":"ok","timestamp":"..."}
```

### Microphone not working

- Use **Chrome** or **Edge**
- Allow microphone permission for `localhost`
- Voice runs in the browser; Docker does not affect mic access

### Slow first load

The PWA loads Transformer.js models in the browser on first use. That is normal and unrelated to Docker.

## File Reference

| File                    | Purpose                          |
|-------------------------|----------------------------------|
| `docker-compose.yml`    | Orchestrates frontend + backend  |
| `backend/Dockerfile`    | Node.js API image                |
| `frontend/Dockerfile`   | Vite build + Nginx image         |
| `frontend/nginx.conf`   | Static files + API reverse proxy |
