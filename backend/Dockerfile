# Backend Dockerfile for Laravel
FROM php:8.4-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    oniguruma-dev \
    libxml2-dev \
    zip \
    unzip \
    sqlite-dev \
    nginx \
    supervisor

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_sqlite mbstring exif pcntl bcmath gd

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www

# Copy composer files first for better caching
COPY composer.json composer.lock ./

# Install dependencies
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# Copy application code
COPY . .

# Create SQLite database file (directory already exists from COPY)
RUN touch database/database.sqlite

# Complete composer install with fresh autoload
RUN composer dump-autoload --optimize

# Set permissions
RUN chown -R www-data:www-data /var/www && \
    chmod -R 755 /var/www/storage /var/www/bootstrap/cache

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Copy supervisor configuration
COPY docker/supervisord.conf /etc/supervisord.conf

# Copy and set entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 8000

# Use entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
