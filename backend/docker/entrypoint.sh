#!/bin/sh
set -e

cd /var/www/html

# Host-mounted composer.lock can be newer than vendor baked into the image (e.g. after git pull).
if [ -f composer.lock ]; then
  if [ ! -f vendor/composer/installed.json ] || [ composer.lock -nt vendor/composer/installed.json ]; then
    composer install --no-interaction --prefer-dist --optimize-autoloader
  fi
fi

# KHQR Node deps (shared by web + workers)
if [ -d node-khqr ]; then
  cd node-khqr
  if [ ! -d node_modules/ts-khqr ]; then
    npm ci --omit=dev
  fi
  cd /var/www/html
fi

# Laravel writable dirs: .dockerignore intentionally excludes runtime caches,
# so re-create them on every boot before any artisan command needs them.
mkdir -p \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/framework/testing \
  storage/logs \
  bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
chmod -R ug+rwx storage bootstrap/cache 2>/dev/null || true

case "$1" in
  web)
    # Render/Railway set PORT; local Docker Compose uses 8000 (see nginx default.conf).
    PORT="${PORT:-8000}"
    sed -i "s/listen 8000;/listen ${PORT};/" /etc/nginx/conf.d/default.conf
    sed -i "s/listen \[::\]:8000;/listen [::]:${PORT};/" /etc/nginx/conf.d/default.conf

    rm -rf public/storage
    php artisan storage:link --relative --force
    php artisan config:clear

    if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
      php artisan migrate --force
    fi

    php-fpm -D
    exec nginx -g 'daemon off;'
    ;;
  worker)
    shift
    php artisan config:clear
    exec php artisan "$@"
    ;;
  artisan)
    shift
    exec php artisan "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
