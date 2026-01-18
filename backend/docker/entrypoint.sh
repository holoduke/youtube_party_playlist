#!/bin/sh
set -e

# Create database directory and file if they don't exist
mkdir -p /var/www/database
if [ ! -f /var/www/database/database.sqlite ]; then
    echo "Creating SQLite database..."
    touch /var/www/database/database.sqlite
fi

# Set permissions
chown -R www-data:www-data /var/www/database /var/www/storage /var/www/bootstrap/cache
chmod -R 755 /var/www/storage /var/www/bootstrap/cache

# Check APP_KEY is set (should be provided via Coolify env vars)
if [ -z "$APP_KEY" ]; then
    echo "WARNING: APP_KEY not set. Generate one with: php artisan key:generate --show"
    echo "Then add it to Coolify environment variables."
fi

# Run migrations
echo "Running database migrations..."
php artisan migrate --force

# Cache configuration for production (skip if APP_KEY not set)
if [ "$APP_ENV" = "production" ] && [ -n "$APP_KEY" ]; then
    echo "Caching configuration..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi

echo "Starting application..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
