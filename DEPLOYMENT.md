# Coolify Deployment Guide

This guide explains how to deploy Barmania to your server using Coolify.

## Prerequisites

- A server with Coolify installed
- Your GitHub repository connected to Coolify

## Architecture

The app consists of two services:
- **Backend**: Laravel API (PHP 8.3 + Nginx + SQLite)
- **Frontend**: React SPA (Nginx serving static files)

## Deployment Steps

### 1. Create Backend Service

1. In Coolify, go to **Projects** > **Add New Resource** > **Public Repository** (or Private if applicable)
2. Enter your repository URL
3. Configure the service:
   - **Name**: `barmania-backend`
   - **Build Pack**: Docker
   - **Dockerfile Location**: `backend/Dockerfile`
   - **Port**: `8000`

4. Set Environment Variables:
   ```
   APP_NAME=Barmania
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://api.yourdomain.com
   APP_KEY=  # Leave empty, will be auto-generated on first run
   DB_CONNECTION=sqlite
   SESSION_DRIVER=database
   CACHE_STORE=database
   QUEUE_CONNECTION=sync
   ```

5. Configure Domain:
   - Add your API domain (e.g., `api.yourdomain.com`)
   - Enable HTTPS

6. **Important**: Add a persistent volume for the database:
   - Mount path: `/var/www/database`
   - This preserves your SQLite database across deployments

### 2. Create Frontend Service

1. Add another resource from the same repository
2. Configure the service:
   - **Name**: `barmania-frontend`
   - **Build Pack**: Docker
   - **Dockerfile Location**: `frontend/Dockerfile`
   - **Port**: `3000`

3. Set Build Arguments:
   ```
   VITE_API_URL=https://api.yourdomain.com
   ```

4. Configure Domain:
   - Add your frontend domain (e.g., `yourdomain.com` or `app.yourdomain.com`)
   - Enable HTTPS

### 3. Deploy

1. Deploy the backend first and wait for it to be healthy
2. Deploy the frontend

## Environment Variables Reference

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_NAME` | Application name | Laravel |
| `APP_ENV` | Environment (local/production) | production |
| `APP_DEBUG` | Enable debug mode | false |
| `APP_URL` | Full URL of your API | - |
| `APP_KEY` | Encryption key (auto-generated) | - |
| `DB_CONNECTION` | Database driver | sqlite |

### Frontend (Build Args)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Full URL of your backend API |

## Updating

Coolify will automatically rebuild and deploy when you push to your repository (if webhooks are configured).

## Troubleshooting

### Database Issues
- Ensure the `/var/www/database` volume is persisted
- Check logs: `docker logs <container_id>`

### CORS Issues
- Verify `APP_URL` matches your actual domain
- Check that frontend's `VITE_API_URL` points to the correct backend URL

### Build Failures
- Check that all Dockerfiles are committed
- Verify `docker/` directories exist in both frontend and backend

## Local Testing

Before deploying, test locally with Docker Compose:

```bash
# From project root
docker-compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```
