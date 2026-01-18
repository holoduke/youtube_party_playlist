#!/bin/sh
set -e

# Create database if it doesn't exist
if [ ! -f /var/www/database/database.sqlite ]; then
    echo "Creating SQLite database..."
    touch /var/www/database/database.sqlite
fi

# Set permissions
chown -R www-data:www-data /var/www/database
chmod -R 755 /var/www/storage /var/www/bootstrap/cache

# Generate app key if not set
if [ -z "$APP_KEY" ]; then
    echo "Generating application key..."
    php artisan key:generate --force
fi

# Run migrations
echo "Running database migrations..."
php artisan migrate --force

# Cache configuration for production
if [ "$APP_ENV" = "production" ]; then
    echo "Caching configuration..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi

echo "Starting application..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
