-- FitandSleek — simple Neon / hosted PostgreSQL seed (catalog categories only)
-- Run in Neon SQL Editor AFTER: php artisan migrate --force
--
-- Upserts all 17 storefront categories (parents + MEN / WOMEN / BOY / GIRL).
-- For admin users, run: php artisan db:seed --class=NeonHostingSeeder

INSERT INTO categories (name, slug, type, gender, is_active, sort_order, created_at, updated_at)
VALUES
  ('Clothes', 'clothes', 'parent', NULL, true, 1, NOW(), NOW()),
  ('Shoes', 'shoes', 'parent', NULL, true, 2, NOW(), NOW()),
  ('Belts', 'belts', 'parent', NULL, true, 3, NOW(), NOW()),

  ('Men - T-Shirts', 'men-t-shirts', NULL, 'MEN', true, 10, NOW(), NOW()),
  ('Men - Shirts', 'men-shirts', NULL, 'MEN', true, 11, NOW(), NOW()),
  ('Men - Pants', 'men-pants', NULL, 'MEN', true, 12, NOW(), NOW()),
  ('Men - Shoes', 'men-shoes', NULL, 'MEN', true, 13, NOW(), NOW()),

  ('Women - Dresses', 'women-dresses', NULL, 'WOMEN', true, 20, NOW(), NOW()),
  ('Women - Tops', 'women-tops', NULL, 'WOMEN', true, 21, NOW(), NOW()),
  ('Women - Skirts', 'women-skirts', NULL, 'WOMEN', true, 22, NOW(), NOW()),
  ('Women - Shoes', 'women-shoes', NULL, 'WOMEN', true, 23, NOW(), NOW()),

  ('Boy - T-Shirts', 'boy-t-shirts', NULL, 'BOY', true, 30, NOW(), NOW()),
  ('Boy - Shorts', 'boy-shorts', NULL, 'BOY', true, 31, NOW(), NOW()),
  ('Boy - Shoes', 'boy-shoes', NULL, 'BOY', true, 32, NOW(), NOW()),

  ('Girl - Dresses', 'girl-dresses', NULL, 'GIRL', true, 40, NOW(), NOW()),
  ('Girl - Tops', 'girl-tops', NULL, 'GIRL', true, 41, NOW(), NOW()),
  ('Girl - Shoes', 'girl-shoes', NULL, 'GIRL', true, 42, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  gender = EXCLUDED.gender,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
