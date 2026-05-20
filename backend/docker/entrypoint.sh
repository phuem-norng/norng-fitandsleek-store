#!/bin/sh
set -e

cd /var/www/html

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
