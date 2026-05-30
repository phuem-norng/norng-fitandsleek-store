/**
 * Normalize storefront links from notifications/messages to in-app router paths.
 * Handles full URLs (any host) and legacy `/products/:slug` paths.
 */
export function resolveStorefrontPath(url) {
  if (!url || typeof url !== "string") return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  if (!path.startsWith("/")) return null;
  if (path === "/") return null;

  if (path.startsWith("/products/")) {
    path = path.replace(/^\/products\//, "/p/");
  }

  return path;
}

export function getProductPath(product) {
  if (product?.slug) return `/p/${product.slug}`;
  return resolveStorefrontPath(product?.url);
}
