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

case "$1" in
  web)
    rm -rf public/storage
    php artisan storage:link --relative --force
    php artisan config:clear
    php artisan migrate --force
    chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
    chmod -R ug+rwx storage bootstrap/cache 2>/dev/null || true
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
